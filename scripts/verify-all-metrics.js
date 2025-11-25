import { query, dataset } from '../server/config/bigquery.js';
import dotenv from 'dotenv';

dotenv.config();

async function verifyAllMetrics() {
  console.log('\n🔍 Verifying ALL SJ Metrics in BigQuery...\n');

  try {
    const sql = `
      SELECT
        athlete_name,
        JUMP_HEIGHT_IMP_MOM_Trial_cm,
        CONCENTRIC_PEAK_FORCE_Trial_N,
        CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s,
        CONCENTRIC_PEAK_POWER_Trial_W,
        BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg,
        body_weight
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
      ORDER BY athlete_name
      LIMIT 5
    `;

    const results = await query(sql);

    console.log(`📊 Sample of ${results.length} SJ tests:\n`);

    results.forEach((row, index) => {
      console.log(`${index + 1}. ${row.athlete_name}`);
      console.log(`   Jump Height: ${row.JUMP_HEIGHT_IMP_MOM_Trial_cm ?? 'NULL'} cm`);
      console.log(`   Peak Force: ${row.CONCENTRIC_PEAK_FORCE_Trial_N ?? 'NULL'} N`);
      console.log(`   Peak Velocity: ${row.CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s ?? 'NULL'} m/s`);
      console.log(`   Peak Power: ${row.CONCENTRIC_PEAK_POWER_Trial_W ?? 'NULL'} W`);
      console.log(`   Peak Power BM: ${row.BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg ?? 'NULL'} W/kg`);
      console.log(`   Body Weight: ${row.body_weight ?? 'NULL'} kg\n`);
    });

    // Check for NULL values
    const nullVelocityCount = results.filter(row => !row.CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s).length;

    if (nullVelocityCount > 0) {
      console.log(`⚠️  Warning: ${nullVelocityCount} tests have NULL velocity values`);
    } else {
      console.log(`✅ All tests have velocity values populated!`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyAllMetrics().then(() => process.exit(0));
