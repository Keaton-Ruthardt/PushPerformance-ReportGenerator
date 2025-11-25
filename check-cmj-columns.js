import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'vald-ref-data-copy',
  keyFilename: 'vald-ref-data-copy-0c0792ad4944.json'
});

async function checkCMJColumns() {
  console.log('🔍 Checking CMJ table columns...\n');

  try {
    // Query to check for jump-related columns
    const query = `
      SELECT *
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.cmj_results\`
      LIMIT 1
    `;

    const [rows] = await bigquery.query(query);

    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);

      console.log('Jump-related columns:');
      columns.filter(col =>
        col.toLowerCase().includes('jump') ||
        col.toLowerCase().includes('height') ||
        col.toLowerCase().includes('power') ||
        col.toLowerCase().includes('force') ||
        col.toLowerCase().includes('rsi')
      ).forEach(col => {
        const value = rows[0][col];
        console.log(`  - ${col}: ${value !== null ? value : 'null'}`);
      });

      console.log('\n\nAll columns (alphabetical):');
      columns.sort().forEach(col => {
        console.log(`  - ${col}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCMJColumns();