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

async function findCountermovementDepth() {
  try {
    console.log('=== SEARCHING FOR COUNTERMOVEMENT DEPTH ===\n');

    const table = bigquery.dataset(datasetId).table('cmj_results');
    const [metadata] = await table.getMetadata();
    const allColumns = metadata.schema.fields.map(f => f.name);

    // Search for countermovement depth
    const matches = allColumns.filter(col =>
      col.toLowerCase().includes('countermovement') && col.toLowerCase().includes('depth')
    );

    if (matches.length === 0) {
      console.log('❌ NOT FOUND - No matching columns\n');
      console.log('Searching for similar columns with "depth" or "countermovement":\n');

      const depthMatches = allColumns.filter(col => col.toLowerCase().includes('depth'));
      const countermovementMatches = allColumns.filter(col => col.toLowerCase().includes('countermovement'));

      if (depthMatches.length > 0) {
        console.log('Columns with "depth":');
        depthMatches.forEach(col => console.log(`  - ${col}`));
      }

      if (countermovementMatches.length > 0) {
        console.log('\nColumns with "countermovement":');
        countermovementMatches.forEach(col => console.log(`  - ${col}`));
      }
    } else {
      console.log(`✅ FOUND ${matches.length} matching column(s):\n`);
      matches.forEach(col => {
        console.log(`  ${col}`);
      });

      // Get sample values
      console.log('\n--- Sample Values ---\n');
      const sampleQuery = `
        SELECT ${matches[0]}, full_name
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${datasetId}.cmj_results\`
        WHERE ${matches[0]} IS NOT NULL
        LIMIT 5
      `;

      const [rows] = await bigquery.query({ query: sampleQuery, location: 'US' });
      rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.full_name || 'Unknown'}: ${row[matches[0]]} cm`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

findCountermovementDepth();
