import 'dotenv/config';
import VALDApiService from '../server/services/valdApiService.js';

const valdApiService = new VALDApiService();

async function queryRyanSLCMJ() {
  console.log('🔍 Searching for Ryan Schiefer...\n');

  try {
    // Search for Ryan Schiefer
    const athletes = await valdApiService.searchAthletes('Ryan Schiefer');

    if (!athletes || athletes.length === 0) {
      console.log('❌ Ryan Schiefer not found');
      return;
    }

    const ryan = athletes[0];
    console.log(`✅ Found: ${ryan.name}`);
    console.log(`   Profile IDs: ${ryan.profileIds.join(', ')}\n`);

    // Process each profile ID
    for (const profileId of ryan.profileIds) {
      console.log(`\n📊 Fetching tests for profile ID: ${profileId}`);
      console.log('=' .repeat(80));

      // Get all Single Leg CMJ tests
      const sljTests = await valdApiService.getForceDecksTests(profileId, 'Single Leg Jump');

      if (!sljTests || !sljTests.data || sljTests.data.length === 0) {
        console.log('  ⚠️  No Single Leg CMJ tests found for this profile\n');
        continue;
      }

      console.log(`  Found ${sljTests.data.length} Single Leg CMJ test(s)\n`);

      // Display each test
      for (const test of sljTests.data) {
        console.log(`  📝 Test ID: ${test.testId || test.id}`);
        console.log(`     Test Type: ${test.testType}`);
        console.log(`     Date: ${test.recordedDateUtc || test.testDate}`);
        console.log(`     API Source: ${test.apiSource || 'Primary'}`);

        // Get detailed test data with trials
        console.log('     Fetching trial data...');

        const detailsResponse = await valdApiService.getTestDetails(test);

        if (detailsResponse) {
          console.log(`     Trial data retrieved: ${detailsResponse.length || 0} trials`);

          // Check for limb field
          if (detailsResponse.length > 0) {
            const firstTrial = detailsResponse[0];
            console.log(`     Limb (from trial): ${firstTrial.limb || 'NOT SPECIFIED'}`);

            // Display key metrics
            console.log(`     Jump Height: ${firstTrial.JUMP_HEIGHT_IMP_MOM_Trial_cm || firstTrial.JUMP_HEIGHT_Trial_cm || 'N/A'} cm`);
            console.log(`     Peak Power: ${firstTrial.PEAK_TAKEOFF_POWER_Trial_W || firstTrial.PEAK_POWER_Trial_W || 'N/A'} W`);
            console.log(`     RSI-mod: ${firstTrial.RSI_MODIFIED_Trial_RSI_mod || firstTrial.RSI_MODIFIED_IMP_MOM_Trial_RSI_mod || 'N/A'}`);
          }
        } else {
          console.log('     ⚠️  Could not retrieve trial data');
        }

        console.log('');
      }
    }

    console.log('\n✅ Query complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }

  process.exit(0);
}

queryRyanSLCMJ();
