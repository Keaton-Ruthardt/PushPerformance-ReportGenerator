import { BigQuery } from '@google-cloud/bigquery';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const targetBQ = new BigQuery({
  projectId: 'vald-ref-data-copy',
  keyFilename: join(__dirname, '..', 'vald-ref-data-copy-0c0792ad4944.json')
});

async function testPermissions() {
  console.log('🔍 Testing service account permissions...\n');

  try {
    // Test 1: Can we list datasets?
    console.log('Test 1: Listing datasets...');
    const [datasets] = await targetBQ.getDatasets();
    console.log(`✅ Can list datasets (found ${datasets.length})\n`);

    // Test 2: Can we access the dataset?
    console.log('Test 2: Accessing VALDrefDataCOPY dataset...');
    const dataset = targetBQ.dataset('VALDrefDataCOPY');
    const [exists] = await dataset.exists();
    console.log(`✅ Dataset exists: ${exists}\n`);

    // Test 3: Can we create a test table?
    console.log('Test 3: Attempting to create a test table...');
    const testTable = dataset.table('test_permissions_table');

    try {
      await testTable.create({
        schema: [
          { name: 'test_column', type: 'STRING' }
        ]
      });
      console.log('✅ Successfully created test table!\n');

      // Clean up
      console.log('Cleaning up test table...');
      await testTable.delete();
      console.log('✅ Test table deleted\n');

      console.log('🎉 All permissions are working correctly!');
    } catch (createError) {
      console.log(`❌ Cannot create table: ${createError.message}\n`);

      // Test 4: Can we read dataset metadata?
      console.log('Test 4: Reading dataset metadata...');
      const [metadata] = await dataset.getMetadata();
      console.log('Dataset location:', metadata.location);
      console.log('Dataset access:', JSON.stringify(metadata.access, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPermissions();
