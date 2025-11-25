import { query, dataset } from '../server/config/bigquery.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkSJDataQuality() {
  console.log('\n🔍 Checking SJ Data Quality in BigQuery...\n');

  try {
    // Check total count and metric availability
    const qualityCheckSql = `
      SELECT
        COUNT(*) as total_tests,
        COUNT(JUMP_HEIGHT_IMP_MOM_Trial_cm) as has_jump_height,
        COUNT(CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s) as has_velocity,
        COUNT(CONCENTRIC_PEAK_POWER_Trial_W) as has_power,
        COUNT(BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg) as has_power_bm,
        COUNT(body_weight) as has_body_weight,
        COUNT(DISTINCT profile_id) as unique_profiles
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
    `;

    const qualityResults = await query(qualityCheckSql);
    const stats = qualityResults[0];

    console.log('📊 Overall Statistics:');
    console.log(`   Total tests: ${stats.total_tests}`);
    console.log(`   Unique profiles: ${stats.unique_profiles}`);
    console.log(`   Tests with Jump Height: ${stats.has_jump_height} (${Math.round(stats.has_jump_height/stats.total_tests*100)}%)`);
    console.log(`   Tests with Velocity: ${stats.has_velocity} (${Math.round(stats.has_velocity/stats.total_tests*100)}%)`);
    console.log(`   Tests with Power: ${stats.has_power} (${Math.round(stats.has_power/stats.total_tests*100)}%)`);
    console.log(`   Tests with Power/BM: ${stats.has_power_bm} (${Math.round(stats.has_power_bm/stats.total_tests*100)}%)`);
    console.log(`   Tests with Body Weight: ${stats.has_body_weight} (${Math.round(stats.has_body_weight/stats.total_tests*100)}%)`);

    // Get sample of data
    console.log('\n📋 Sample Data (first 5 tests):');
    const sampleSql = `
      SELECT
        athlete_name,
        test_date,
        JUMP_HEIGHT_IMP_MOM_Trial_cm,
        CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s,
        CONCENTRIC_PEAK_POWER_Trial_W,
        BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg,
        body_weight
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
      ORDER BY test_date DESC
      LIMIT 5
    `;

    const samples = await query(sampleSql);
    samples.forEach((row, i) => {
      console.log(`\n${i+1}. ${row.athlete_name} (${new Date(row.test_date.value).toLocaleDateString()})`);
      console.log(`   Jump Height: ${row.JUMP_HEIGHT_IMP_MOM_Trial_cm ?? 'NULL'} cm`);
      console.log(`   Velocity: ${row.CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s ?? 'NULL'} m/s`);
      console.log(`   Power: ${row.CONCENTRIC_PEAK_POWER_Trial_W ?? 'NULL'} W`);
      console.log(`   Power/BM: ${row.BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg ?? 'NULL'} W/kg`);
      console.log(`   Body Weight: ${row.body_weight ?? 'NULL'} kg`);
    });

    // Check which profiles are already in BigQuery
    console.log('\n📝 Profiles already in BigQuery:');
    const profilesSql = `
      SELECT DISTINCT profile_id
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
      ORDER BY profile_id
    `;

    const profilesInBQ = await query(profilesSql);
    console.log(`   ${profilesInBQ.length} profiles have SJ data in BigQuery`);

    // Save to file for resume script
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const profileIds = profilesInBQ.map(row => row.profile_id);
    const outputPath = path.join(__dirname, 'completed-sj-profiles.json');
    fs.writeFileSync(
      outputPath,
      JSON.stringify(profileIds, null, 2)
    );
    console.log(`   ✅ Saved ${profileIds.length} profile IDs to completed-sj-profiles.json`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

checkSJDataQuality().then(() => process.exit(0));
