import { query, dataset } from '../server/config/bigquery.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkSJTestTypes() {
  console.log('\n🔍 Checking test types in SJ BigQuery data...\n');

  try {
    // Check what values are in the test_type or similar fields
    const sql = `
      SELECT DISTINCT
        api_source,
        COUNT(*) as count
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
      GROUP BY api_source
      ORDER BY count DESC
    `;

    const results = await query(sql);

    console.log('📊 API Source Distribution:');
    results.forEach(row => {
      console.log(`   ${row.api_source}: ${row.count} tests`);
    });

    // Get a sample row to see all fields
    const sampleSql = `
      SELECT *
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
      LIMIT 1
    `;

    const sample = await query(sampleSql);
    if (sample.length > 0) {
      console.log('\n📋 Sample SJ Test Fields:');
      console.log(JSON.stringify(sample[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

checkSJTestTypes().then(() => process.exit(0));
