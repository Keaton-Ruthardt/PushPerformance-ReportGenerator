import 'dotenv/config';
import { query, dataset } from '../server/config/bigquery.js';

async function findSLJ() {
  try {
    // First get all distinct test types
    console.log('Getting all test types from BigQuery...\n');

    const sql1 = `
      SELECT DISTINCT test_type, COUNT(*) as count
      FROM \`vald-ref-data-copy.${dataset}.cmj_results\`
      GROUP BY test_type
      ORDER BY count DESC
    `;

    const testTypes = await query(sql1);
    console.log('All test types:');
    testTypes.forEach(r => console.log(`  ${r.test_type}: ${r.count}`));

    // Filter for SLJ-related
    console.log('\n\nSLJ-related test types:');
    testTypes
      .filter(r => {
        const t = (r.test_type || '').toLowerCase();
        return t.includes('single') || t.includes('slj') || t.includes('sl ');
      })
      .forEach(r => console.log(`  ${r.test_type}: ${r.count}`));

    // Get sample athletes with SLJ
    console.log('\n\nSearching for athletes with SLJ tests...');
    const sql2 = `
      SELECT full_name, profile_id, test_type, test_date
      FROM \`vald-ref-data-copy.${dataset}.cmj_results\`
      WHERE LOWER(test_type) LIKE '%single%'
         OR LOWER(test_type) LIKE '%slj%'
      ORDER BY test_date DESC
      LIMIT 15
    `;

    const athletes = await query(sql2);
    console.log('\nSample athletes with SLJ:');
    athletes.forEach(a => {
      const dateStr = a.test_date ? a.test_date.value : 'unknown';
      console.log(`  ${a.full_name} (${a.profile_id}) - ${a.test_type} on ${dateStr}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

findSLJ();
