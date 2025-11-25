import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'vald-ref-data-copy',
  keyFilename: 'vald-ref-data-copy-0c0792ad4944.json'
});

async function checkTableSchema() {
  console.log('🔍 Checking table schemas in BigQuery...\n');

  try {
    const dataset = bigquery.dataset('VALDrefDataCOPY');

    // Get all tables
    const [tables] = await dataset.getTables();

    for (const table of tables) {
      console.log(`\n📊 Table: ${table.id}`);
      console.log('─'.repeat(50));

      const [metadata] = await table.getMetadata();
      const fields = metadata.schema.fields;

      console.log(`Columns (${fields.length}):`);
      fields.slice(0, 10).forEach(field => {
        console.log(`  - ${field.name} (${field.type})`);
      });

      if (fields.length > 10) {
        console.log(`  ... and ${fields.length - 10} more columns`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTableSchema();