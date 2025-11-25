import 'dotenv/config';
import valdApiService from '../server/services/valdApiServiceInstance.js';

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Find athletes with SLJ (Single Leg Jump) tests
 */
async function findSLJAthletes() {
  try {
    console.log('🔍 Searching for athletes with SLJ (Single Leg Jump) tests...\n');

    // Authenticate first
    await valdApiService.authenticate();

    // Get a sample of athletes
    const searchTerms = ['a', 'b', 'c'];
    let allAthletes = new Map();

    for (const term of searchTerms) {
      const results = await valdApiService.searchAthletes(term, 'name');
      results.forEach(athlete => {
        allAthletes.set(athlete.id, athlete);
      });
    }

    const searchResults = Array.from(allAthletes.values());
    console.log(`📊 Found ${searchResults.length} unique athletes\n`);

    let athletesWithSLJ = [];

    // Check first 50 athletes for SLJ tests
    const checkCount = Math.min(50, searchResults.length);
    console.log(`Checking ${checkCount} athletes for SLJ tests (with delays to avoid rate limits)...\n`);

    for (let i = 0; i < checkCount; i++) {
      const athlete = searchResults[i];
      try {
        console.log(`Checking athlete ${i + 1}/${checkCount}: ${athlete.name}...`);

        // Get tests for each profile ID
        for (const profileId of athlete.profileIds) {
          const result = await valdApiService.getForceDecksTests(profileId);
          const tests = result.data || [];

          const sljTests = tests.filter(t =>
            t.testType && (
              t.testType.toUpperCase() === 'SLJ' ||
              t.testType.toLowerCase().includes('single leg') ||
              t.testType.toLowerCase().includes('single-leg')
            )
          );

          if (sljTests.length > 0) {
            console.log(`  ✅ Found ${sljTests.length} SLJ test(s)!`);

            // Log all unique test type names
            const testTypes = [...new Set(sljTests.map(t => t.testType))];
            console.log(`  📝 Test type names: ${testTypes.join(', ')}`);

            athletesWithSLJ.push({
              name: athlete.name,
              id: athlete.id,
              profileId: profileId,
              testCount: sljTests.length,
              testTypes: testTypes,
              tests: sljTests.map(t => ({
                testType: t.testType,
                testId: t.testId,
                recordedDate: t.recordedDateUtc
              }))
            });

            // Break after finding first athlete with SLJ to avoid too many API calls
            break;
          }

          // Small delay between profile checks
          await delay(300);
        }

        // If we found athletes with SLJ, show them and break
        if (athletesWithSLJ.length >= 3) {
          console.log('\n  Found enough athletes, stopping search...\n');
          break;
        }

        // Wait 1 second between athletes to avoid rate limiting
        await delay(1000);
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        await delay(2000);
      }
    }

    console.log('\n✅ Athletes with SLJ (Single Leg Jump) tests:\n');
    console.log('='.repeat(80));

    if (athletesWithSLJ.length > 0) {
      athletesWithSLJ.forEach((a, idx) => {
        console.log(`\n${idx + 1}. ${a.name}`);
        console.log(`   ID: ${a.id}`);
        console.log(`   Profile ID: ${a.profileId}`);
        console.log(`   Total SLJ tests: ${a.testCount}`);
        console.log(`   Test types: ${a.testTypes.join(', ')}`);
        console.log(`   Test details:`);
        a.tests.forEach(test => {
          console.log(`     - ${test.testType} (${test.testId}) on ${test.recordedDate}`);
        });
      });
      console.log('\n' + '='.repeat(80));
      console.log(`\n🎯 Found ${athletesWithSLJ.length} athlete(s) with SLJ data!`);
    } else {
      console.log('\n⚠️  No athletes found with SLJ tests.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

findSLJAthletes();
