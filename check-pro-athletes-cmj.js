import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'vald-ref-data-copy',
  keyFilename: 'vald-ref-data-copy-0c0792ad4944.json'
});

async function checkProAthletesCMJ() {
  console.log('🔍 Checking Professional Athletes in CMJ Table\n');

  try {
    // Query 1: Count total tests from professional athletes
    const query1 = `
      SELECT
        COUNT(*) as total_tests,
        COUNT(DISTINCT profile_id) as unique_athletes,
        COUNT(DISTINCT full_name) as unique_names
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.cmj_results\`
      WHERE (UPPER(group_name_1) LIKE '%MLB%'
         OR UPPER(group_name_1) LIKE '%MILB%'
         OR UPPER(group_name_1) LIKE '%PRO%')
    `;

    console.log('Query 1: Professional athlete counts');
    console.log('─'.repeat(50));
    const [result1] = await bigquery.query(query1);
    console.log(`Total CMJ tests from pros: ${result1[0].total_tests}`);
    console.log(`Unique professional athletes: ${result1[0].unique_athletes}`);
    console.log(`Unique names: ${result1[0].unique_names}`);

    // Query 2: Break down by group_name_1
    const query2 = `
      SELECT
        group_name_1,
        COUNT(*) as test_count,
        COUNT(DISTINCT profile_id) as athlete_count
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.cmj_results\`
      WHERE (UPPER(group_name_1) LIKE '%MLB%'
         OR UPPER(group_name_1) LIKE '%MILB%'
         OR UPPER(group_name_1) LIKE '%PRO%')
      GROUP BY group_name_1
      ORDER BY test_count DESC
    `;

    console.log('\n\nQuery 2: Breakdown by organization');
    console.log('─'.repeat(50));
    const [result2] = await bigquery.query(query2);
    result2.forEach(row => {
      console.log(`${row.group_name_1}: ${row.test_count} tests, ${row.athlete_count} athletes`);
    });

    // Query 3: Total in entire table (for comparison)
    const query3 = `
      SELECT
        COUNT(*) as total_tests,
        COUNT(DISTINCT profile_id) as total_athletes
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.cmj_results\`
    `;

    console.log('\n\nQuery 3: Total in entire CMJ table');
    console.log('─'.repeat(50));
    const [result3] = await bigquery.query(query3);
    console.log(`Total CMJ tests (all): ${result3[0].total_tests}`);
    console.log(`Total unique athletes (all): ${result3[0].total_athletes}`);

    const proPct = (result1[0].total_tests / result3[0].total_tests * 100).toFixed(1);
    console.log(`\nProfessional tests are ${proPct}% of all tests`);

    // Query 4: Sample of group names to verify our filter
    const query4 = `
      SELECT DISTINCT
        group_name_1,
        COUNT(*) as count
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.cmj_results\`
      GROUP BY group_name_1
      ORDER BY count DESC
      LIMIT 20
    `;

    console.log('\n\nQuery 4: Top 20 group_name_1 values (to verify filter)');
    console.log('─'.repeat(50));
    const [result4] = await bigquery.query(query4);
    result4.forEach(row => {
      const isPro = (row.group_name_1 && (
        row.group_name_1.toUpperCase().includes('MLB') ||
        row.group_name_1.toUpperCase().includes('MILB') ||
        row.group_name_1.toUpperCase().includes('PRO')
      ));
      console.log(`${isPro ? '✓' : ' '} ${row.group_name_1 || 'NULL'}: ${row.count} tests`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProAthletesCMJ();