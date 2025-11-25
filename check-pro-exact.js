import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'vald-ref-data-copy',
  keyFilename: 'vald-ref-data-copy-0c0792ad4944.json'
});

async function checkProExact() {
  console.log('🔍 Comparing case-sensitive vs case-insensitive queries\n');

  try {
    // Query 1: Case-insensitive (current approach)
    const query1 = `
      SELECT COUNT(*) as count
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.cmj_results\`
      WHERE (UPPER(group_name_1) LIKE '%MLB%'
         OR UPPER(group_name_1) LIKE '%MILB%'
         OR UPPER(group_name_1) LIKE '%PRO%')
    `;

    console.log('Case-INSENSITIVE query (with UPPER):');
    const [result1] = await bigquery.query(query1);
    console.log(`  Found: ${result1[0].count} tests\n`);

    // Query 2: Exact match only
    const query2 = `
      SELECT COUNT(*) as count
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.cmj_results\`
      WHERE group_name_1 IN ('MLB/ MiLB', 'Pro', 'Pro Golf ')
    `;

    console.log('EXACT match query:');
    const [result2] = await bigquery.query(query2);
    console.log(`  Found: ${result2[0].count} tests\n`);

    // Query 3: Case-sensitive LIKE
    const query3 = `
      SELECT COUNT(*) as count
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.cmj_results\`
      WHERE (group_name_1 LIKE '%MLB%'
         OR group_name_1 LIKE '%MiLB%'
         OR group_name_1 LIKE '%Pro%')
    `;

    console.log('Case-SENSITIVE query (without UPPER):');
    const [result3] = await bigquery.query(query3);
    console.log(`  Found: ${result3[0].count} tests\n`);

    // Show all unique group_name_1 values that contain these terms
    const query4 = `
      SELECT DISTINCT group_name_1, COUNT(*) as count
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.cmj_results\`
      WHERE (UPPER(group_name_1) LIKE '%MLB%'
         OR UPPER(group_name_1) LIKE '%MILB%'
         OR UPPER(group_name_1) LIKE '%PRO%')
      GROUP BY group_name_1
      ORDER BY group_name_1
    `;

    console.log('All matching group names:');
    console.log('─'.repeat(40));
    const [result4] = await bigquery.query(query4);
    result4.forEach(row => {
      console.log(`  "${row.group_name_1}": ${row.count} tests`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProExact();