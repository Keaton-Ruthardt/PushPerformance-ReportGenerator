import valdApiService from '../server/services/valdApiService.js';
import { bigquery, dataset, query } from '../server/config/bigquery.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * TEST VERSION - Populate BigQuery with ONLY 10 profiles of Squat Jump tests
 * Includes aggressive rate limiting to avoid API quota errors
 */

const TABLE_NAME = 'squat_jump_results';
const TEST_PROFILE_LIMIT = 10;  // Only process 10 profiles for testing
const DELAY_BETWEEN_CALLS = 300;  // 300ms delay = max ~20 calls per 5 seconds (under the 25 limit)

// Define the BigQuery table schema
const SCHEMA = [
  { name: 'test_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'profile_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'athlete_name', type: 'STRING' },
  { name: 'test_date', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'api_source', type: 'STRING' },

  // Group/Tags information
  { name: 'group_name_1', type: 'STRING' },
  { name: 'group_name_2', type: 'STRING' },
  { name: 'group_name_3', type: 'STRING' },
  { name: 'tags', type: 'STRING', mode: 'REPEATED' },

  // The 5 key SJ metrics
  { name: 'JUMP_HEIGHT_IMP_MOM_Trial_cm', type: 'FLOAT' },
  { name: 'JUMP_HEIGHT_Trial_cm', type: 'FLOAT' },
  { name: 'FORCE_AT_PEAK_POWER_Trial_N', type: 'FLOAT' },
  { name: 'CONCENTRIC_PEAK_FORCE_Trial_N', type: 'FLOAT' },
  { name: 'CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s', type: 'FLOAT' },
  { name: 'PEAK_TAKEOFF_VELOCITY_Trial_m_per_s', type: 'FLOAT' },
  { name: 'CONCENTRIC_PEAK_POWER_Trial_W', type: 'FLOAT' },
  { name: 'PEAK_POWER_Trial_W', type: 'FLOAT' },
  { name: 'PEAK_TAKEOFF_POWER_Trial_W', type: 'FLOAT' },
  { name: 'BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg', type: 'FLOAT' },
  { name: 'BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg', type: 'FLOAT' },
  { name: 'BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg', type: 'FLOAT' },

  // Additional common fields
  { name: 'body_weight', type: 'FLOAT' },
  { name: 'weight', type: 'FLOAT' },
  { name: 'system_weight_kg', type: 'FLOAT' },

  // Metadata
  { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
];

/**
 * Create the BigQuery table if it doesn't exist
 */
async function createTable() {
  console.log(`📋 Checking if table ${TABLE_NAME} exists...`);

  const table = bigquery.dataset(dataset).table(TABLE_NAME);
  const [exists] = await table.exists();

  if (exists) {
    console.log(`✅ Table ${TABLE_NAME} already exists`);
    return table;
  }

  console.log(`🔨 Creating table ${TABLE_NAME}...`);

  const options = {
    schema: SCHEMA,
    location: 'US',
  };

  const [createdTable] = await bigquery
    .dataset(dataset)
    .createTable(TABLE_NAME, options);

  console.log(`✅ Table ${createdTable.id} created successfully`);
  return createdTable;
}

/**
 * Get 10 profile IDs from CMJ results for testing
 */
async function getProfileIdsFromCMJ() {
  console.log('\n🔍 Querying 10 profile IDs from CMJ results table...');

  try {
    const sql = `
      SELECT DISTINCT profile_id, full_name, group_name_1
      FROM \`vald-ref-data-copy.${dataset}.cmj_results\`
      WHERE profile_id IS NOT NULL
      ORDER BY full_name
      LIMIT ${TEST_PROFILE_LIMIT}
    `;

    const results = await query(sql);
    console.log(`   Found ${results.length} profiles for testing`);
    return results;
  } catch (error) {
    console.error('❌ Error querying CMJ profiles:', error.message);
    return [];
  }
}

/**
 * Fetch all SJ tests for a profile with rate limiting
 */
async function fetchAllSJTests(profileId) {
  // Add delay before each API call to respect rate limits
  await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS));

  try {
    const tests = await valdApiService.getForceDecksTests(profileId, 'SJ');

    if (tests && tests.data && tests.data.length > 0) {
      return tests.data;
    }

    return [];
  } catch (error) {
    // Log rate limit errors specifically
    if (error.message && error.message.includes('quota')) {
      console.error(`   ⚠️  Rate limit hit for profile ${profileId}`);
    }
    return [];
  }
}

/**
 * Transform VALD test data to BigQuery row format
 */
function transformTestToBQRow(test, profileInfo) {
  const now = new Date().toISOString();

  return {
    test_id: test.id || test.testId || `${profileInfo.profile_id}_${test.testDate}`,
    profile_id: profileInfo.profile_id,
    athlete_name: profileInfo.full_name,
    test_date: test.testDate || test.recordedDateUtc,
    api_source: 'VALD',

    // Groups and tags
    group_name_1: profileInfo.group_name_1 || null,
    group_name_2: null,
    group_name_3: null,
    tags: [],

    // Jump metrics - all variations
    JUMP_HEIGHT_IMP_MOM_Trial_cm: test.JUMP_HEIGHT_IMP_MOM_Trial_cm || null,
    JUMP_HEIGHT_Trial_cm: test.JUMP_HEIGHT_Trial_cm || null,
    FORCE_AT_PEAK_POWER_Trial_N: test.FORCE_AT_PEAK_POWER_Trial_N || null,
    CONCENTRIC_PEAK_FORCE_Trial_N: test.CONCENTRIC_PEAK_FORCE_Trial_N || null,
    CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s: test.CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s || null,
    PEAK_TAKEOFF_VELOCITY_Trial_m_per_s: test.PEAK_TAKEOFF_VELOCITY_Trial_m_per_s || null,
    CONCENTRIC_PEAK_POWER_Trial_W: test.CONCENTRIC_PEAK_POWER_Trial_W || null,
    PEAK_POWER_Trial_W: test.PEAK_POWER_Trial_W || null,
    PEAK_TAKEOFF_POWER_Trial_W: test.PEAK_TAKEOFF_POWER_Trial_W || null,
    BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg: test.BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg || null,
    BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg: test.BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg || null,
    BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg: test.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg || null,

    // Body measurements
    body_weight: test.bodyWeight || null,
    weight: test.weight || null,
    system_weight_kg: test.systemWeightKg || null,

    // Metadata
    created_at: now,
    updated_at: now
  };
}

/**
 * Insert rows into BigQuery
 */
async function insertRows(table, rows) {
  if (rows.length === 0) {
    console.log('⚠️  No rows to insert');
    return { inserted: 0, errors: 0 };
  }

  console.log(`📤 Inserting ${rows.length} rows into BigQuery...`);

  try {
    await table.insert(rows);
    console.log(`   ✅ Successfully inserted all ${rows.length} rows`);
    return { inserted: rows.length, errors: 0 };
  } catch (error) {
    console.error(`   ❌ Error inserting rows:`, error.message);
    if (error.errors) {
      console.error(`   First error:`, JSON.stringify(error.errors[0], null, 2));
    }
    return { inserted: 0, errors: rows.length };
  }
}

/**
 * Main function to populate BigQuery with 10 test profiles
 */
async function populateSJDataTest() {
  console.log('🧪 STARTING SQUAT JUMP DATA POPULATION (TEST - 10 PROFILES)');
  console.log('='.repeat(60));
  console.log(`⏱️  Rate limiting: ${DELAY_BETWEEN_CALLS}ms delay between API calls`);
  console.log('='.repeat(60));

  try {
    // Step 1: Create table
    console.log('\n📋 STEP 1: Create BigQuery Table');
    console.log('-'.repeat(60));
    await createTable();

    // Step 2: Get 10 profile IDs from existing CMJ data
    console.log('\n👥 STEP 2: Get 10 Profile IDs from CMJ Results');
    console.log('-'.repeat(60));

    const profiles = await getProfileIdsFromCMJ();
    console.log(`\n📊 Total profiles to test: ${profiles.length}`);

    if (profiles.length === 0) {
      console.log('❌ No profiles found to test');
      return;
    }

    // Step 3: Fetch all SJ tests for these 10 profiles
    console.log('\n🏃 STEP 3: Fetch Squat Jump Tests (with rate limiting)');
    console.log('-'.repeat(60));

    const allRows = [];
    let processedProfiles = 0;
    let totalTests = 0;
    let profilesWithSJ = 0;

    for (const profile of profiles) {
      processedProfiles++;
      console.log(`\n   [${processedProfiles}/${profiles.length}] Fetching: ${profile.full_name} (${profile.profile_id})...`);

      const tests = await fetchAllSJTests(profile.profile_id);

      if (tests.length > 0) {
        profilesWithSJ++;
        console.log(`   ✅ Found ${tests.length} SJ tests`);
        totalTests += tests.length;

        // Log sample metrics from first test
        if (tests[0]) {
          console.log(`      Sample metrics:`, {
            jumpHeight: tests[0].JUMP_HEIGHT_IMP_MOM_Trial_cm || tests[0].JUMP_HEIGHT_Trial_cm,
            peakPower: tests[0].CONCENTRIC_PEAK_POWER_Trial_W,
            peakPowerBM: tests[0].BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg
          });
        }

        for (const test of tests) {
          const row = transformTestToBQRow(test, profile);
          allRows.push(row);
        }
      } else {
        console.log(`   ⚪ No SJ tests found`);
      }
    }

    console.log(`\n📊 Data collection complete:`);
    console.log(`   Total profiles checked: ${processedProfiles}`);
    console.log(`   Profiles with SJ tests: ${profilesWithSJ}`);
    console.log(`   Total SJ tests found: ${totalTests}`);

    // Step 4: Insert all data into BigQuery
    console.log('\n💾 STEP 4: Insert Data into BigQuery');
    console.log('-'.repeat(60));

    const table = bigquery.dataset(dataset).table(TABLE_NAME);
    const result = await insertRows(table, allRows);

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST SQUAT JUMP DATA POPULATION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   Profiles processed: ${processedProfiles}`);
    console.log(`   Profiles with SJ: ${profilesWithSJ}`);
    console.log(`   Total tests found: ${totalTests}`);
    console.log(`   Successfully inserted: ${result.inserted} rows`);
    console.log(`   Failed to insert: ${result.errors} rows`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test script
console.log('\n');
populateSJDataTest()
  .then(() => {
    console.log('\n👋 Test script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test script failed:', error);
    process.exit(1);
  });
