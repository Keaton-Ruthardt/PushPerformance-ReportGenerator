import { BigQuery } from '@google-cloud/bigquery';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const targetBQ = new BigQuery({
  projectId: 'vald-ref-data-copy',
  keyFilename: join(__dirname, '..', 'vald-ref-data-copy-0c0792ad4944.json')
});

async function checkDatasets() {
  console.log('📊 Checking datasets in vald-ref-data-copy project...\n');

  try {
    const [datasets] = await targetBQ.getDatasets();

    if (datasets.length === 0) {
      console.log('❌ No datasets found.');
      console.log('\n💡 You need to either:');
      console.log('   1. Create the VALDrefDataCOPY dataset in the Google Cloud Console');
      console.log('   2. Grant the service account permissions to create datasets');
    } else {
      console.log(`✅ Found ${datasets.length} dataset(s):\n`);
      datasets.forEach(dataset => {
        console.log(`   - ${dataset.id}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDatasets();
