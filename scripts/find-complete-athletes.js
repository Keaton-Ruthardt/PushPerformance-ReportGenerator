import 'dotenv/config';
import valdApiService from '../server/services/valdApiServiceInstance.js';

/**
 * Find athletes with the most complete test coverage
 */
async function findCompleteAthletes() {
  try {
    console.log('🔍 Searching for athletes with complete test coverage...\n');

    // Authenticate first
    await valdApiService.authenticate();

    // Get a broad list of athletes (search for empty string to get many results)
    const searchResults = await valdApiService.searchAthletes('a', 'name');
    console.log(`📊 Found ${searchResults.length} total athletes\n`);

    let athletesWithTests = [];

    // Check first 100 athletes for test coverage
    const checkCount = Math.min(100, searchResults.length);
    console.log(`Checking ${checkCount} athletes...\n`);

    for (let i = 0; i < checkCount; i++) {
      const athlete = searchResults[i];
      try {
        const tests = await valdApiService.getAthleteTests(athlete.id, athlete.profileIds);

        const testCounts = {
          cmj: tests.filter(t => t.testType === 'CMJ').length,
          squatJump: tests.filter(t => t.testType === 'SJ').length,
          imtp: tests.filter(t => t.testType === 'IMTP').length,
          singleLegCMJ: tests.filter(t => t.testType === 'Single Leg CMJ').length,
          hopTest: tests.filter(t => t.testType === 'Hop').length,
          plyoPushUp: tests.filter(t => t.testType === 'Plyo Push Up').length
        };

        const totalTypes = Object.values(testCounts).filter(c => c > 0).length;

        if (totalTypes >= 3) {
          athletesWithTests.push({
            name: athlete.name,
            id: athlete.id,
            testCounts,
            totalTypes,
            totalTests: tests.length
          });
        }
      } catch (error) {
        // Skip athletes with errors
      }
    }

    // Sort by most test types, then by total tests
    athletesWithTests.sort((a, b) => {
      if (b.totalTypes !== a.totalTypes) return b.totalTypes - a.totalTypes;
      return b.totalTests - a.totalTests;
    });

    console.log('\n✅ Top athletes with most test coverage:\n');
    console.log('='.repeat(80));

    athletesWithTests.slice(0, 15).forEach((a, idx) => {
      console.log(`\n${idx + 1}. ${a.name} (ID: ${a.id})`);
      console.log(`   Test Types: ${a.totalTypes}/6 | Total Tests: ${a.totalTests}`);
      console.log(`   ✓ CMJ: ${a.testCounts.cmj}`);
      console.log(`   ${a.testCounts.squatJump > 0 ? '✓' : '✗'} Squat Jump: ${a.testCounts.squatJump}`);
      console.log(`   ${a.testCounts.imtp > 0 ? '✓' : '✗'} IMTP: ${a.testCounts.imtp}`);
      console.log(`   ${a.testCounts.singleLegCMJ > 0 ? '✓' : '✗'} Single Leg CMJ: ${a.testCounts.singleLegCMJ}`);
      console.log(`   ${a.testCounts.hopTest > 0 ? '✓' : '✗'} Hop Test: ${a.testCounts.hopTest}`);
      console.log(`   ${a.testCounts.plyoPushUp > 0 ? '✓' : '✗'} Plyo Push Up: ${a.testCounts.plyoPushUp}`);
    });

    console.log('\n' + '='.repeat(80));

    const sixTestAthletes = athletesWithTests.filter(a => a.totalTypes === 6);
    if (sixTestAthletes.length > 0) {
      console.log(`\n🎯 Found ${sixTestAthletes.length} athlete(s) with ALL 6 test types!`);
    } else {
      console.log(`\n⚠️  No athletes found with all 6 test types.`);
      const maxTypes = Math.max(...athletesWithTests.map(a => a.totalTypes));
      console.log(`   Best coverage: ${maxTypes}/6 test types`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

findCompleteAthletes();
