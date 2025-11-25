import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';

dotenv.config();

const bigquery = new BigQuery({
  projectId: 'vald-ref-data-copy',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function checkTableSchema() {
  try {
    const datasetId = 'VALDrefDataCOPY';
    const tableId = 'HJ_result_updated';

    console.log('📊 Checking table schema for HJ_result_updated...\n');

    const [metadata] = await bigquery
      .dataset(datasetId)
      .table(tableId)
      .getMetadata();

    const schema = metadata.schema.fields;

    console.log('📋 Current columns in HJ_result_updated:');
    console.log('==========================================');

    // Filter to show hop-related columns
    const hopColumns = schema.filter(field =>
      field.name.toLowerCase().includes('hop')
    );

    console.log('\n🏃 Hop-related columns:');
    hopColumns.forEach(field => {
      console.log(`  - ${field.name} (${field.type})`);
    });

    // Check if hop_rsi_avg_best_5 exists
    const hasRegularRSI = schema.some(field => field.name === 'hop_rsi_avg_best_5');
    const hasRSI_JH = schema.some(field => field.name === 'hop_rsi_jh_avg_best_5');

    console.log('\n✅ Column Check:');
    console.log(`  hop_rsi_avg_best_5 (regular RSI): ${hasRegularRSI ? '✓ EXISTS' : '✗ MISSING'}`);
    console.log(`  hop_rsi_jh_avg_best_5 (RSI JH): ${hasRSI_JH ? '✓ EXISTS' : '✗ MISSING'}`);

    if (!hasRegularRSI) {
      console.log('\n⚠️  hop_rsi_avg_best_5 column is MISSING!');
      console.log('   You need to add this column and populate it with regular RSI values.');
      console.log('   Run the data upload script again to recalculate and add this column.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTableSchema();
