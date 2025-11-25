import 'dotenv/config';
import { query, dataset as datasetName } from '../server/config/bigquery.js';

async function countPopulatedTests() {
  try {
    console.log('🔍 Checking how many hop tests have been populated...\n');

    const sql = `
      SELECT
        COUNT(*) as total,
        COUNT(hop_jump_height_avg_best_5) as with_jump_height,
        COUNT(hop_gct_avg_best_5) as with_gct
      FROM \`${datasetName}.hj_results\`
    `;

    const results = await query(sql);
    const stats = results[0];

    console.log(`📊 Total hop tests: ${stats.total}`);
    console.log(`✅ Tests with Jump Height populated: ${stats.with_jump_height}`);
    console.log(`✅ Tests with GCT populated: ${stats.with_gct}`);
    console.log(`❌ Tests still needing population: ${stats.total - stats.with_jump_height}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

countPopulatedTests();
