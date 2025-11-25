import { syncProAthletePercentiles } from './server/services/proAthleteService.js';
import { getPercentileSummary, getAllPercentileRanges } from './server/services/athleteComparisonService.js';

console.log('\n');
console.log('═'.repeat(70));
console.log('  🏆 PRO ATHLETE PERCENTILE SYNC');
console.log('═'.repeat(70));
console.log('\n');

try {
  // Run the sync process
  const result = await syncProAthletePercentiles();

  if (result.success) {
    console.log('═'.repeat(70));
    console.log('\n📊 PERCENTILE DATA SUMMARY\n');

    // Show what was stored
    const summary = await getPercentileSummary();

    if (Object.keys(summary).length > 0) {
      console.log('Test types with percentile data:');
      console.log('');

      for (const [testType, data] of Object.entries(summary)) {
        console.log(`  📈 ${testType.toUpperCase()}`);
        console.log(`     Metrics: ${data.metricCount}`);
        console.log(`     Last Updated: ${new Date(data.lastUpdated).toLocaleString()}`);
        console.log('');
      }

      // Show sample percentile ranges
      console.log('═'.repeat(70));
      console.log('\n📋 SAMPLE PERCENTILE RANGES\n');

      const allRanges = await getAllPercentileRanges();

      // Show first 10 metrics as examples
      const sampleRanges = allRanges.slice(0, 10);

      sampleRanges.forEach(range => {
        console.log(`${range.test_type.toUpperCase()} - ${range.metric_name}`);
        console.log(`  25th percentile: ${range.p25}`);
        console.log(`  50th percentile (median): ${range.p50}`);
        console.log(`  75th percentile: ${range.p75}`);
        console.log(`  Sample size: ${range.sample_size} pro athletes`);
        console.log('');
      });

      if (allRanges.length > 10) {
        console.log(`  ... and ${allRanges.length - 10} more metrics\n`);
      }

    } else {
      console.log('⚠️  No percentile data found in database.\n');
    }

    console.log('═'.repeat(70));
    console.log('\n✅ NEXT STEPS:\n');
    console.log('1. Use these percentile ranges to compare your athletes');
    console.log('2. Generate reports showing athlete rankings vs pros');
    console.log('3. Identify strengths and areas for improvement');
    console.log('4. Track progress over time\n');

    console.log('💡 TIP: Run this sync regularly (e.g., weekly) to keep');
    console.log('   percentile data up-to-date as more pro tests are added.\n');

  } else {
    console.log('═'.repeat(70));
    console.log('\n⚠️  SYNC INCOMPLETE\n');
    console.log(`Reason: ${result.message}\n`);

    if (result.proAthletes === 0) {
      console.log('📝 ACTION REQUIRED:\n');
      console.log('To use percentile comparisons, you need pro athlete data.');
      console.log('');
      console.log('Steps to add pro athletes in VALD Hub:');
      console.log('1. Log in to https://hub.valdperformance.com');
      console.log('2. Navigate to Athletes/Profiles');
      console.log('3. Add or edit athlete profiles');
      console.log('4. Tag athletes as "Pro" or "Professional"');
      console.log('   OR add them to a "Pro Athletes" group');
      console.log('5. Ensure they have Force Deck test results');
      console.log('6. Run this script again\n');
    }
  }

  console.log('═'.repeat(70));
  console.log('\n');

  process.exit(0);

} catch (error) {
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('❌ ERROR DURING SYNC\n');
  console.log(`Error: ${error.message}\n`);

  if (error.message.includes('VALD')) {
    console.log('💡 Troubleshooting:');
    console.log('  - Check VALD API credentials in .env file');
    console.log('  - Verify network connectivity');
    console.log('  - Ensure tenant ID is correct\n');
  } else if (error.message.includes('database')) {
    console.log('💡 Troubleshooting:');
    console.log('  - Check PostgreSQL is running');
    console.log('  - Verify database credentials in .env file');
    console.log('  - Ensure percentile_ranges table exists\n');
  }

  console.log('═'.repeat(70));
  console.log('\n');

  process.exit(1);
}
