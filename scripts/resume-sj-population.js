import VALDApiService from '../server/services/valdApiService.js';
import { bigquery, dataset, query } from '../server/config/bigquery.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory (project root)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Create service instance AFTER loading environment variables
const valdApiService = new VALDApiService();

/**
 * Resume SJ BigQuery population from where it left off
 * Skips profiles that already have SJ data in BigQuery
 */

const TABLE_NAME = 'squat_jump_results';
const DELAY_BETWEEN_CALLS = 300;  // 300ms between API calls

async function loadCompletedProfiles() {
  try {
    const filePath = path.join(__dirname, 'completed-sj-profiles.json');
    const data = await fs.readFile(filePath, 'utf-8');
    const profileIds = JSON.parse(data);
    console.log(`✅ Loaded ${profileIds.length} completed profiles from file`);
    return new Set(profileIds);
  } catch (error) {
    console.log('⚠️  No completed profiles file found, will process all profiles');
    return new Set();
  }
}

async function getProfileIdsFromCMJ() {
  console.log('\n🔍 Querying ALL profile IDs from CMJ results table...');

  try {
    const sql = `
      SELECT DISTINCT profile_id, full_name, group_name_1
      FROM \`vald-ref-data-copy.${dataset}.cmj_results\`
      WHERE profile_id IS NOT NULL
      ORDER BY full_name
    `;

    const results = await query(sql);
    console.log(`   Found ${results.length} total profiles in CMJ table`);
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
    console.error(`   ❌ Error fetching SJ tests: ${error.message}`);
    return [];
  }
}

async function getTestDetails(test) {
  try {
    const detailedTest = await valdApiService.getTestDetails(test);
    return detailedTest || test;
  } catch (error) {
    console.error(`   ⚠️  Error fetching test details for ${test.testId}: ${error.message}`);
    return test;
  }
}

function transformTestForBigQuery(test, profileInfo) {
  const now = new Date().toISOString();

  return {
    test_id: test.testId || test.id,
    profile_id: test.profileId || profileInfo.profile_id,
    athlete_name: profileInfo.full_name || 'Unknown',
    test_date: test.recordedDateUtc || test.testDate || now,
    api_source: test.apiSource || 'Unknown',
    group_name_1: profileInfo.group_name_1 || null,
    group_name_2: profileInfo.group_name_2 || null,
    group_name_3: profileInfo.group_name_3 || null,
    tags: test.tags || [],

    // Metrics from detailed test data
    JUMP_HEIGHT_IMP_MOM_Trial_cm: test.JUMP_HEIGHT_IMP_MOM_Trial_cm || null,
    JUMP_HEIGHT_Trial_cm: test.JUMP_HEIGHT_Trial_cm || null,
    FORCE_AT_PEAK_POWER_Trial_N: test.FORCE_AT_PEAK_POWER_Trial_N || null,
    CONCENTRIC_PEAK_FORCE_Trial_N: test.CONCENTRIC_PEAK_FORCE_Trial_N || test.PEAK_CONCENTRIC_FORCE_Trial_N || null,
    CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s: test.VELOCITY_AT_PEAK_POWER_Trial_m_per_s || test.CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s || null,
    PEAK_TAKEOFF_VELOCITY_Trial_m_per_s: test.PEAK_TAKEOFF_VELOCITY_Trial_m_per_s || null,
    CONCENTRIC_PEAK_POWER_Trial_W: test.MEAN_CONCENTRIC_POWER_Trial_W || test.CONCENTRIC_PEAK_POWER_Trial_W || null,
    PEAK_POWER_Trial_W: test.PEAK_POWER_Trial_W || null,
    PEAK_TAKEOFF_POWER_Trial_W: test.PEAK_TAKEOFF_POWER_Trial_W || null,
    BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg: test.BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg || null,
    BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg: test.BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg || null,
    BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg: test.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg || null,
    body_weight: test.BODY_WEIGHT_Trial_kg || test.bodyWeight || test.weight || null,
    weight: test.weight || null,
    system_weight_kg: test.systemWeight || null,

    created_at: now,
    updated_at: now
  };
}

async function insertDataToBigQuery(rows) {
  if (rows.length === 0) {
    console.log('⚠️  No rows to insert');
    return;
  }

  console.log(`\n💾 Inserting ${rows.length} SJ tests into BigQuery...`);

  try {
    // Use Load Job approach (free tier compatible)
    const tempFile = path.join(__dirname, `temp_sj_data_${Date.now()}.json`);

    // Write NDJSON format (newline-delimited JSON)
    const ndjson = rows.map(row => JSON.stringify(row)).join('\n');
    await fs.writeFile(tempFile, ndjson);

    const table = bigquery.dataset(dataset).table(TABLE_NAME);

    const metadata = {
      sourceFormat: 'NEWLINE_DELIMITED_JSON',
      schema: { fields: (await table.getMetadata())[0].schema.fields },
      writeDisposition: 'WRITE_APPEND',
      autodetect: false
    };

    const [job] = await table.load(tempFile, metadata);
    console.log(`   Job ${job.id} started...`);

    const [jobResult] = await job.promise();
    console.log(`   ✅ Job ${jobResult.id} completed successfully`);

    // Clean up temp file
    await fs.unlink(tempFile);

    return jobResult;
  } catch (error) {
    console.error('❌ Error inserting data:', error.message);
    if (error.errors && error.errors.length > 0) {
      console.error('   Detailed errors:', JSON.stringify(error.errors, null, 2));
    }
    throw error;
  }
}

async function main() {
  console.log('\n🧪 SQUAT JUMP DATA POPULATION - RESUME FROM WHERE WE LEFT OFF');
  console.log('============================================================');
  console.log(`⏱️  Rate limiting: ${DELAY_BETWEEN_CALLS}ms between calls`);
  console.log('============================================================\n');

  try {
    // Step 1: Load completed profiles
    console.log('📋 STEP 1: Load Completed Profiles');
    console.log('------------------------------------------------------------');
    const completedProfiles = await loadCompletedProfiles();

    // Step 2: Get all profile IDs from CMJ
    console.log('\n👥 STEP 2: Get ALL Profile IDs from CMJ');
    console.log('------------------------------------------------------------');
    const allProfiles = await getProfileIdsFromCMJ();

    // Filter out completed profiles
    const remainingProfiles = allProfiles.filter(p => !completedProfiles.has(p.profile_id));

    console.log(`\n📊 Progress Summary:`);
    console.log(`   Total profiles: ${allProfiles.length}`);
    console.log(`   Already completed: ${completedProfiles.size}`);
    console.log(`   Remaining to process: ${remainingProfiles.length}`);

    if (remainingProfiles.length === 0) {
      console.log('\n✅ All profiles have been processed! No work to do.');
      return;
    }

    // Step 3: Fetch SJ tests and metrics for remaining profiles
    console.log('\n🏃 STEP 3: Fetch SJ Tests + Detailed Metrics for Remaining Profiles');
    console.log('------------------------------------------------------------\n');

    const allRows = [];
    let profilesProcessed = 0;
    let testsFound = 0;

    for (const profileInfo of remainingProfiles) {
      profilesProcessed++;
      console.log(`   [${profilesProcessed}/${remainingProfiles.length}] ${profileInfo.full_name}...`);

      const sjTests = await fetchAllSJTests(profileInfo.profile_id);

      if (sjTests.length === 0) {
        console.log(`      No SJ tests found`);
        continue;
      }

      console.log(`      Found ${sjTests.length} SJ tests - fetching metrics...`);

      for (const test of sjTests) {
        const detailedTest = await getTestDetails(test);
        const row = transformTestForBigQuery(detailedTest, profileInfo);
        allRows.push(row);
        testsFound++;
        console.log(`      ✓ Got metrics for test ${test.testId.substring(0, 8)}...`);
      }

      // Insert in batches of 100 to avoid memory issues and allow for resume
      if (allRows.length >= 100) {
        await insertDataToBigQuery(allRows);
        allRows.length = 0; // Clear array

        // Update completed profiles file
        console.log('   📝 Updating completed profiles list...');
        const currentCompleted = await fs.readFile(
          path.join(__dirname, 'completed-sj-profiles.json'),
          'utf-8'
        );
        const currentIds = JSON.parse(currentCompleted);
        currentIds.push(profileInfo.profile_id);
        await fs.writeFile(
          path.join(__dirname, 'completed-sj-profiles.json'),
          JSON.stringify(currentIds, null, 2)
        );
      }
    }

    // Insert any remaining rows
    if (allRows.length > 0) {
      await insertDataToBigQuery(allRows);
    }

    // Step 4: Summary
    console.log('\n✅ POPULATION COMPLETE');
    console.log('============================================================');
    console.log(`   Profiles processed: ${profilesProcessed}`);
    console.log(`   Total SJ tests found: ${testsFound}`);
    console.log(`   Tests inserted to BigQuery: ${testsFound}`);
    console.log('============================================================\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
