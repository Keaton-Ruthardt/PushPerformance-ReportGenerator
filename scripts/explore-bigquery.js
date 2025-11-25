import { BigQuery } from '@google-cloud/bigquery';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize BigQuery client with service account credentials
const bigquery = new BigQuery({
  projectId: 'vald-ref-data',
  keyFilename: join(__dirname, 'vald-bigquery-credentials.json')
});

async function exploreBigQuery() {
  console.log('🔍 Connecting to BigQuery project: vald-ref-data\n');

  try {
    // List all datasets
    console.log('📊 Available Datasets:');
    console.log('─'.repeat(50));
    const [datasets] = await bigquery.getDatasets();

    if (datasets.length === 0) {
      console.log('No datasets found in this project.');
      return;
    }

    for (const dataset of datasets) {
      console.log(`\n📁 Dataset: ${dataset.id}`);

      // List tables in each dataset
      const [tables] = await dataset.getTables();

      if (tables.length === 0) {
        console.log('   No tables found');
      } else {
        console.log('   Tables:');
        for (const table of tables) {
          console.log(`   ├─ ${table.id}`);

          // Get table metadata
          const [metadata] = await table.getMetadata();
          const numRows = metadata.numRows || 0;
          console.log(`   │  Rows: ${numRows}`);
        }
      }
    }

    console.log('\n' + '─'.repeat(50));
    console.log('\n✅ Successfully connected to BigQuery!\n');

    // Example query - uncomment and modify as needed
    console.log('💡 Example: To run a query, use:');
    console.log(`
const query = \`SELECT * FROM \\\`vald-ref-data.your_dataset.your_table\\\` LIMIT 10\`;
const [rows] = await bigquery.query(query);
console.log('Query results:', rows);
    `);

  } catch (error) {
    console.error('❌ Error accessing BigQuery:', error.message);
    if (error.code === 404) {
      console.log('\n💡 Tip: Make sure your Google account has been granted access to the "vald-ref-data" project.');
    }
  }
}

// Run the exploration
exploreBigQuery();
