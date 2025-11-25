import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const bigquery = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID || 'vald-ref-data-copy',
  keyFilename: join(__dirname, process.env.BIGQUERY_KEYFILE || 'vald-ref-data-copy-0c0792ad4944.json')
});

const datasetId = process.env.BIGQUERY_DATASET || 'VALDrefDataCOPY';

async function checkCMJTables() {
  try {
    console.log('=== CHECKING CMJ TABLES IN BIGQUERY ===\n');
    console.log(`Project: ${process.env.BIGQUERY_PROJECT_ID}`);
    console.log(`Dataset: ${datasetId}\n`);

    // Get all tables in the dataset
    console.log('1. Finding all tables in dataset...');
    const [tables] = await bigquery.dataset(datasetId).getTables();

    const cmjTables = tables.filter(table =>
      table.id.toLowerCase().includes('cmj')
    );

    if (cmjTables.length === 0) {
      console.log('❌ No CMJ tables found');
      console.log('\nAll available tables:');
      tables.forEach(table => console.log(`  - ${table.id}`));
      return;
    }

    console.log(`✅ Found ${cmjTables.length} CMJ-related table(s):\n`);

    // Examine each CMJ table
    for (const table of cmjTables) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`TABLE: ${table.id}`);
      console.log('='.repeat(80));

      // Get table metadata
      const [metadata] = await table.getMetadata();
      console.log(`\nRows: ${metadata.numRows || 'Unknown'}`);
      console.log(`Created: ${metadata.creationTime ? new Date(parseInt(metadata.creationTime)).toLocaleString() : 'Unknown'}`);
      console.log(`Last Modified: ${metadata.lastModifiedTime ? new Date(parseInt(metadata.lastModifiedTime)).toLocaleString() : 'Unknown'}`);

      // Get schema
      console.log(`\n--- SCHEMA (${metadata.schema.fields.length} columns) ---`);
      metadata.schema.fields.forEach((field, i) => {
        console.log(`${i + 1}. ${field.name} (${field.type})${field.mode === 'REQUIRED' ? ' *REQUIRED*' : ''}`);
      });

      // Get sample data
      console.log('\n--- SAMPLE DATA (first 3 rows) ---');
      const query = `
        SELECT *
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${datasetId}.${table.id}\`
        LIMIT 3
      `;

      try {
        const [rows] = await bigquery.query({ query, location: 'US' });

        if (rows.length > 0) {
          rows.forEach((row, i) => {
            console.log(`\nRow ${i + 1}:`);
            Object.keys(row).forEach(key => {
              let value = row[key];
              if (value === null || value === undefined) {
                value = 'NULL';
              } else if (typeof value === 'object') {
                value = JSON.stringify(value);
              }
              console.log(`  ${key}: ${value}`);
            });
          });
        } else {
          console.log('  (No data in table)');
        }
      } catch (err) {
        console.log(`  Error fetching sample data: ${err.message}`);
      }

      // Get row count by test type if applicable
      if (metadata.schema.fields.some(f => f.name.toLowerCase() === 'test_type')) {
        console.log('\n--- TEST TYPE DISTRIBUTION ---');
        const countQuery = `
          SELECT test_type, COUNT(*) as count
          FROM \`${process.env.BIGQUERY_PROJECT_ID}.${datasetId}.${table.id}\`
          GROUP BY test_type
          ORDER BY count DESC
        `;
        try {
          const [countRows] = await bigquery.query({ query: countQuery, location: 'US' });
          countRows.forEach(row => {
            console.log(`  ${row.test_type}: ${row.count} rows`);
          });
        } catch (err) {
          console.log(`  Error: ${err.message}`);
        }
      }
    }

    console.log(`\n${'='.repeat(80)}\n`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  }
}

checkCMJTables();
