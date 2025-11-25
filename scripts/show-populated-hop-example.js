import 'dotenv/config';
import { query, dataset as datasetName } from '../server/config/bigquery.js';

async function showPopulatedExample() {
  try {
    console.log('📊 Finding a hop test with populated jump height and GCT...\n');

    const sql = `
      SELECT
        test_id,
        full_name,
        test_date,
        hop_rsi_avg_best_5,
        hop_jump_height_avg_best_5,
        hop_gct_avg_best_5
      FROM \`${datasetName}.hj_results\`
      WHERE hop_jump_height_avg_best_5 IS NOT NULL
        AND hop_gct_avg_best_5 IS NOT NULL
      ORDER BY test_date DESC
      LIMIT 5
    `;

    const results = await query(sql);

    console.log(`✅ Found ${results.length} populated hop tests:\n`);

    results.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.full_name} - ${row.test_date.value}`);
      console.log(`   Test ID: ${row.test_id}`);
      console.log(`   RSI (Best 5 Avg): ${row.hop_rsi_avg_best_5?.toFixed(4) || 'N/A'}`);
      console.log(`   Jump Height (Best 5 Avg): ${row.hop_jump_height_avg_best_5?.toFixed(2) || 'N/A'} cm`);
      console.log(`   GCT (Best 5 Avg): ${row.hop_gct_avg_best_5?.toFixed(3) || 'N/A'} ms`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

showPopulatedExample();
