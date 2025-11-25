import valdApiService from '../server/services/valdApiService.js';
import { bigquery, dataset, query } from '../server/config/bigquery.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * TEST VERSION v3 - Populate BigQuery using LOAD JOBS (free tier compatible)
 * Uses temporary JSON file instead of streaming insert or DML
 */

const TABLE_NAME = 'squat_jump_results';
const TEST_PROFILE_LIMIT = 10;
const DELAY_BETWEEN_CALLS = 300;

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

  // SJ metrics
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
 * IMPORTANT: Filters to only actual SJ test types
 */
async function fetchAllSJTests(profileId) {
  await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS));

  try {
    const tests = await valdApiService.getForceDecksTests(profileId, 'SJ');

    if (tests && tests.data && tests.data.length > 0) {
      // Filter to ONLY tests with testType === 'SJ'
      const sjOnlyTests = tests.data.filter(test => {
        const testType = test.testType || '';
        return testType.toUpperCase() === 'SJ';
      });

      if (sjOnlyTests.length !== tests.data.length) {
        console.log(`   ℹ️  Filtered ${tests.data.length} tests down to ${sjOnlyTests.length} actual SJ tests`);
        if (sjOnlyTests.length === 0 && tests.data.length > 0) {
          console.log(`   ⚠️  Test types found:`, [...new Set(tests.data.map(t => t.testType))].join(', '));
        }
      }

      return sjOnlyTests;
    }

    return [];
  } catch (error) {
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

    group_name_1: profileInfo.group_name_1 || null,
    group_name_2: null,
    group_name_3: null,
    tags: [],

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

    body_weight: test.bodyWeight || null,
    weight: test.weight || null,
    system_weight_kg: test.systemWeightKg || null,

    created_at: now,
    updated_at: now
  };
}

/**
 * Insert rows using LOAD JOB from temporary file (free tier compatible!)
 */
async function insertRowsViaLoadJob(rows) {
  if (rows.length === 0) {
    console.log('⚠️  No rows to insert');
    return { inserted: 0, errors: 0 };
  }

  console.log(`📤 Inserting ${rows.length} rows via BigQuery Load Job (free tier compatible)...`);

  const tempFilePath = path.join(__dirname, `temp-sj-data-${Date.now()}.json`);

  try {
    // Write rows to temporary NDJSON file (newline-delimited JSON)
    const ndjsonData = rows.map(row => JSON.stringify(row)).join('\n');
    await fs.writeFile(tempFilePath, ndjsonData, 'utf8');
    console.log(`   📝 Wrote ${rows.length} rows to temporary file: ${tempFilePath}`);

    // Load the file into BigQuery
    const table = bigquery.dataset(dataset).table(TABLE_NAME);

    const metadata = {
      sourceFormat: 'NEWLINE_DELIMITED_JSON',
      schema: { fields: SCHEMA },
      writeDisposition: 'WRITE_APPEND',  // Append to existing table
      location: 'US'
    };

    console.log(`   ⏳ Starting load job...`);
    const [job] = await table.load(tempFilePath, metadata);
    console.log(`   📋 Load job ${job.id} started`);

    // Wait for the job to complete
    console.log(`   ⏳ Waiting for load job to complete...`);
    const errors = await job.promise();

    // Check for errors
    if (errors && errors.length > 0) {
      console.error(`   ❌ Load job completed with errors:`);
      errors.forEach(error => {
        console.error(`      - ${error.message}`);
      });
      return { inserted: 0, errors: rows.length };
    }

    console.log(`   ✅ Successfully loaded all ${rows.length} rows`);
    return { inserted: rows.length, errors: 0 };

  } catch (error) {
    console.error(`   ❌ Error loading data:`, error.message);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`      - ${err.message}`);
      });
    }
    return { inserted: 0, errors: rows.length };
  } finally {
    // Clean up temporary file
    try {
      await fs.unlink(tempFilePath);
      console.log(`   🗑️  Deleted temporary file`);
    } catch (err) {
      // Ignore errors deleting temp file
    }
  }
}

/**
 * Main function to populate BigQuery with 10 test profiles
 */
async function populateSJDataTest() {
  console.log('🧪 STARTING SQUAT JUMP DATA POPULATION (TEST v3 - LOAD JOBS)');
  console.log('='.repeat(60));
  console.log(`⏱️  Rate limiting: ${DELAY_BETWEEN_CALLS}ms delay between API calls`);
  console.log(`💾 Insert method: BigQuery Load Job (free tier compatible)`);
  console.log('='.repeat(60));

  try {
    // Step 1: Create table
    console.log('\n📋 STEP 1: Create BigQuery Table');
    console.log('-'.repeat(60));
    await createTable();

    // Step 2: Get 10 profile IDs
    console.log('\n👥 STEP 2: Get 10 Profile IDs from CMJ Results');
    console.log('-'.repeat(60));

    const profiles = await getProfileIdsFromCMJ();
    console.log(`\n📊 Total profiles to test: ${profiles.length}`);

    if (profiles.length === 0) {
      console.log('❌ No profiles found to test');
      return;
    }

    // Step 3: Fetch all SJ tests
    console.log('\n🏃 STEP 3: Fetch Squat Jump Tests (with filtering)');
    console.log('-'.repeat(60));

    const allRows = [];
    let processedProfiles = 0;
    let totalTests = 0;
    let profilesWithSJ = 0;

    for (const profile of profiles) {
      processedProfiles++;
      console.log(`\n   [${processedProfiles}/${profiles.length}] Fetching: ${profile.full_name}...`);

      const tests = await fetchAllSJTests(profile.profile_id);

      if (tests.length > 0) {
        profilesWithSJ++;
        console.log(`   ✅ Found ${tests.length} actual SJ tests`);
        totalTests += tests.length;

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

    // Step 4: Insert via load job
    console.log('\n💾 STEP 4: Insert Data into BigQuery via Load Job');
    console.log('-'.repeat(60));

    const result = await insertRowsViaLoadJob(allRows);

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
