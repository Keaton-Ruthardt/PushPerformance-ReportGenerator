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

async function findCMJColumns() {
  try {
    console.log('=== SEARCHING FOR SPECIFIC CMJ METRICS ===\n');

    const table = bigquery.dataset(datasetId).table('cmj_results');
    const [metadata] = await table.getMetadata();
    const allColumns = metadata.schema.fields.map(f => f.name);

    // Metrics to find
    const metricsToFind = [
      'Jump Height',
      'Eccentric Braking RFD',
      'Force at Zero Velocity',
      'Eccentric Peak Force',
      'Concentric Impulse',
      'Eccentric Peak Velocity',
      'Concentric Peak Velocity',
      'Eccentric Peak Power',
      'Eccentric Peak Power / BM',
      'Peak Power',
      'Peak Power / BM',
      'RSI-mod'
    ];

    const searchTerms = {
      'Jump Height': ['JUMP_HEIGHT', 'JUMP.*HEIGHT'],
      'Eccentric Braking RFD': ['ECCENTRIC_BRAKING_RFD', 'ECC.*BRAKING.*RFD'],
      'Force at Zero Velocity': ['FORCE.*ZERO.*VELOCITY', 'ZERO_VELOCITY'],
      'Eccentric Peak Force': ['PEAK_ECCENTRIC_FORCE', 'ECCENTRIC.*PEAK.*FORCE'],
      'Concentric Impulse': ['CONCENTRIC_IMPULSE(?!.*100|.*50|.*P1|.*P2)', '^CONCENTRIC_IMPULSE_Trial'],
      'Eccentric Peak Velocity': ['ECCENTRIC.*PEAK.*VELOCITY', 'PEAK.*ECCENTRIC.*VELOCITY'],
      'Concentric Peak Velocity': ['CONCENTRIC.*PEAK.*VELOCITY', 'PEAK.*CONCENTRIC.*VELOCITY'],
      'Eccentric Peak Power': ['ECCENTRIC.*PEAK.*POWER(?!.*BM|.*RELATIVE)', 'PEAK.*ECCENTRIC.*POWER(?!.*REL)'],
      'Eccentric Peak Power / BM': ['BODYMASS.*ECCENTRIC.*PEAK.*POWER', 'ECCENTRIC.*PEAK.*POWER.*BM', 'RELATIVE.*ECCENTRIC.*PEAK'],
      'Peak Power': ['PEAK.*POWER(?!.*BM|.*RELATIVE|.*CONCENTRIC|.*ECCENTRIC|.*TAKEOFF|.*LANDING)', '^PEAK_POWER_Trial'],
      'Peak Power / BM': ['BODYMASS.*PEAK.*POWER', 'PEAK.*POWER.*BM', 'RELATIVE.*PEAK.*POWER'],
      'RSI-mod': ['RSI.*MOD', 'RSI_MODIFIED']
    };

    console.log('Searching through 244 columns...\n');

    for (const metric of metricsToFind) {
      console.log(`${'='.repeat(80)}`);
      console.log(`METRIC: ${metric}`);
      console.log('='.repeat(80));

      const patterns = searchTerms[metric];
      let found = [];

      for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'i');
        const matches = allColumns.filter(col => regex.test(col));
        found = [...new Set([...found, ...matches])]; // Remove duplicates
      }

      if (found.length === 0) {
        console.log('❌ NOT FOUND - No matching columns');
        console.log('\nPossible related columns:');
        // Try a more general search
        const generalTerms = metric.split(' ').filter(t => t.length > 3);
        const generalMatches = allColumns.filter(col => {
          return generalTerms.some(term => col.toLowerCase().includes(term.toLowerCase()));
        });
        if (generalMatches.length > 0) {
          generalMatches.slice(0, 10).forEach(col => console.log(`  - ${col}`));
        } else {
          console.log('  (None found)');
        }
      } else {
        console.log(`✅ FOUND ${found.length} matching column(s):\n`);
        found.forEach(col => {
          console.log(`  ${col}`);
        });

        // Show a sample value
        const sampleQuery = `
          SELECT ${found[0]}
          FROM \`${process.env.BIGQUERY_PROJECT_ID}.${datasetId}.cmj_results\`
          WHERE ${found[0]} IS NOT NULL
          LIMIT 1
        `;
        try {
          const [rows] = await bigquery.query({ query: sampleQuery, location: 'US' });
          if (rows.length > 0) {
            console.log(`\n  Sample value: ${rows[0][found[0]]}`);
          }
        } catch (err) {
          // Ignore sample query errors
        }
      }
      console.log('');
    }

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY - RECOMMENDED COLUMNS FOR PDF REPORT');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

findCMJColumns();
