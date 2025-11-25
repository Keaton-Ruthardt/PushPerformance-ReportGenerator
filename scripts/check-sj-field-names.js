import { query, dataset } from '../server/config/bigquery.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkFieldNames() {
  console.log('\n🔍 Checking actual field names in SJ BigQuery data...\n');

  try {
    const sql = `
      SELECT
        JUMP_HEIGHT_IMP_MOM_Trial_cm,
        JUMP_HEIGHT_Trial_cm,
        FORCE_AT_PEAK_POWER_Trial_N,
        CONCENTRIC_PEAK_FORCE_Trial_N,
        CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s,
        PEAK_TAKEOFF_VELOCITY_Trial_m_per_s,
        CONCENTRIC_PEAK_POWER_Trial_W,
        PEAK_POWER_Trial_W,
        PEAK_TAKEOFF_POWER_Trial_W,
        BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg,
        BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg,
        BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg,
        body_weight,
        weight,
        athlete_name,
        test_date
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
      WHERE JUMP_HEIGHT_IMP_MOM_Trial_cm IS NOT NULL
      LIMIT 1
    `;

    const results = await query(sql);

    if (results.length === 0) {
      console.log('❌ No data found');
      return;
    }

    const row = results[0];
    console.log('📊 Sample Row from BigQuery:');
    console.log('   Athlete:', row.athlete_name);
    console.log('   Test Date:', new Date(row.test_date.value).toLocaleDateString());
    console.log('\n🎯 Field Values:');

    const fields = [
      'JUMP_HEIGHT_IMP_MOM_Trial_cm',
      'JUMP_HEIGHT_Trial_cm',
      'FORCE_AT_PEAK_POWER_Trial_N',
      'CONCENTRIC_PEAK_FORCE_Trial_N',
      'CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s',
      'PEAK_TAKEOFF_VELOCITY_Trial_m_per_s',
      'CONCENTRIC_PEAK_POWER_Trial_W',
      'PEAK_POWER_Trial_W',
      'PEAK_TAKEOFF_POWER_Trial_W',
      'BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg',
      'BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg',
      'BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg',
      'body_weight',
      'weight'
    ];

    fields.forEach(field => {
      const value = row[field];
      if (value !== null && value !== undefined) {
        console.log(`   ✅ ${field}: ${value}`);
      } else {
        console.log(`   ❌ ${field}: NULL`);
      }
    });

    // Now check which fields have data across all rows
    console.log('\n📈 Field Coverage Across All Rows:');
    const coverageSql = `
      SELECT
        COUNT(*) as total,
        COUNT(JUMP_HEIGHT_IMP_MOM_Trial_cm) as has_jump_height_imp_mom,
        COUNT(JUMP_HEIGHT_Trial_cm) as has_jump_height,
        COUNT(FORCE_AT_PEAK_POWER_Trial_N) as has_force_peak_power,
        COUNT(CONCENTRIC_PEAK_FORCE_Trial_N) as has_concentric_peak_force,
        COUNT(CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s) as has_concentric_velocity,
        COUNT(PEAK_TAKEOFF_VELOCITY_Trial_m_per_s) as has_takeoff_velocity,
        COUNT(CONCENTRIC_PEAK_POWER_Trial_W) as has_concentric_power,
        COUNT(PEAK_POWER_Trial_W) as has_peak_power,
        COUNT(PEAK_TAKEOFF_POWER_Trial_W) as has_takeoff_power,
        COUNT(BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg) as has_bm_concentric,
        COUNT(BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg) as has_bm_peak,
        COUNT(BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg) as has_bm_takeoff
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
    `;

    const coverage = (await query(coverageSql))[0];
    console.log(`   Total rows: ${coverage.total}`);
    console.log(`   JUMP_HEIGHT_IMP_MOM: ${coverage.has_jump_height_imp_mom} (${Math.round(coverage.has_jump_height_imp_mom/coverage.total*100)}%)`);
    console.log(`   JUMP_HEIGHT: ${coverage.has_jump_height} (${Math.round(coverage.has_jump_height/coverage.total*100)}%)`);
    console.log(`   FORCE_AT_PEAK_POWER: ${coverage.has_force_peak_power} (${Math.round(coverage.has_force_peak_power/coverage.total*100)}%)`);
    console.log(`   CONCENTRIC_PEAK_FORCE: ${coverage.has_concentric_peak_force} (${Math.round(coverage.has_concentric_peak_force/coverage.total*100)}%)`);
    console.log(`   CONCENTRIC_PEAK_VELOCITY: ${coverage.has_concentric_velocity} (${Math.round(coverage.has_concentric_velocity/coverage.total*100)}%)`);
    console.log(`   PEAK_TAKEOFF_VELOCITY: ${coverage.has_takeoff_velocity} (${Math.round(coverage.has_takeoff_velocity/coverage.total*100)}%)`);
    console.log(`   CONCENTRIC_PEAK_POWER: ${coverage.has_concentric_power} (${Math.round(coverage.has_concentric_power/coverage.total*100)}%)`);
    console.log(`   PEAK_POWER: ${coverage.has_peak_power} (${Math.round(coverage.has_peak_power/coverage.total*100)}%)`);
    console.log(`   PEAK_TAKEOFF_POWER: ${coverage.has_takeoff_power} (${Math.round(coverage.has_takeoff_power/coverage.total*100)}%)`);
    console.log(`   BM CONCENTRIC: ${coverage.has_bm_concentric} (${Math.round(coverage.has_bm_concentric/coverage.total*100)}%)`);
    console.log(`   BM PEAK: ${coverage.has_bm_peak} (${Math.round(coverage.has_bm_peak/coverage.total*100)}%)`);
    console.log(`   BM TAKEOFF: ${coverage.has_bm_takeoff} (${Math.round(coverage.has_bm_takeoff/coverage.total*100)}%)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

checkFieldNames().then(() => process.exit(0));
