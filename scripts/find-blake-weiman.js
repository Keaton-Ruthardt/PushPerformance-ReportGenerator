import { query, dataset } from '../server/config/bigquery.js';

/**
 * Script to check if Blake Weiman exists in BigQuery tables
 */

async function findBlakeWeiman() {
  try {
    console.log('🔍 Searching for Blake Weiman in BigQuery...\n');

    // Check all test tables
    const tables = [
      'cmj_results',
      'squat_jump_results',
      'imtp_results',
      'ppu_results',
      'HJ_result_updated'
    ];

    for (const table of tables) {
      console.log(`\n📊 Checking ${table}...`);

      const sql = `
        SELECT
          profile_id,
          full_name,
          test_id,
          test_date,
          group_name_1,
          group_name_2,
          group_name_3
        FROM \`vald-ref-data-copy.${dataset}.${table}\`
        WHERE LOWER(full_name) LIKE '%blake%weiman%'
           OR LOWER(full_name) LIKE '%weiman%blake%'
        ORDER BY test_date DESC
        LIMIT 10
      `;

      const results = await query(sql);

      if (results.length > 0) {
        console.log(`✅ Found ${results.length} tests in ${table}:`);
        results.forEach(row => {
          console.log(`   - Test ${row.test_id}`);
          console.log(`     Name: ${row.full_name}`);
          console.log(`     Profile ID: ${row.profile_id}`);
          console.log(`     Date: ${row.test_date}`);
          console.log(`     Groups: ${row.group_name_1}, ${row.group_name_2}, ${row.group_name_3}`);
        });
      } else {
        console.log(`   ⚠️  No tests found in ${table}`);
      }
    }

    console.log('\n✅ Search complete');
  } catch (error) {
    console.error('❌ Error searching for Blake Weiman:', error);
  }
}

findBlakeWeiman();
