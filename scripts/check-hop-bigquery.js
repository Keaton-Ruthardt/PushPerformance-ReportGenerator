import 'dotenv/config';
import { bigquery, dataset as datasetName, query, getTable } from '../server/config/bigquery.js';

async function checkHopBigQuery() {
  try {
    console.log('🔍 Checking Hop Test BigQuery table structure...\n');

    const table = getTable('hj_results');

    // Get table schema
    const [metadata] = await table.getMetadata();
    console.log('📋 Table Schema:');
    metadata.schema.fields.forEach(field => {
      console.log(`  - ${field.name} (${field.type})`);
    });

    // Get a few sample rows
    const queryStr = `
      SELECT *
      FROM \`${datasetName}.hj_results\`
      LIMIT 5
    `;

    const rows = await query(queryStr);
    console.log(`\n📊 Sample Data (${rows.length} rows):`);
    rows.forEach((row, idx) => {
      console.log(`\n--- Row ${idx + 1} ---`);
      console.log(JSON.stringify(row, null, 2));
    });

    // Check if we have hop_rsi_avg_best_5 column
    const hasRsiColumn = metadata.schema.fields.some(f => f.name === 'hop_rsi_avg_best_5');
    console.log(`\n✅ Has hop_rsi_avg_best_5 column: ${hasRsiColumn}`);

    // Check total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`${datasetName}.hj_results\`
    `;
    const countResult = await query(countQuery);
    console.log(`\n📈 Total hop tests in BigQuery: ${countResult[0].total}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkHopBigQuery();
