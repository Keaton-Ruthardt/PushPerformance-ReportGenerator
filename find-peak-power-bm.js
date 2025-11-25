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

async function findPeakPowerBM() {
  try {
    console.log('=== SEARCHING FOR PEAK TAKEOFF POWER / BM ===\n');

    const table = bigquery.dataset(datasetId).table('cmj_results');
    const [metadata] = await table.getMetadata();
    const allColumns = metadata.schema.fields.map(f => f.name);

    // Search for body mass relative peak takeoff power
    const matches = allColumns.filter(col =>
      (col.toLowerCase().includes('bodymass') || col.toLowerCase().includes('relative')) &&
      col.toLowerCase().includes('takeoff') &&
      col.toLowerCase().includes('power')
    );

    if (matches.length === 0) {
      console.log('❌ NOT FOUND\n');
      console.log('Searching for any relative/bodymass power columns:\n');
      const powerMatches = allColumns.filter(col =>
        (col.toLowerCase().includes('bodymass') || col.toLowerCase().includes('relative')) &&
        col.toLowerCase().includes('power')
      );
      powerMatches.forEach(col => console.log(`  - ${col}`));
    } else {
      console.log(`✅ FOUND ${matches.length} matching column(s):\n`);
      matches.forEach(col => {
        console.log(`  ${col}`);
      });

      // Get sample value
      console.log('\n--- Sample Value ---\n');
      const sampleQuery = `
        SELECT ${matches[0]}, PEAK_TAKEOFF_POWER_Trial_W, full_name
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${datasetId}.cmj_results\`
        WHERE ${matches[0]} IS NOT NULL
        LIMIT 3
      `;

      const [rows] = await bigquery.query({ query: sampleQuery, location: 'US' });
      rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.full_name || 'Unknown'}`);
        console.log(`   Peak Takeoff Power: ${row.PEAK_TAKEOFF_POWER_Trial_W} W`);
        console.log(`   Peak Takeoff Power / BM: ${row[matches[0]]} W/kg\n`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

findPeakPowerBM();
