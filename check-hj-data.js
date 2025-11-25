import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'vald-ref-data-copy',
  keyFilename: 'vald-ref-data-copy-0c0792ad4944.json'
});

async function checkHJData() {
  console.log('🔍 Checking HJ table data...\n');

  try {
    const query = `
      SELECT *
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.hj_results\`
      WHERE (UPPER(group_name_1) LIKE '%MLB%' OR UPPER(group_name_1) LIKE '%MILB%' OR UPPER(group_name_1) LIKE '%PRO%')
      LIMIT 5
    `;

    const [rows] = await bigquery.query(query);

    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);

      console.log('All columns in HJ table:');
      columns.forEach(col => {
        console.log(`  - ${col}`);
      });

      console.log('\n\nSample data (first row):');
      const firstRow = rows[0];
      Object.entries(firstRow).forEach(([key, value]) => {
        if (value !== null && value !== '') {
          console.log(`  ${key}: ${value}`);
        }
      });

      console.log('\n\nNumeric columns with sample values:');
      Object.entries(firstRow).forEach(([key, value]) => {
        if (typeof value === 'number' && value !== null) {
          console.log(`  ${key}: ${value}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkHJData();