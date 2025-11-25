import { bigquery, dataset } from '../server/config/bigquery.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkIMTPSchema() {
  console.log('\n🔍 Checking IMTP table schema...\n');

  try {
    const table = bigquery.dataset(dataset).table('imtp_results');
    const [metadata] = await table.getMetadata();

    console.log('📊 IMTP Table Schema:\n');
    metadata.schema.fields.forEach(field => {
      console.log(`  ${field.name} (${field.type}${field.mode ? ', ' + field.mode : ''})`);
    });

    console.log('\n✅ Schema retrieved successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkIMTPSchema().then(() => process.exit(0));
