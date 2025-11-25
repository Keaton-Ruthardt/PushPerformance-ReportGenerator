import { query, dataset } from '../server/config/bigquery.js';
import dotenv from 'dotenv';

dotenv.config();

async function verifySJMetrics() {
  console.log('\n🔍 Verifying SJ Metrics in BigQuery...\n');

  try {
    const sql = `
      SELECT
        athlete_name,
        test_date,
        JUMP_HEIGHT_IMP_MOM_Trial_cm,
        CONCENTRIC_PEAK_POWER_Trial_W,
        BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg,
        PEAK_POWER_Trial_W,
        body_weight
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
      ORDER BY test_date DESC
      LIMIT 10
    `;

    const results = await query(sql);

    console.log(`📊 Found ${results.length} SJ tests in BigQuery:\n`);

    results.forEach((row, index) => {
      console.log(`${index + 1}. ${row.athlete_name} (${new Date(row.test_date.value).toLocaleDateString()})`);
      console.log(`   Jump Height: ${row.JUMP_HEIGHT_IMP_MOM_Trial_cm ?? 'NULL'} cm`);
      console.log(`   Peak Power: ${row.CONCENTRIC_PEAK_POWER_Trial_W ?? 'NULL'} W`);
      console.log(`   Peak Power BM: ${row.BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg ?? 'NULL'} W/kg`);
      console.log(`   Body Weight: ${row.body_weight ?? 'NULL'} kg\n`);
    });

    // Check for NULL values
    const nullCount = results.filter(row =>
      !row.JUMP_HEIGHT_IMP_MOM_Trial_cm &&
      !row.CONCENTRIC_PEAK_POWER_Trial_W
    ).length;

    if (nullCount > 0) {
      console.log(`⚠️  Warning: ${nullCount} tests have NULL metric values`);
    } else {
      console.log(`✅ All tests have metric values populated!`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifySJMetrics().then(() => process.exit(0));
