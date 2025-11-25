import valdApiService from '../server/services/valdApiServiceInstance.js';
import { query, dataset } from '../server/config/bigquery.js';

async function compareHopTests() {
  try {
    const profileId = '947548a9-b81f-474a-9863-6dc14a3078c4';

    console.log('🔍 Comparing Blake Weiman hop tests between VALD API and BigQuery...\n');

    // Get tests from VALD API
    console.log('📊 Fetching from VALD API...');
    const valdTests = await valdApiService.getForceDecksTests([profileId]);
    const valdHopTests = valdTests.data.filter(t => t.testType === 'HJ');
    console.log(`✅ VALD API: Found ${valdHopTests.length} HJ tests\n`);

    const valdTestIds = valdHopTests.map(t => t.testId || t.id);
    console.log('VALD Test IDs:');
    valdTestIds.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));

    // Get tests from BigQuery
    console.log('\n📊 Fetching from BigQuery...');
    const sql = `
      SELECT
        test_id,
        test_date,
        hop_rsi_avg_best_5,
        hop_jump_height_avg_best_5,
        hop_gct_avg_best_5
      FROM \`vald-ref-data-copy.${dataset}.HJ_result_updated\`
      WHERE profile_id = '${profileId}'
      ORDER BY test_date DESC
    `;

    const bqResults = await query(sql);
    console.log(`✅ BigQuery: Found ${bqResults.length} tests\n`);

    console.log('BigQuery Test IDs:');
    bqResults.forEach((test, i) => {
      const hasData = test.hop_rsi_avg_best_5 !== null && test.hop_jump_height_avg_best_5 !== null;
      console.log(`  ${i + 1}. ${test.test_id} ${hasData ? '✓' : '✗ (NULL data)'}`);
    });

    // Compare
    console.log('\n📊 Comparison:');
    const bqTestIds = bqResults.map(t => t.test_id);

    // Tests in BigQuery but NOT in VALD API
    const inBqNotVald = bqTestIds.filter(id => !valdTestIds.includes(id));
    if (inBqNotVald.length > 0) {
      console.log(`\n❌ ${inBqNotVald.length} test(s) in BigQuery but NOT in VALD API:`);
      inBqNotVald.forEach(id => {
        const test = bqResults.find(t => t.test_id === id);
        console.log(`  - ${id}`);
        console.log(`    RSI: ${test.hop_rsi_avg_best_5}`);
        console.log(`    Jump Height: ${test.hop_jump_height_avg_best_5}`);
        console.log(`    GCT: ${test.hop_gct_avg_best_5}`);
      });
    }

    // Tests in VALD API but NOT in BigQuery
    const inValdNotBq = valdTestIds.filter(id => !bqTestIds.includes(id));
    if (inValdNotBq.length > 0) {
      console.log(`\n❌ ${inValdNotBq.length} test(s) in VALD API but NOT in BigQuery:`);
      inValdNotBq.forEach(id => console.log(`  - ${id}`));
    }

    // Tests in BOTH
    const inBoth = valdTestIds.filter(id => bqTestIds.includes(id));
    console.log(`\n✅ ${inBoth.length} test(s) exist in BOTH VALD API and BigQuery`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

compareHopTests();
