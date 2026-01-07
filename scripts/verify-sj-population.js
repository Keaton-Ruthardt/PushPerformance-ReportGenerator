import { query, dataset } from '../server/config/bigquery.js';
import dotenv from 'dotenv';

dotenv.config();

async function verifySJPopulation() {
  console.log('\n📊 Verifying SJ Data Population in BigQuery\n');

  try {
    // Count total rows
    const countSql = `
      SELECT COUNT(*) as total_tests
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
    `;

    const countResult = await query(countSql);
    const totalTests = countResult[0].total_tests;
    console.log(`✅ Total SJ tests in BigQuery: ${totalTests}\n`);

    if (totalTests === 0) {
      console.log('❌ No data found in squat_jump_results table!');
      return;
    }

    // Get unique profiles
    const profilesSql = `
      SELECT COUNT(DISTINCT profile_id) as unique_profiles
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
    `;

    const profilesResult = await query(profilesSql);
    console.log(`👥 Unique profiles with SJ tests: ${profilesResult[0].unique_profiles}\n`);

    // Show sample data
    const sampleSql = `
      SELECT profile_id, full_name, test_date, api_source,
             JUMP_HEIGHT_Trial_cm, CONCENTRIC_PEAK_POWER_Trial_W
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
      ORDER BY test_date DESC
      LIMIT 5
    `;

    const sampleResults = await query(sampleSql);
    console.log('📋 Sample SJ Tests (most recent 5):');
    console.log('='.repeat(80));
    sampleResults.forEach(row => {
      console.log(`   ${row.full_name}`);
      console.log(`      Date: ${row.test_date}`);
      console.log(`      Jump Height: ${row.JUMP_HEIGHT_Trial_cm} cm`);
      console.log(`      Peak Power: ${row.CONCENTRIC_PEAK_POWER_Trial_W} W`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('\n✅ SJ data population verification COMPLETE!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

verifySJPopulation().then(() => process.exit(0));
