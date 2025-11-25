import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'vald-ref-data-copy',
  keyFilename: 'vald-ref-data-copy-0c0792ad4944.json'
});

async function verifyProAthletes() {
  console.log('🔍 Verifying Professional Athlete Data\n');

  try {
    // Check for duplicate tests per athlete
    const query1 = `
      SELECT
        profile_id,
        full_name,
        COUNT(*) as test_count,
        MIN(test_date) as first_test,
        MAX(test_date) as last_test,
        group_name_1
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.cmj_results\`
      WHERE group_name_1 IN ('MLB/ MiLB', 'Pro', 'Pro Golf ')
      GROUP BY profile_id, full_name, group_name_1
      HAVING COUNT(*) > 1
      ORDER BY test_count DESC
      LIMIT 20
    `;

    console.log('Athletes with multiple tests (top 20):');
    console.log('─'.repeat(60));
    const [result1] = await bigquery.query(query1);
    result1.forEach(row => {
      console.log(`${row.full_name} (${row.group_name_1}): ${row.test_count} tests`);
      console.log(`  First: ${row.first_test.value}, Last: ${row.last_test.value}`);
    });

    // Check average tests per athlete
    const query2 = `
      SELECT
        group_name_1,
        COUNT(*) as total_tests,
        COUNT(DISTINCT profile_id) as unique_athletes,
        ROUND(COUNT(*) / COUNT(DISTINCT profile_id), 1) as avg_tests_per_athlete
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.cmj_results\`
      WHERE group_name_1 IN ('MLB/ MiLB', 'Pro', 'Pro Golf ')
      GROUP BY group_name_1
    `;

    console.log('\n\nTests per athlete by group:');
    console.log('─'.repeat(60));
    const [result2] = await bigquery.query(query2);
    result2.forEach(row => {
      console.log(`${row.group_name_1}:`);
      console.log(`  Total tests: ${row.total_tests}`);
      console.log(`  Unique athletes: ${row.unique_athletes}`);
      console.log(`  Average tests per athlete: ${row.avg_tests_per_athlete}`);
    });

    // Sample some names to verify they're real pros
    const query3 = `
      SELECT DISTINCT
        full_name,
        group_name_1,
        group_name_2,
        COUNT(*) as test_count
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.cmj_results\`
      WHERE group_name_1 IN ('MLB/ MiLB', 'Pro', 'Pro Golf ')
      GROUP BY full_name, group_name_1, group_name_2
      ORDER BY RAND()
      LIMIT 30
    `;

    console.log('\n\nRandom sample of 30 "professional" athletes:');
    console.log('─'.repeat(60));
    const [result3] = await bigquery.query(query3);
    result3.forEach(row => {
      console.log(`${row.full_name} | ${row.group_name_1} | ${row.group_name_2 || 'N/A'} | ${row.test_count} tests`);
    });

    // Check date range of tests
    const query4 = `
      SELECT
        group_name_1,
        MIN(test_date) as earliest_test,
        MAX(test_date) as latest_test,
        COUNT(DISTINCT DATE(test_date)) as unique_test_days
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.cmj_results\`
      WHERE group_name_1 IN ('MLB/ MiLB', 'Pro', 'Pro Golf ')
      GROUP BY group_name_1
    `;

    console.log('\n\nTest date ranges:');
    console.log('─'.repeat(60));
    const [result4] = await bigquery.query(query4);
    result4.forEach(row => {
      console.log(`${row.group_name_1}:`);
      console.log(`  Earliest: ${row.earliest_test.value}`);
      console.log(`  Latest: ${row.latest_test.value}`);
      console.log(`  Unique test days: ${row.unique_test_days}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyProAthletes();