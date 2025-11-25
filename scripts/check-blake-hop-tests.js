import { query, dataset } from '../server/config/bigquery.js';

async function checkBlakeHopTests() {
  try {
    console.log('🔍 Checking Blake Weiman hop tests in BigQuery...\n');

    const sql = `
      SELECT
        test_id,
        test_date,
        full_name,
        profile_id,
        hop_rsi_avg_best_5,
        hop_jump_height_avg_best_5,
        hop_gct_avg_best_5
      FROM \`vald-ref-data-copy.${dataset}.HJ_result_updated\`
      WHERE profile_id = '947548a9-b81f-474a-9863-6dc14a3078c4'
      ORDER BY test_date DESC
    `;

    const results = await query(sql);

    console.log(`✅ Found ${results.length} hop tests for Blake Weiman\n`);

    if (results.length > 0) {
      results.forEach((test, index) => {
        console.log(`Test ${index + 1}:`);
        console.log(`  Test ID: ${test.test_id}`);
        console.log(`  Date: ${test.test_date}`);
        console.log(`  RSI: ${test.hop_rsi_avg_best_5}`);
        console.log(`  Jump Height: ${test.hop_jump_height_avg_best_5}`);
        console.log(`  GCT: ${test.hop_gct_avg_best_5}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No hop tests found in BigQuery');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBlakeHopTests();
