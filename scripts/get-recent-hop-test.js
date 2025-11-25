import 'dotenv/config';
import { query, dataset as datasetName } from '../server/config/bigquery.js';

async function getRecentHopTest() {
  try {
    console.log('🔍 Getting recent Hop Test IDs from BigQuery...\n');

    // Get the 10 most recent hop tests
    const queryStr = `
      SELECT test_id, full_name, test_date
      FROM \`${datasetName}.hj_results\`
      ORDER BY test_date DESC
      LIMIT 10
    `;

    const rows = await query(queryStr);
    console.log(`📊 Found ${rows.length} recent hop tests:\n`);

    rows.forEach((row, idx) => {
      console.log(`${idx + 1}. Test ID: ${row.test_id}`);
      console.log(`   Athlete: ${row.full_name}`);
      console.log(`   Date: ${row.test_date}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

getRecentHopTest();
