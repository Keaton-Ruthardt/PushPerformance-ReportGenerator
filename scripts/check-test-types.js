import 'dotenv/config';
import valdApiService from '../server/services/valdApiServiceInstance.js';

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check what test types exist in the database
 */
async function checkTestTypes() {
  try {
    console.log('🔍 Checking test types in database...\n');

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

    let allTestTypes = new Set();
    let singleLegTests = new Set();

    // Check first 20 athletes for test types (with rate limiting)
    const checkCount = Math.min(20, searchResults.length);
    console.log(`Checking ${checkCount} athletes for test types (with delays to avoid rate limits)...\n`);

    for (let i = 0; i < checkCount; i++) {
      const athlete = searchResults[i];
      try {
        console.log(`Checking athlete ${i + 1}/${checkCount}: ${athlete.name}...`);

        // Get tests for each profile ID
        for (const profileId of athlete.profileIds) {
          const result = await valdApiService.getForceDecksTests(profileId);
          const tests = result.data || [];

          if (tests && tests.length > 0) {
            console.log(`  ✅ Found ${tests.length} tests`);
            tests.forEach(test => {
              if (test.testType) {
                console.log(`    📝 Test type: ${test.testType}`);
                allTestTypes.add(test.testType);

                // Look for any single leg related tests
                const testTypeLower = test.testType.toLowerCase();
                if (testTypeLower.includes('single leg') ||
                    testTypeLower.includes('single-leg') ||
                    testTypeLower.includes('sl ') ||
                    testTypeLower.includes('sl-') ||
                    testTypeLower.includes('slcmj') ||
                    testTypeLower.includes('sl cmj')) {
                  singleLegTests.add(test.testType);
                  console.log(`    🦵 ✅ FOUND Single Leg test: ${test.testType}`);
                }
              }
            });
          }

          // Small delay between profile checks
          await delay(300);
        }

        // Wait 1 second between athletes to avoid rate limiting
        if (i < checkCount - 1) {
          await delay(1000);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        // Wait 2 seconds after an error
        await delay(2000);
      }
    }

    console.log('\n✅ ALL Test Types Found:\n');
    console.log('='.repeat(80));
    const sortedTypes = Array.from(allTestTypes).sort();
    sortedTypes.forEach((type, idx) => {
      console.log(`${idx + 1}. ${type}`);
    });
    console.log('='.repeat(80));
    console.log(`\nTotal unique test types: ${allTestTypes.size}`);

    if (singleLegTests.size > 0) {
      console.log('\n\n🦵 Single Leg Test Types Found:\n');
      console.log('='.repeat(80));
      Array.from(singleLegTests).sort().forEach((type, idx) => {
        console.log(`${idx + 1}. ${type}`);
      });
      console.log('='.repeat(80));
    } else {
      console.log('\n\n⚠️  No Single Leg test types found in sample');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

checkTestTypes();
