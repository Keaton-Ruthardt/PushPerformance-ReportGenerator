import { BigQuery } from '@google-cloud/bigquery';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use source credentials (which has read access to source)
const sourceBQ = new BigQuery({
  projectId: 'vald-ref-data',
  keyFilename: join(__dirname, '..', 'vald-bigquery-credentials.json')
});

const SOURCE_DATASET = 'athlete_performance_db';
const TARGET_DATASET = 'VALDrefDataCOPY';

async function copyTable(sourceTableId, targetTableId) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📋 Copying table: ${sourceTableId}`);
  console.log('─'.repeat(70));

  try {
    // Get source table info
    const sourceTable = sourceBQ.dataset(SOURCE_DATASET).table(sourceTableId);
    const [sourceMetadata] = await sourceTable.getMetadata();
    const numRows = sourceMetadata.numRows || 0;

    console.log(`   📊 Source rows: ${numRows}`);

    // Use CREATE TABLE AS SELECT to copy data
    // This runs the query in the source project but writes to target project
    const copyQuery = `
      CREATE OR REPLACE TABLE \`vald-ref-data-copy.${TARGET_DATASET}.${targetTableId}\`
      AS SELECT * FROM \`vald-ref-data.${SOURCE_DATASET}.${sourceTableId}\`
    `;

    console.log(`   🔄 Running copy query...`);

    // Execute using source credentials
    const [job] = await sourceBQ.createQueryJob({
      query: copyQuery,
      location: 'US'
    });

    console.log(`   ⏳ Job ID: ${job.id}`);
    console.log(`   ⏳ Waiting for completion...`);

    // Wait for the query to finish
    await job.getQueryResults();

    console.log(`   ✅ Copy completed successfully!`);

    return { success: true, rows: parseInt(numRows) };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function copyDatabase() {
  console.log('\n🚀 Starting BigQuery Database Copy');
  console.log('='.repeat(70));
  console.log(`Source: vald-ref-data.${SOURCE_DATASET} (READ-ONLY)`);
  console.log(`Target: vald-ref-data-copy.${TARGET_DATASET} (WRITE-ONLY)`);
  console.log('='.repeat(70));

  const stats = {
    totalTables: 0,
    successfulCopies: 0,
    failedCopies: 0,
    totalRowsCopied: 0,
    errors: []
  };

  try {
    // Get all tables from source dataset
    console.log(`\n📋 Fetching tables from source dataset...`);
    const sourceDataset = sourceBQ.dataset(SOURCE_DATASET);
    const [tables] = await sourceDataset.getTables();

    stats.totalTables = tables.length;
    console.log(`✅ Found ${tables.length} tables to copy\n`);

    // Copy each table
    for (const table of tables) {
      const tableId = table.id;
      const result = await copyTable(tableId, tableId);

      if (result.success) {
        stats.successfulCopies++;
        stats.totalRowsCopied += result.rows;
      } else {
        stats.failedCopies++;
        stats.errors.push({ table: tableId, error: result.error });
      }
    }

    // Print final summary
    console.log('\n\n' + '='.repeat(70));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Successfully copied: ${stats.successfulCopies}/${stats.totalTables} tables`);
    console.log(`📊 Total rows copied: ${stats.totalRowsCopied.toLocaleString()}`);

    if (stats.failedCopies > 0) {
      console.log(`\n❌ Failed copies: ${stats.failedCopies}`);
      stats.errors.forEach(err => {
        console.log(`   - ${err.table}: ${err.error}`);
      });
    } else {
      console.log('\n🎉 All tables copied successfully!');
      console.log(`\n🔗 View your data at:`);
      console.log(`https://console.cloud.google.com/bigquery?project=vald-ref-data-copy&d=${TARGET_DATASET}`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error.message);
    console.error(error);
  }
}

// Run the copy operation
copyDatabase();
