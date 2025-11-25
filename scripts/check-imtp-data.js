import { query, dataset } from '../server/config/bigquery.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkIMTPData() {
  console.log('\n🔍 Checking IMTP Data in BigQuery...\n');

  try {
    // Check if table exists and has data
    const countSql = `
      SELECT COUNT(*) as total_tests
      FROM \`vald-ref-data-copy.${dataset}.imtp_results\`
    `;

    const countResult = await query(countSql);
    const totalTests = countResult[0].total_tests;

    console.log(`📊 Total IMTP tests in BigQuery: ${totalTests}`);

    if (totalTests === 0) {
      console.log('\n❌ No IMTP data found in BigQuery!');
      console.log('   This explains why the UI shows N/A values.');
      console.log('   We need to populate IMTP data from VALD API.');
      return;
    }

    // Check field coverage for the 4 metrics we need
    const coverageSql = `
      SELECT
        COUNT(*) as total,
        COUNT(PEAK_VERTICAL_FORCE_Trial_N) as has_peak_force,
        COUNT(ISO_BM_REL_FORCE_PEAK_Trial_N_per_kg) as has_force_bm,
        COUNT(FORCE_AT_100MS_Trial_N) as has_force_100ms,
        COUNT(START_TO_PEAK_FORCE_Trial_s) as has_time_to_peak
      FROM \`vald-ref-data-copy.${dataset}.imtp_results\`
    `;

    const coverage = (await query(coverageSql))[0];
    console.log('\n📈 Field Coverage:');
    console.log(`   Total tests: ${coverage.total}`);
    console.log(`   Peak Vertical Force: ${coverage.has_peak_force} (${Math.round(coverage.has_peak_force/coverage.total*100)}%)`);
    console.log(`   Peak Force / BM: ${coverage.has_force_bm} (${Math.round(coverage.has_force_bm/coverage.total*100)}%)`);
    console.log(`   Force @ 100ms: ${coverage.has_force_100ms} (${Math.round(coverage.has_force_100ms/coverage.total*100)}%)`);
    console.log(`   Time to Peak Force: ${coverage.has_time_to_peak} (${Math.round(coverage.has_time_to_peak/coverage.total*100)}%)`);

    // Sample data
    console.log('\n📋 Sample IMTP Data (first 3 tests):');
    const sampleSql = `
      SELECT
        full_name,
        test_date,
        PEAK_VERTICAL_FORCE_Trial_N,
        ISO_BM_REL_FORCE_PEAK_Trial_N_per_kg,
        FORCE_AT_100MS_Trial_N,
        START_TO_PEAK_FORCE_Trial_s
      FROM \`vald-ref-data-copy.${dataset}.imtp_results\`
      ORDER BY test_date DESC
      LIMIT 3
    `;

    const samples = await query(sampleSql);
    samples.forEach((row, i) => {
      console.log(`\n${i+1}. ${row.full_name} (${new Date(row.test_date.value).toLocaleDateString()})`);
      console.log(`   Peak Vertical Force: ${row.PEAK_VERTICAL_FORCE_Trial_N ?? 'NULL'} N`);
      console.log(`   Peak Force / BM: ${row.ISO_BM_REL_FORCE_PEAK_Trial_N_per_kg ?? 'NULL'} N/kg`);
      console.log(`   Force @ 100ms: ${row.FORCE_AT_100MS_Trial_N ?? 'NULL'} N`);
      console.log(`   Time to Peak Force: ${row.START_TO_PEAK_FORCE_Trial_s ?? 'NULL'} s`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Not found')) {
      console.log('\n⚠️  IMTP table might not have been populated from the original VALD export.');
      console.log('   The table exists but may have no data, or data might be in a different format.');
    }
  }
}

checkIMTPData().then(() => process.exit(0));
