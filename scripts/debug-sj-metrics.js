import valdApiService from '../server/services/valdApiService.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Debug script to see actual metric field names from a SJ test
 */
async function debugSJMetrics() {
  console.log('\n🔍 Debugging SJ Metric Field Names...\n');

  try {
    // Aaron Cohn has SJ tests
    const profileId = '78b34d0c-e77c-4f65-a71d-da0c69db03cd';

    console.log(`Fetching SJ tests for profile ${profileId}...`);
    const tests = await valdApiService.getForceDecksTests(profileId, 'SJ');

    if (tests && tests.data && tests.data.length > 0) {
      // Find an actual SJ test
      const sjTest = tests.data.find(t => t.testType === 'SJ');

      if (sjTest) {
        console.log(`\n📊 Found SJ test: ${sjTest.testId || sjTest.id}`);
        console.log(`Test date: ${sjTest.recordedDateUtc}`);

        // Get detailed metrics
        console.log(`\nFetching detailed metrics...`);
        const testWithMetrics = await valdApiService.getTestDetails(sjTest);

        if (testWithMetrics) {
          console.log(`\n✅ Got metrics! Here are all the field names:\n`);

          // Get all keys that contain metric-like names
          const metricKeys = Object.keys(testWithMetrics).filter(key =>
            key.includes('Trial') ||
            key.includes('JUMP') ||
            key.includes('POWER') ||
            key.includes('FORCE') ||
            key.includes('VELOCITY') ||
            key.includes('HEIGHT') ||
            key.includes('WEIGHT') ||
            key.includes('bodyWeight') ||
            key.includes('weight')
          );

          console.log(`Found ${metricKeys.length} metric-related fields:\n`);

          metricKeys.forEach(key => {
            const value = testWithMetrics[key];
            console.log(`  ${key}: ${value}`);
          });

          console.log(`\n\n🔍 Full test object keys (${Object.keys(testWithMetrics).length} total):`);
          console.log(Object.keys(testWithMetrics).join(', '));
        }
      } else {
        console.log('❌ No SJ tests found for this profile');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

debugSJMetrics().then(() => process.exit(0));
