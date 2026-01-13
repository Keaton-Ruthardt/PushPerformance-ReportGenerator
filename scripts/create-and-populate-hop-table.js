import 'dotenv/config';
import { bigquery, dataset as datasetName } from '../server/config/bigquery.js';
import valdApiService from '../server/services/valdApiServiceInstance.js';
import axios from 'axios';

// Rate limiting helper
class RateLimiter {
  constructor(maxCalls, perMs) {
    this.maxCalls = maxCalls;
    this.perMs = perMs;
    this.calls = [];
  }

  async waitIfNeeded() {
    const now = Date.now();
    this.calls = this.calls.filter(time => now - time < this.perMs);

    if (this.calls.length >= this.maxCalls) {
      const oldestCall = this.calls[0];
      const waitTime = this.perMs - (now - oldestCall);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitIfNeeded();
    }

    this.calls.push(now);
  }
}

const rateLimiter = new RateLimiter(10, 5000); // 10 calls per 5 seconds

/**
 * Step 1: Create the hop_test_results table in BigQuery
 */
async function createHopTestResultsTable() {
  try {
    console.log('📋 Step 1: Creating hop_test_results table in BigQuery...\n');

    const schema = [
      { name: 'profile_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'full_name', type: 'STRING', mode: 'REQUIRED' },
      { name: 'test_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'test_date', type: 'TIMESTAMP', mode: 'NULLABLE' },
      { name: 'group_name_1', type: 'STRING', mode: 'NULLABLE' },
      { name: 'group_name_2', type: 'STRING', mode: 'NULLABLE' },
      { name: 'group_name_3', type: 'STRING', mode: 'NULLABLE' },
      { name: 'hop_rsi_avg_best_5', type: 'FLOAT64', mode: 'NULLABLE' },
      { name: 'hop_jump_height_avg_best_5_inches', type: 'FLOAT64', mode: 'NULLABLE' },
      { name: 'hop_gct_avg_best_5', type: 'FLOAT64', mode: 'NULLABLE' },
    ];

    const options = {
      schema: schema,
      location: 'US',
    };

    const dataset = bigquery.dataset(datasetName);
    const table = dataset.table('hop_test_results');

    // Check if table exists
    const [exists] = await table.exists();
    if (exists) {
      console.log('⚠️  Table hop_test_results already exists. Deleting and recreating...\n');
      await table.delete();
    }

    await table.create(options);
    console.log('✅ Table hop_test_results created successfully!\n');
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    throw error;
  }
}

/**
 * Step 2: Get all profiles from all groups
 */
async function getAllProfiles() {
  try {
    console.log('📊 Step 2: Fetching all profiles from VALD API...\n');

    await valdApiService.authenticate();
    const token = await valdApiService.getAccessToken();

    // Get all groups first
    const groupsResponse = await axios.get(
      `${valdApiService.config.tenantUrl}/groups?tenantId=${valdApiService.config.tenantId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const groups = groupsResponse.data.groups || [];
    console.log(`📋 Found ${groups.length} groups\n`);

    // Get profiles for each group
    const allProfiles = [];
    for (const group of groups) {
      console.log(`  Fetching profiles for group: ${group.name} (${group.id})`);

      const profilesResponse = await axios.get(
        `${valdApiService.config.profileUrl}/profiles`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          params: {
            TenantId: valdApiService.config.tenantId,
            GroupId: group.id
          }
        }
      );

      const profiles = profilesResponse.data.profiles || [];
      console.log(`    ✓ Found ${profiles.length} profiles`);

      // Add group name to each profile
      profiles.forEach(profile => {
        // Check if profile already exists in allProfiles
        const existingProfile = allProfiles.find(p => p.profileId === profile.profileId);
        if (existingProfile) {
          // Add additional group names
          if (!existingProfile.group_name_2) {
            existingProfile.group_name_2 = group.name;
          } else if (!existingProfile.group_name_3) {
            existingProfile.group_name_3 = group.name;
          }
        } else {
          // New profile
          allProfiles.push({
            ...profile,
            group_name_1: group.name,
            group_name_2: null,
            group_name_3: null
          });
        }
      });
    }

    console.log(`\n✅ Total unique profiles: ${allProfiles.length}\n`);
    return allProfiles;
  } catch (error) {
    console.error('❌ Error fetching profiles:', error.message);
    throw error;
  }
}

/**
 * Step 3: Get hop tests for a profile
 */
async function getHopTestsForProfile(profileId) {
  try {
    await rateLimiter.waitIfNeeded();

    const token = await valdApiService.getAccessToken();
    const response = await axios.get(
      `${valdApiService.config.forceDecksUrl}/tests`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          TenantId: valdApiService.config.tenantId,
          ModifiedFromUtc: '2020-01-01T00:00:00Z',
          ProfileId: profileId
        }
      }
    );

    const tests = response.data.tests || [];
    // Filter for hop tests only (testType === "HJ")
    return tests.filter(test => test.testType === 'HJ');
  } catch (error) {
    if (error.response?.status !== 404) {
      console.error(`  ❌ Error fetching tests for profile ${profileId}:`, error.message);
    }
    return [];
  }
}

/**
 * Step 4: Calculate hop metrics from trial data
 */
async function calculateHopMetrics(testId) {
  try {
    await rateLimiter.waitIfNeeded();

    const token = await valdApiService.getAccessToken();
    const response = await axios.get(
      `${valdApiService.config.forceDecksUrl}/v2019q3/teams/${valdApiService.config.tenantId}/tests/${testId}/trials`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data || response.data.length === 0) {
      return { rsi: null, jumpHeight: null, gct: null };
    }

    const trial = response.data[0];
    if (!trial.results) {
      return { rsi: null, jumpHeight: null, gct: null };
    }

    // Extract individual hop values (filter by limb === 'Trial')
    const rsiValues = trial.results
      .filter(r => r.definition?.result === 'HOP_RSI' && r.limb === 'Trial')
      .map(r => r.value)
      .filter(v => v != null)
      .sort((a, b) => b - a); // Descending (higher is better)

    const jumpHeightValues = trial.results
      .filter(r => r.definition?.result === 'HOP_JUMP_HEIGHT' && r.limb === 'Trial')
      .map(r => r.value)
      .filter(v => v != null)
      .sort((a, b) => b - a); // Descending (higher is better)

    const gctValues = trial.results
      .filter(r => r.definition?.result === 'HOP_CONTACT_TIME' && r.limb === 'Trial')
      .map(r => r.value)
      .filter(v => v != null)
      .sort((a, b) => a - b); // Ascending (lower is better)

    // Calculate best 5 averages
    const best5RSI = rsiValues.slice(0, 5);
    const best5JH = jumpHeightValues.slice(0, 5);
    const best5GCT = gctValues.slice(0, 5);

    const avgRSI = best5RSI.length > 0
      ? best5RSI.reduce((a, b) => a + b, 0) / best5RSI.length
      : null;

    const avgJH_cm = best5JH.length > 0
      ? best5JH.reduce((a, b) => a + b, 0) / best5JH.length
      : null;

    const avgGCT = best5GCT.length > 0
      ? best5GCT.reduce((a, b) => a + b, 0) / best5GCT.length
      : null;

    // Convert jump height from cm to inches
    const avgJH_inches = avgJH_cm ? avgJH_cm / 2.54 : null;

    return {
      rsi: avgRSI,
      jumpHeight: avgJH_inches,
      gct: avgGCT
    };
  } catch (error) {
    if (error.response?.status !== 404) {
      console.error(`  ❌ Error fetching trials for test ${testId}:`, error.message);
    }
    return { rsi: null, jumpHeight: null, gct: null };
  }
}

/**
 * Step 5: Process all profiles and populate table
 */
async function populateHopTestResults() {
  try {
    console.log('🔄 Step 3: Processing profiles and populating table...\n');

    const profiles = await getAllProfiles();

    let processed = 0;
    let testsFound = 0;
    let testsPopulated = 0;
    const rows = [];

    for (const profile of profiles) {
      processed++;
      const fullName = `${profile.givenName} ${profile.familyName}`.trim();

      if (processed % 50 === 0) {
        console.log(`📊 Progress: ${processed}/${profiles.length} profiles processed, ${testsFound} hop tests found, ${testsPopulated} populated\n`);
      }

      // Get hop tests for this profile
      const hopTests = await getHopTestsForProfile(profile.profileId);

      if (hopTests.length === 0) {
        continue; // Skip profiles with no hop tests
      }

      testsFound += hopTests.length;

      // Process each hop test
      for (const hopTest of hopTests) {
        const metrics = await calculateHopMetrics(hopTest.testId);

        // Only insert if we have at least one metric
        if (metrics.rsi !== null || metrics.jumpHeight !== null || metrics.gct !== null) {
          rows.push({
            profile_id: profile.profileId,
            full_name: fullName,
            test_id: hopTest.testId,
            test_date: hopTest.recordedDateUtc,
            group_name_1: profile.group_name_1,
            group_name_2: profile.group_name_2,
            group_name_3: profile.group_name_3,
            hop_rsi_avg_best_5: metrics.rsi,
            hop_jump_height_avg_best_5_inches: metrics.jumpHeight,
            hop_gct_avg_best_5: metrics.gct
          });

          testsPopulated++;

          // Insert in batches of 100
          if (rows.length >= 100) {
            await insertRows(rows);
            rows.length = 0; // Clear array
          }
        }
      }
    }

    // Insert remaining rows
    if (rows.length > 0) {
      await insertRows(rows);
    }

    console.log('\n✅ Population complete!');
    console.log(`📊 Final stats:`);
    console.log(`   Total profiles processed: ${processed}`);
    console.log(`   Hop tests found: ${testsFound}`);
    console.log(`   Tests successfully populated: ${testsPopulated}\n`);
  } catch (error) {
    console.error('❌ Error populating data:', error);
    throw error;
  }
}

/**
 * Helper: Insert rows into BigQuery
 */
async function insertRows(rows) {
  try {
    const dataset = bigquery.dataset(datasetName);
    const table = dataset.table('hop_test_results');
    await table.insert(rows);
    console.log(`  ✅ Inserted ${rows.length} rows into BigQuery`);
  } catch (error) {
    console.error('❌ Error inserting rows:', error.message);
    // Don't throw - continue processing
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Creating and populating hop_test_results table\n');
    console.log('='.repeat(60));
    console.log('\n');

    // Step 1: Create table
    await createHopTestResultsTable();

    // Step 2 & 3: Get profiles and populate
    await populateHopTestResults();

    console.log('='.repeat(60));
    console.log('✅ ALL DONE!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
