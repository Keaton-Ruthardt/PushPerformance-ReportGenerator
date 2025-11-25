import { BigQuery } from '@google-cloud/bigquery';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const targetBQ = new BigQuery({
  projectId: 'vald-ref-data-copy',
  keyFilename: join(__dirname, '..', 'vald-ref-data-copy-0c0792ad4944.json')
});

async function verifyData() {
  console.log('🔍 Verifying copied data...\n');

  try {
    const dataset = targetBQ.dataset('VALDrefDataCOPY');
    const [tables] = await dataset.getTables();

    console.log(`✅ Found ${tables.length} tables in target dataset:\n`);

    for (const table of tables) {
      const [metadata] = await table.getMetadata();
      const numRows = metadata.numRows || 0;
      console.log(`   📊 ${table.id.padEnd(25)} - ${numRows.toLocaleString().padStart(6)} rows`);
    }

    console.log('\n✅ Verification complete!');
    console.log(`\n🔗 View at: https://console.cloud.google.com/bigquery?project=vald-ref-data-copy&d=VALDrefDataCOPY`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyData();
