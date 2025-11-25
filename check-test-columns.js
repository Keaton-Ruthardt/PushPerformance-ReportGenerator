import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'vald-ref-data-copy',
  keyFilename: 'vald-ref-data-copy-0c0792ad4944.json'
});

async function checkTestColumns() {
  console.log('🔍 Checking test table columns...\n');

  const tables = ['hj_results', 'imtp_results', 'ppu_results'];

  for (const tableName of tables) {
    console.log(`\n📊 Table: ${tableName}`);
    console.log('─'.repeat(50));

    try {
      const query = `
        SELECT *
        FROM \`vald-ref-data-copy.VALDrefDataCOPY.${tableName}\`
        WHERE (UPPER(group_name_1) LIKE '%MLB%' OR UPPER(group_name_1) LIKE '%MILB%' OR UPPER(group_name_1) LIKE '%PRO%')
        LIMIT 1
      `;

      const [rows] = await bigquery.query(query);

      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);

        console.log('Key metrics columns:');

        if (tableName === 'hj_results') {
          columns.filter(col =>
            col.toLowerCase().includes('hj') ||
            col.toLowerCase().includes('jump') ||
            col.toLowerCase().includes('distance') ||
            col.toLowerCase().includes('max') ||
            col.toLowerCase().includes('avg')
          ).forEach(col => {
            const value = rows[0][col];
            console.log(`  - ${col}: ${value !== null ? value : 'null'}`);
          });
        } else if (tableName === 'imtp_results') {
          columns.filter(col =>
            col.toLowerCase().includes('peak') ||
            col.toLowerCase().includes('force') ||
            col.toLowerCase().includes('rfd') ||
            col.toLowerCase().includes('net')
          ).slice(0, 15).forEach(col => {
            const value = rows[0][col];
            console.log(`  - ${col}: ${value !== null ? value : 'null'}`);
          });
        } else if (tableName === 'ppu_results') {
          columns.filter(col =>
            col.toLowerCase().includes('ppu') ||
            col.toLowerCase().includes('peak') ||
            col.toLowerCase().includes('force') ||
            col.toLowerCase().includes('power') ||
            col.toLowerCase().includes('push')
          ).forEach(col => {
            const value = rows[0][col];
            console.log(`  - ${col}: ${value !== null ? value : 'null'}`);
          });
        }

        console.log(`\nTotal columns: ${columns.length}`);
      } else {
        console.log('No professional athlete data found in this table');
      }

    } catch (error) {
      console.error(`❌ Error with ${tableName}:`, error.message);
    }
  }
}

checkTestColumns();