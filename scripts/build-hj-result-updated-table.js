import 'dotenv/config';
import axios from 'axios';
import { bigquery, dataset } from '../server/config/bigquery.js';
import VALDApiService from '../server/services/valdApiService.js';

// Create service instance
const valdApiService = new VALDApiService();

// Rate limiter: 20 requests per 5 seconds
class RateLimiter {
  constructor(maxRequests = 20, windowMs = 5000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async waitIfNeeded() {
    const now = Date.now();

    // Remove requests older than the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    // If we've hit the limit, wait until the oldest request expires
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100; // +100ms buffer
      console.log(`    ⏳ Rate limit reached (${this.requests.length}/${this.maxRequests}), waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Clean up again after waiting
      const newNow = Date.now();
      this.requests = this.requests.filter(time => newNow - time < this.windowMs);
    }

    // Record this request
    this.requests.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(20, 5000);

// Create the HJ_result_updated table
async function createTable() {
  try {
    console.log('🔨 Creating HJ_result_updated table...');

    const schema = [
      { name: 'profile_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'test_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'full_name', type: 'STRING' },
      { name: 'test_date', type: 'DATE' },
      { name: 'group_name_1', type: 'STRING' },
      { name: 'group_name_2', type: 'STRING' },
      { name: 'group_name_3', type: 'STRING' },
      { name: 'hop_rsi_avg_best_5', type: 'FLOAT' },
      { name: 'hop_jump_height_avg_best_5', type: 'FLOAT' },
      { name: 'hop_gct_avg_best_5', type: 'FLOAT' },
      { name: 'created_at', type: 'TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMP' }
    ];

    const table = bigquery.dataset(dataset).table('HJ_result_updated');

    // Check if table exists, if so delete it
    try {
      await table.delete();
      console.log('🗑️  Deleted existing table');
    } catch (err) {
      // Table doesn't exist, that's fine
    }

    // Create new table
    await table.create({ schema });
    console.log('✅ Table created successfully');

    return table;
  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  }
}

// Insert data into BigQuery in batches
async function insertData(table, rows) {
  try {
    if (rows.length === 0) return;

    await table.insert(rows);
    console.log(`✅ Inserted ${rows.length} rows`);
  } catch (error) {
    console.error('❌ Error inserting data:', error);
    if (error.errors) {
      console.error('First error:', JSON.stringify(error.errors[0], null, 2));
    }
  }
}

// Calculate best 5 average for hop test metrics from trials
function calculateBest5Average(trials, exactFieldName) {
  const values = trials
    .map(t => {
      // Handle nested properties in trial results
      if (!t.results || !Array.isArray(t.results)) return null;

      // Find the exact metric in the results array
      const result = t.results.find(r => {
        if (!r.definition || !r.definition.result) return false;

        // Match exact field name and limb = "Trial"
        return r.definition.result === exactFieldName &&
               (r.limb === 'Trial' || !r.limb);
      });

      return result ? result.value : null;
    })
    .filter(v => v !== null && v !== undefined && !isNaN(v))
    .sort((a, b) => b - a);  // Sort descending (best first)

  if (values.length === 0) return null;

  const best5 = values.slice(0, Math.min(5, values.length));
  const avg = best5.reduce((sum, val) => sum + val, 0) / best5.length;
  return avg;
}

// Fetch hop test trials for a specific test
async function getHopTestTrials(testId, apiSource) {
  const useSecondary = apiSource === 'Secondary';
  const config = useSecondary ? valdApiService.config2 : valdApiService.config;
  const token = useSecondary ? await valdApiService.getAccessToken2() : await valdApiService.getAccessToken();

  if (!token || !config) {
    console.error(`No token/config available for ${apiSource} API`);
    return null;
  }

  try {
    // Wait for rate limiter before making request
    await rateLimiter.waitIfNeeded();

    const response = await axios.get(
      `${config.forceDecksUrl}/v2019q3/teams/${config.tenantId}/tests/${testId}/trials`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data; // Array of trials
  } catch (error) {
    console.error(`  ⚠️  Error fetching trials for test ${testId}:`, error.response?.status || error.message);
    return null;
  }
}

// Main function
async function buildTable() {
  console.log('🚀 Building HJ_result_updated table from VALD APIs...\n');

  try {
    // Create table
    const table = await createTable();

    const allRows = [];
    let totalTests = 0;
    let totalAthletes = 0;
    let processedProfileIds = new Set();

    // Get all athletes from both Primary and Secondary APIs
    console.log('\n📡 Fetching all athletes from VALD APIs...');
    const allAthletes = await valdApiService.getAllAthletes();
    console.log(`✅ Found ${allAthletes.length} total athletes\n`);

    // Process each athlete
    for (const athlete of allAthletes) {
      // Athletes from searchAthletes can have multiple profileIds (Primary + Secondary)
      // Process each profileId for this athlete
      const profileIds = athlete.profileIds || [athlete.id];

      for (const profileId of profileIds) {
        // Skip if we've already processed this profile ID
        if (processedProfileIds.has(profileId)) {
          continue;
        }
        processedProfileIds.add(profileId);

        totalAthletes++;
        console.log(`\n[${totalAthletes}] ${athlete.full_name || athlete.name} (ID: ${profileId})`);

        try {
          // Get all Hop Tests for this athlete from VALD API
          console.log('  🔍 Fetching hop tests...');
          await rateLimiter.waitIfNeeded();
          const hopTestsResponse = await valdApiService.getForceDecksTests(profileId, 'Hop Test');

          if (!hopTestsResponse || !hopTestsResponse.data || hopTestsResponse.data.length === 0) {
            console.log('  ⚠️  No hop tests found');
            continue;
          }

          const hopTests = hopTestsResponse.data;
          console.log(`  📊 Found ${hopTests.length} hop test(s)`);

          // Process each hop test
          for (const hopTest of hopTests) {
            const testId = hopTest.testId || hopTest.id;
            const apiSource = hopTest.apiSource || 'Primary';

            console.log(`    📝 Processing test ${testId} from ${apiSource} API...`);

            // Fetch trials for this test
            const trials = await getHopTestTrials(testId, apiSource);

            if (!trials || trials.length === 0) {
              console.log(`    ⚠️  No trials found for test ${testId}`);
              continue;
            }

            console.log(`    📊 Found ${trials.length} trial(s)`);

            // Calculate best 5 averages for ALL THREE metrics using exact field names
            // IMPORTANT: Must use same field names as reportRoutes.js (lines 61, 63, 65)
            const rsi_avg = calculateBest5Average(trials, 'HOP_RSI');
            const jumpHeight_avg = calculateBest5Average(trials, 'HOP_JUMP_HEIGHT');
            const gct_avg = calculateBest5Average(trials, 'HOP_CONTACT_TIME');

            // Only insert if we have at least one metric
            if (rsi_avg !== null || jumpHeight_avg !== null || gct_avg !== null) {
              const row = {
                profile_id: profileId,
                test_id: testId,
                full_name: athlete.full_name || athlete.name,
                test_date: hopTest.testDate || hopTest.test_date,
                group_name_1: athlete.groups?.[0]?.name || athlete.group_name_1 || null,
                group_name_2: athlete.groups?.[1]?.name || athlete.group_name_2 || null,
                group_name_3: athlete.groups?.[2]?.name || athlete.group_name_3 || null,
                hop_rsi_avg_best_5: rsi_avg,
                hop_jump_height_avg_best_5: jumpHeight_avg,
                hop_gct_avg_best_5: gct_avg,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };

              allRows.push(row);
              totalTests++;

              console.log(`    ✅ RSI=${rsi_avg?.toFixed(2) || 'N/A'}, JH=${jumpHeight_avg?.toFixed(2) || 'N/A'}cm, GCT=${gct_avg?.toFixed(4) || 'N/A'}s`);

              // Insert in batches of 100
              if (allRows.length >= 100) {
                await insertData(table, allRows);
                allRows.length = 0;
              }
            } else {
              console.log(`    ⚠️  No valid metrics calculated for test ${testId}`);
            }
          }
        } catch (error) {
          console.error(`  ❌ Error processing profile ${profileId}:`, error.message);
        }
      }
    }

    // Insert remaining rows
    if (allRows.length > 0) {
      await insertData(table, allRows);
    }

    console.log('\n\n✅ Table build complete!');
    console.log(`📊 Total unique athletes processed: ${totalAthletes}`);
    console.log(`📊 Total hop tests inserted: ${totalTests}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

buildTable();
