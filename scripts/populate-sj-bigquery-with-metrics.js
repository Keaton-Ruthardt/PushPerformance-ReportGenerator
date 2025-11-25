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
 * Populate BigQuery with Squat Jump tests INCLUDING actual metric values
 * Fetches trials/results for each test to get jump height, peak power, etc.
 */

const TABLE_NAME = 'squat_jump_results';
const DELAY_BETWEEN_CALLS = 300;  // 300ms between API calls

const SCHEMA = [
  { name: 'test_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'profile_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'athlete_name', type: 'STRING' },
  { name: 'test_date', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'api_source', type: 'STRING' },
  { name: 'group_name_1', type: 'STRING' },
  { name: 'group_name_2', type: 'STRING' },
  { name: 'group_name_3', type: 'STRING' },
  { name: 'tags', type: 'STRING', mode: 'REPEATED' },
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
  { name: 'body_weight', type: 'FLOAT' },
  { name: 'weight', type: 'FLOAT' },
  { name: 'system_weight_kg', type: 'FLOAT' },
  { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
];

async function createTable() {
  console.log(`📋 Checking if table ${TABLE_NAME} exists...`);
  const table = bigquery.dataset(dataset).table(TABLE_NAME);
  const [exists] = await table.exists();

  if (exists) {
    console.log(`✅ Table ${TABLE_NAME} already exists`);
    return table;
  }

  console.log(`🔨 Creating table ${TABLE_NAME}...`);
  const [createdTable] = await bigquery.dataset(dataset).createTable(TABLE_NAME, {
    schema: SCHEMA,
    location: 'US',
  });

  console.log(`✅ Table ${createdTable.id} created successfully`);
  return createdTable;
}

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
    console.log(`   Found ${results.length} profiles to process`);
    return results;
  } catch (error) {
    console.error('❌ Error querying CMJ profiles:', error.message);
    return [];
  }
}

async function fetchAllSJTests(profileId) {
  await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS));

  try {
    const tests = await valdApiService.getForceDecksTests(profileId, 'SJ');

    if (tests && tests.data && tests.data.length > 0) {
      const sjOnlyTests = tests.data.filter(test => {
        const testType = test.testType || '';
        return testType.toUpperCase() === 'SJ';
      });

      return sjOnlyTests;
    }

    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Fetch detailed trial/metric data for a test
 */
async function fetchTestMetrics(test) {
  await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS));

  try {
    // getTestDetails fetches the actual metric values from /tests/{testId}/trials
    const testWithMetrics = await valdApiService.getTestDetails(test);

    if (testWithMetrics) {
      const testId = test.testId || test.id;
      console.log(`      ✓ Got metrics for test ${testId.substring(0, 8)}...`);
      return testWithMetrics;
    }

    const testId = test.testId || test.id;
    console.log(`      ⚠️  No metrics found for test ${testId.substring(0, 8)}...`);
    return null;
  } catch (error) {
    const testId = test.testId || test.id;
    console.error(`      ❌ Error fetching metrics for ${testId}:`, error.message);
    return null;
  }
}

function transformTestToBQRow(test, profileInfo) {
  const now = new Date().toISOString();

  return {
    test_id: test.id || test.testId || test.test_id,
    profile_id: profileInfo.profile_id,
    athlete_name: profileInfo.full_name,
    test_date: test.testDate || test.recordedDateUtc || test.test_date,
    api_source: test.apiSource || 'VALD',

    group_name_1: profileInfo.group_name_1 || null,
    group_name_2: null,
    group_name_3: null,
    tags: [],

    // These should now have actual values from the trials data
    JUMP_HEIGHT_IMP_MOM_Trial_cm: test.JUMP_HEIGHT_IMP_MOM_Trial_cm || null,
    JUMP_HEIGHT_Trial_cm: test.JUMP_HEIGHT_Trial_cm || null,
    FORCE_AT_PEAK_POWER_Trial_N: test.FORCE_AT_PEAK_POWER_Trial_N || null,
    CONCENTRIC_PEAK_FORCE_Trial_N: test.PEAK_CONCENTRIC_FORCE_Trial_N || null,
    CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s: test.VELOCITY_AT_PEAK_POWER_Trial_m_per_s || null,
    PEAK_TAKEOFF_VELOCITY_Trial_m_per_s: test.PEAK_TAKEOFF_VELOCITY_Trial_m_per_s || null,
    CONCENTRIC_PEAK_POWER_Trial_W: test.MEAN_CONCENTRIC_POWER_Trial_W || null,
    PEAK_POWER_Trial_W: test.PEAK_TAKEOFF_POWER_Trial_W || null,
    PEAK_TAKEOFF_POWER_Trial_W: test.PEAK_TAKEOFF_POWER_Trial_W || null,
    BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg: test.BODYMASS_RELATIVE_MEAN_CONCENTRIC_POWER_Trial_W_per_kg || null,
    BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg: test.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg || null,
    BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg: test.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg || null,

    body_weight: test.BODY_WEIGHT_Trial_kg || test.bodyWeight || test.weight || null,
    weight: test.weight || null,
    system_weight_kg: test.systemWeightKg || test.system_weight_kg || null,

    created_at: now,
    updated_at: now
  };
}

async function insertRowsViaLoadJob(rows) {
  if (rows.length === 0) {
    console.log('⚠️  No rows to insert');
    return { inserted: 0, errors: 0 };
  }

  console.log(`📤 Inserting ${rows.length} rows via BigQuery Load Job...`);

  const tempFilePath = path.join(__dirname, `temp-sj-data-${Date.now()}.json`);

  try {
    const ndjsonData = rows.map(row => JSON.stringify(row)).join('\n');
    await fs.writeFile(tempFilePath, ndjsonData, 'utf8');
    console.log(`   📝 Wrote ${rows.length} rows to temporary file`);

    const table = bigquery.dataset(dataset).table(TABLE_NAME);

    const [job] = await table.load(tempFilePath, {
      sourceFormat: 'NEWLINE_DELIMITED_JSON',
      schema: { fields: SCHEMA },
      writeDisposition: 'WRITE_APPEND',
      location: 'US'
    });

    console.log(`   ⏳ Load job ${job.id} started`);
    console.log(`   ✅ Successfully queued ${rows.length} rows for loading`);
    return { inserted: rows.length, errors: 0 };

  } catch (error) {
    console.error(`   ❌ Error loading data:`, error.message);
    return { inserted: 0, errors: rows.length };
  } finally {
    try {
      await fs.unlink(tempFilePath);
      console.log(`   🗑️  Deleted temporary file`);
    } catch (err) {
      // Ignore
    }
  }
}

async function populateSJDataWithMetrics() {
  console.log('🧪 SQUAT JUMP DATA POPULATION - WITH METRICS (ALL PROFILES)');
  console.log('='.repeat(60));
  console.log(`⏱️  Rate limiting: ${DELAY_BETWEEN_CALLS}ms between calls`);
  console.log('='.repeat(60));

  try {
    console.log('\n📋 STEP 1: Create BigQuery Table');
    console.log('-'.repeat(60));
    await createTable();

    console.log('\n👥 STEP 2: Get Profile IDs');
    console.log('-'.repeat(60));
    const profiles = await getProfileIdsFromCMJ();
    console.log(`\n📊 Total profiles to process: ${profiles.length}`);

    if (profiles.length === 0) {
      console.log('❌ No profiles found');
      return;
    }

    console.log('\n🏃 STEP 3: Fetch SJ Tests + Detailed Metrics');
    console.log('-'.repeat(60));

    const allRows = [];
    let processedProfiles = 0;
    let totalTests = 0;
    let testsWithMetrics = 0;

    for (const profile of profiles) {
      processedProfiles++;
      console.log(`\n   [${processedProfiles}/${profiles.length}] ${profile.full_name}...`);

      const tests = await fetchAllSJTests(profile.profile_id);

      if (tests.length > 0) {
        console.log(`      Found ${tests.length} SJ tests - fetching metrics...`);
        totalTests += tests.length;

        for (const test of tests) {
          const testId = test.id || test.testId;

          // Fetch detailed metrics for this test
          const testWithMetrics = await fetchTestMetrics(test);

          if (testWithMetrics) {
            // Check if we got actual metric values
            const hasMetrics = testWithMetrics.JUMP_HEIGHT_IMP_MOM_Trial_cm ||
                              testWithMetrics.CONCENTRIC_PEAK_POWER_Trial_W ||
                              testWithMetrics.BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg;

            if (hasMetrics) {
              testsWithMetrics++;
              const row = transformTestToBQRow(testWithMetrics, profile);
              allRows.push(row);
            } else {
              console.log(`      ⚠️  Test ${testId.substring(0, 8)}... has no metric values`);
            }
          }
        }
      } else {
        console.log(`      No SJ tests found`);
      }
    }

    console.log(`\n📊 Data collection complete:`);
    console.log(`   Profiles processed: ${processedProfiles}`);
    console.log(`   Total SJ tests found: ${totalTests}`);
    console.log(`   Tests with metrics: ${testsWithMetrics}`);
    console.log(`   Rows to insert: ${allRows.length}`);

    console.log('\n💾 STEP 4: Insert Data into BigQuery');
    console.log('-'.repeat(60));

    const result = await insertRowsViaLoadJob(allRows);

    console.log('\n' + '='.repeat(60));
    console.log('✅ SQUAT JUMP DATA POPULATION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   Profiles: ${processedProfiles}`);
    console.log(`   Tests found: ${totalTests}`);
    console.log(`   Tests with metrics: ${testsWithMetrics}`);
    console.log(`   Successfully queued: ${result.inserted} rows`);
    console.log(`   Failed: ${result.errors} rows`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

console.log('\n');
populateSJDataWithMetrics()
  .then(() => {
    console.log('\n👋 Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
