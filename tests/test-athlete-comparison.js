import { compareAthleteToProBenchmarks, getPercentileSummary } from './server/services/athleteComparisonService.js';

console.log('\n');
console.log('═'.repeat(70));
console.log('  🎯 ATHLETE COMPARISON DEMO');
console.log('═'.repeat(70));
console.log('\n');

// Check if we have percentile data
const summary = await getPercentileSummary();

if (Object.keys(summary).length === 0) {
  console.log('⚠️  No percentile data found in database.\n');
  console.log('You need to run the pro athlete sync first:\n');
  console.log('  node sync-pro-athletes.js\n');
  console.log('This will fetch pro athlete data from VALD and');
  console.log('calculate percentile benchmarks.\n');
  process.exit(1);
}

console.log('✅ Percentile data available for:\n');
for (const [testType, data] of Object.entries(summary)) {
  console.log(`  • ${testType.toUpperCase()} (${data.metricCount} metrics)`);
}
console.log('\n');
console.log('═'.repeat(70));
console.log('\n');

// Sample athlete data
const sampleAthlete = {
  name: 'John Smith',
  sport: 'Baseball',
  position: 'Pitcher',
  tests: [
    {
      testType: 'cmj',
      data: {
        jump_height: 35.5,  // cm
        peak_power: 4200,   // watts
        peak_force: 2100,   // newtons
        rsi: 1.8,
      },
    },
    {
      testType: 'imtp',
      data: {
        peak_force: 3200,   // newtons
        rfd: 8500,          // newtons/second
      },
    },
  ],
};

console.log(`📊 Comparing ${sampleAthlete.name} to Pro Benchmarks\n`);
console.log(`Sport: ${sampleAthlete.sport} | Position: ${sampleAthlete.position}\n`);

// Compare each test
for (const test of sampleAthlete.tests) {
  console.log('─'.repeat(70));
  console.log(`\n🏋️  ${test.testType.toUpperCase()} TEST\n`);

  const comparison = await compareAthleteToProBenchmarks(test.data, test.testType);

  if (Object.keys(comparison.metrics).length === 0) {
    console.log(`  ⚠️  No percentile data available for ${test.testType.toUpperCase()}\n`);
    continue;
  }

  // Display each metric comparison
  for (const [metricName, ranking] of Object.entries(comparison.metrics)) {
    const { percentile, label, color, value, proComparison } = ranking;

    // Color-coded output
    let colorCode = '';
    if (color === 'green') colorCode = '\x1b[32m'; // Green
    else if (color === 'lightgreen') colorCode = '\x1b[92m'; // Light green
    else if (color === 'yellow') colorCode = '\x1b[33m'; // Yellow
    else if (color === 'red') colorCode = '\x1b[31m'; // Red
    const resetCode = '\x1b[0m';

    console.log(`  ${metricName}:`);
    console.log(`    Value: ${value}`);
    console.log(`    Percentile: ${colorCode}${percentile}th${resetCode} (${colorCode}${label}${resetCode})`);
    console.log(`    Pro Range: ${proComparison.p25.toFixed(2)} (25th) | ${proComparison.p50.toFixed(2)} (50th) | ${proComparison.p75.toFixed(2)} (75th)`);
    console.log('');
  }

  // Overall test ranking
  if (comparison.overallRank) {
    let rankLabel = '';
    switch (comparison.overallRank) {
      case 'elite':
        rankLabel = '\x1b[32m🏆 ELITE\x1b[0m';
        break;
      case 'above_average':
        rankLabel = '\x1b[92m✅ ABOVE AVERAGE\x1b[0m';
        break;
      case 'average':
        rankLabel = '\x1b[33m📊 AVERAGE\x1b[0m';
        break;
      case 'developing':
        rankLabel = '\x1b[33m🔄 DEVELOPING\x1b[0m';
        break;
    }

    console.log(`  Overall Test Ranking: ${rankLabel}\n`);
  }

  // Show insights
  if (comparison.insights.length > 0) {
    console.log('  💡 Insights:');
    comparison.insights.forEach(insight => {
      const icon = insight.type === 'strength' ? '💪' : '🎯';
      console.log(`    ${icon} ${insight.message}`);
    });
    console.log('');
  }
}

console.log('═'.repeat(70));
console.log('\n📋 SUMMARY\n');

// Count strengths and improvements
let totalStrengths = 0;
let totalImprovements = 0;

for (const test of sampleAthlete.tests) {
  const comparison = await compareAthleteToProBenchmarks(test.data, test.testType);
  totalStrengths += comparison.insights.filter(i => i.type === 'strength').length;
  totalImprovements += comparison.insights.filter(i => i.type === 'improvement').length;
}

console.log(`Strengths (Elite Metrics): ${totalStrengths}`);
console.log(`Areas for Improvement: ${totalImprovements}\n`);

console.log('═'.repeat(70));
console.log('\n✅ HOW TO USE THIS IN YOUR APP:\n');
console.log('1. When generating athlete reports, call compareAthleteToProBenchmarks()');
console.log('2. Display percentile rankings with color coding');
console.log('3. Show insights for strengths and improvements');
console.log('4. Track progress over time by comparing against previous tests\n');

console.log('═'.repeat(70));
console.log('\n');
