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

async function copyTable(sourceTableId, targetTableId) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📋 Copying table: ${sourceTableId}`);
  console.log('─'.repeat(70));

  try {
    // Step 1: Get schema from source
    const sourceTable = sourceBQ.dataset(SOURCE_DATASET).table(sourceTableId);
    const [sourceMetadata] = await sourceTable.getMetadata();
    const schema = sourceMetadata.schema.fields;
    const numRows = sourceMetadata.numRows || 0;

    console.log(`   📊 Source rows: ${numRows}`);
    console.log(`   📋 Schema fields: ${schema.length}`);

    // Step 2: Query all data from source
    console.log(`   🔽 Reading data from source...`);
    const query = `SELECT * FROM \`vald-ref-data.${SOURCE_DATASET}.${sourceTableId}\``;
    const [rows] = await sourceBQ.query(query);

    console.log(`   ✅ Read ${rows.length} rows from source`);

    // Step 3: Create or replace table in target
    const targetTable = targetBQ.dataset(TARGET_DATASET).table(targetTableId);

    console.log(`   🔨 Creating table in target...`);
    try {
      await targetTable.delete();
      console.log(`   ✅ Deleted existing table`);
    } catch (e) {
      // Table doesn't exist, that's fine
    }

    await targetTable.create({ schema: schema });
    console.log(`   ✅ Created table with schema`);

    // Step 4: Insert data in batches
    if (rows.length > 0) {
      console.log(`   🔼 Inserting data into target...`);

      const batchSize = 500;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await targetTable.insert(batch);
        inserted += batch.length;

        const progress = ((inserted / rows.length) * 100).toFixed(1);
        process.stdout.write(`\r   📊 Progress: ${inserted}/${rows.length} rows (${progress}%)`);
      }

      console.log(); // New line
    }

    // Step 5: Verify
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
  console.log('\n🚀 Starting BigQuery Database Copy (ETL Method)');
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
