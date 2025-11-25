import { BigQuery } from '@google-cloud/bigquery';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize BigQuery clients for source and target
const sourceBQ = new BigQuery({
  projectId: 'vald-ref-data',
  keyFilename: join(__dirname, '..', 'vald-bigquery-credentials.json')
});

const targetBQ = new BigQuery({
  projectId: 'vald-ref-data-copy',
  keyFilename: join(__dirname, '..', 'vald-ref-data-copy-0c0792ad4944.json')
});

const SOURCE_DATASET = 'athlete_performance_db';
const TARGET_DATASET = 'VALDrefDataCOPY';

async function ensureDatasetExists() {
  console.log(`\n📁 Checking if target dataset '${TARGET_DATASET}' exists...`);

  try {
    const dataset = targetBQ.dataset(TARGET_DATASET);
    const [exists] = await dataset.exists();

    if (!exists) {
      console.log(`   Creating dataset '${TARGET_DATASET}'...`);
      await targetBQ.createDataset(TARGET_DATASET, {
        location: 'US' // Match the source dataset location
      });
      console.log(`   ✅ Dataset created successfully`);
    } else {
      console.log(`   ✅ Dataset already exists`);
    }
  } catch (error) {
    console.error(`   ❌ Error with dataset: ${error.message}`);
    throw error;
  }
}

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
    console.log(`   🔄 Starting copy operation...`);

    // Use CREATE TABLE AS SELECT for cross-project copy
    const sourceTableRef = `\`vald-ref-data.${SOURCE_DATASET}.${sourceTableId}\``;
    const targetTableRef = `\`vald-ref-data-copy.${TARGET_DATASET}.${targetTableId}\``;

    const query = `
      CREATE OR REPLACE TABLE ${targetTableRef}
      AS SELECT * FROM ${sourceTableRef}
    `;

    console.log(`   ⏳ Running query to copy data...`);

    // Execute the query using the target BigQuery client
    const [job] = await targetBQ.createQueryJob({
      query: query,
      location: 'US'
    });

    console.log(`   ⏳ Job created: ${job.id}`);
    console.log(`   ⏳ Waiting for copy to complete...`);

    // Wait for the job to finish
    await job.getQueryResults();

    // Verify the copy
    const targetTable = targetBQ.dataset(TARGET_DATASET).table(targetTableId);
    const [targetMetadata] = await targetTable.getMetadata();
    const targetRows = targetMetadata.numRows || 0;

    console.log(`   ✅ Copy completed successfully!`);
    console.log(`   📊 Target rows: ${targetRows}`);

    if (parseInt(numRows) === parseInt(targetRows)) {
      console.log(`   ✅ Row count matches!`);
    } else {
      console.log(`   ⚠️  Warning: Row count mismatch (Source: ${numRows}, Target: ${targetRows})`);
    }

    return { success: true, rows: parseInt(targetRows) };
  } catch (error) {
    console.error(`   ❌ Error copying table: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function copyDatabase() {
  console.log('\n🚀 Starting BigQuery Database Copy');
  console.log('='.repeat(70));
  console.log(`Source: vald-ref-data.${SOURCE_DATASET}`);
  console.log(`Target: vald-ref-data-copy.${TARGET_DATASET}`);
  console.log('='.repeat(70));

  const stats = {
    totalTables: 0,
    successfulCopies: 0,
    failedCopies: 0,
    totalRowsCopied: 0,
    errors: []
  };

  try {
    // Ensure target dataset exists
    await ensureDatasetExists();

    // Get all tables from source dataset
    console.log(`\n📋 Fetching tables from source dataset...`);
    const sourceDataset = sourceBQ.dataset(SOURCE_DATASET);
    const [tables] = await sourceDataset.getTables();

    stats.totalTables = tables.length;
    console.log(`✅ Found ${tables.length} tables to copy\n`);

    // Copy each table
    for (const table of tables) {
      const tableId = table.id;
      const result = await copyTable(tableId, tableId); // Keep same table name

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
