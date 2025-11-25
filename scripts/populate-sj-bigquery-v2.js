import valdApiService from '../server/services/valdApiService.js';
import { bigquery, dataset, query } from '../server/config/bigquery.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script to populate BigQuery with ALL Squat Jump tests from both VALD APIs
 * Uses existing CMJ profiles as source for profile IDs
 */

const TABLE_NAME = 'squat_jump_results';

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
 * Get all unique profile IDs from CMJ results (these athletes have force deck tests)
 */
async function getProfileIdsFromCMJ() {
  console.log('\n🔍 Querying profile IDs from CMJ results table...');

  try {
    const sql = `
      SELECT DISTINCT profile_id, full_name, group_name_1
      FROM \`vald-ref-data-copy.${dataset}.cmj_results\`
      WHERE profile_id IS NOT NULL
      ORDER BY full_name
    `;

    const results = await query(sql);
    console.log(`   Found ${results.length} unique profiles with CMJ data`);
    return results;
  } catch (error) {
    console.error('❌ Error querying CMJ profiles:', error.message);
    return [];
  }
}

/**
 * Fetch all SJ tests for a profile
 */
async function fetchAllSJTests(profileId) {
  try {
    const tests = await valdApiService.getForceDecksTests(profileId, 'SJ');

    if (tests && tests.data && tests.data.length > 0) {
      return tests.data;
    }

    return [];
  } catch (error) {
    // Silent fail - not all profiles will have SJ tests
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
 * Insert rows into BigQuery in batches
 */
async function insertRows(table, rows) {
  if (rows.length === 0) {
    console.log('⚠️  No rows to insert');
    return;
  }

  console.log(`📤 Inserting ${rows.length} rows into BigQuery...`);

  const BATCH_SIZE = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    try {
      await table.insert(batch);
      inserted += batch.length;
      console.log(`   ✓ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${inserted}/${rows.length} rows)`);
    } catch (error) {
      console.error(`   ❌ Error inserting batch:`, error.message);
      if (error.errors) {
        console.error(`   First error:`, JSON.stringify(error.errors[0], null, 2));
      }
      errors += batch.length;
    }
  }

  console.log(`\n📊 Insertion complete:`);
  console.log(`   ✅ Successfully inserted: ${inserted} rows`);
  console.log(`   ❌ Failed to insert: ${errors} rows`);
}

/**
 * Main function to populate BigQuery with all SJ tests
 */
async function populateSJData() {
  console.log('🚀 STARTING SQUAT JUMP DATA POPULATION');
  console.log('='.repeat(60));

  try {
    // Step 1: Create table
    console.log('\n📋 STEP 1: Create BigQuery Table');
    console.log('-'.repeat(60));
    await createTable();

    // Step 2: Get profile IDs from existing CMJ data
    console.log('\n👥 STEP 2: Get Profile IDs from CMJ Results');
    console.log('-'.repeat(60));

    const profiles = await getProfileIdsFromCMJ();
    console.log(`\n📊 Total profiles to check: ${profiles.length}`);

    // Step 3: Fetch all SJ tests
    console.log('\n🏃 STEP 3: Fetch All Squat Jump Tests');
    console.log('-'.repeat(60));

    const allRows = [];
    let processedProfiles = 0;
    let totalTests = 0;
    let profilesWithSJ = 0;

    for (const profile of profiles) {
      processedProfiles++;
      const tests = await fetchAllSJTests(profile.profile_id);

      if (tests.length > 0) {
        profilesWithSJ++;
        console.log(`   ✓ ${profile.full_name}: ${tests.length} tests`);
        totalTests += tests.length;

        for (const test of tests) {
          const row = transformTestToBQRow(test, profile);
          allRows.push(row);
        }
      }

      if (processedProfiles % 100 === 0) {
        console.log(`   ... processed ${processedProfiles}/${profiles.length} profiles (${profilesWithSJ} with SJ, ${totalTests} tests found)`);
      }

      // Small delay to avoid rate limiting
      if (processedProfiles % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
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
    await insertRows(table, allRows);

    console.log('\n' + '='.repeat(60));
    console.log('✅ SQUAT JUMP DATA POPULATION COMPLETE!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
console.log('\n');
populateSJData()
  .then(() => {
    console.log('\n👋 Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
