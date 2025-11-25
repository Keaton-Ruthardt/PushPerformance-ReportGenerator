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

async function checkGroupNames() {
  try {
    console.log('=== CHECKING GROUP NAMES IN CMJ RESULTS ===\n');

    // Get all unique group names
    const sql = `
      SELECT
        group_name_1,
        COUNT(*) as count
      FROM \`vald-ref-data-copy.${datasetId}.cmj_results\`
      WHERE group_name_1 IS NOT NULL
      GROUP BY group_name_1
      ORDER BY count DESC
      LIMIT 20
    `;

    const [rows] = await bigquery.query({ query: sql, location: 'US' });

    if (rows.length === 0) {
      console.log('❌ No group_name_1 values found');
    } else {
      console.log(`✅ Found ${rows.length} unique group names:\n`);
      rows.forEach((row, i) => {
        console.log(`${i + 1}. "${row.group_name_1}" - ${row.count} tests`);
      });
    }

    // Also check for MLB/MiLB related names
    console.log('\n=== SEARCHING FOR PRO/MLB/MILB RELATED GROUPS ===\n');
    const proSql = `
      SELECT
        group_name_1,
        COUNT(*) as count
      FROM \`vald-ref-data-copy.${datasetId}.cmj_results\`
      WHERE group_name_1 IS NOT NULL
        AND (
          LOWER(group_name_1) LIKE '%pro%'
          OR LOWER(group_name_1) LIKE '%mlb%'
          OR LOWER(group_name_1) LIKE '%milb%'
        )
      GROUP BY group_name_1
      ORDER BY count DESC
    `;

    const [proRows] = await bigquery.query({ query: proSql, location: 'US' });

    if (proRows.length === 0) {
      console.log('❌ No pro/MLB/MiLB group names found');
    } else {
      console.log(`✅ Found ${proRows.length} pro-related group names:\n`);
      proRows.forEach((row, i) => {
        console.log(`${i + 1}. "${row.group_name_1}" - ${row.count} tests`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkGroupNames();
