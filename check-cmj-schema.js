import { bigquery, dataset } from './server/config/bigquery.js';

async function checkSchema() {
  console.log('🔍 Checking CMJ table schema...\n');

  const table = bigquery.dataset(dataset).table('cmj_results');

  try {
    const [metadata] = await table.getMetadata();

    console.log('📋 CMJ Results Table Columns:');
    console.log('='.repeat(60));

    metadata.schema.fields.forEach((field, index) => {
      console.log(`${index + 1}. ${field.name} (${field.type})`);
    });

    console.log('\n✅ Schema retrieved successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSchema();
