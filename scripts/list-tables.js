import { bigquery, dataset } from '../server/config/bigquery.js';
import dotenv from 'dotenv';

dotenv.config();

async function listTables() {
  console.log('\n📊 Listing all tables in dataset...\n');

  const [tables] = await bigquery.dataset(dataset).getTables();

  for (const table of tables) {
    console.log(`\n🗂️  Table: ${table.id}`);

    // Get metadata
    const [metadata] = await table.getMetadata();
    console.log(`   Rows: ${metadata.numRows || '0'}`);
    console.log(`   Created: ${new Date(parseInt(metadata.creationTime)).toLocaleString()}`);

    // Get schema
    if (metadata.schema && metadata.schema.fields) {
      console.log(`   Columns (${metadata.schema.fields.length}):`,
        metadata.schema.fields.slice(0, 10).map(f => f.name).join(', ') +
        (metadata.schema.fields.length > 10 ? '...' : ''));
    }
  }
}

listTables().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
