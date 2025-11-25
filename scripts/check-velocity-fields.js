import valdApiService from '../server/services/valdApiService.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Check what velocity-related fields exist in the API
 */
async function checkVelocityFields() {
  console.log('\n🔍 Checking velocity field names...\n');

  try {
    // Aaron Cohn has SJ tests
    const profileId = '78b34d0c-e77c-4f65-a71d-da0c69db03cd';

    const tests = await valdApiService.getForceDecksTests(profileId, 'SJ');
    const sjTest = tests.data.find(t => t.testType === 'SJ');

    if (sjTest) {
      const testWithMetrics = await valdApiService.getTestDetails(sjTest);

      // Get all velocity-related fields
      const velocityKeys = Object.keys(testWithMetrics).filter(key =>
        key.toUpperCase().includes('VELOCITY')
      );

      console.log(`Found ${velocityKeys.length} velocity-related fields:\n`);

      velocityKeys.forEach(key => {
        const value = testWithMetrics[key];
        console.log(`  ${key}: ${value}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkVelocityFields().then(() => process.exit(0));
