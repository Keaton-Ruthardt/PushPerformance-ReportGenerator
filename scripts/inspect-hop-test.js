import 'dotenv/config';
import axios from 'axios';
import VALDApiService from '../server/services/valdApiService.js';

// Create service instance
const valdApiService = new VALDApiService();

async function inspectHopTest() {
  try {
    console.log('🔍 Inspecting Hop Test structure from VALD API...\n');

    // Get one athlete with a hop test
    console.log('📡 Fetching athletes...');
    const allAthletes = await valdApiService.getAllAthletes();
    console.log(`✅ Found ${allAthletes.length} athletes\n`);

    // Loop through athletes to find one with a hop test
    for (const athlete of allAthletes.slice(0, 50)) {
      const profileIds = athlete.profileIds || [athlete.id];

      for (const profileId of profileIds) {
        console.log(`\n🔍 Checking ${athlete.name} (${profileId})...`);

        try {
          // Get hop tests
          const hopTestsResponse = await valdApiService.getForceDecksTests(profileId, 'Hop Test');

          if (hopTestsResponse && hopTestsResponse.data && hopTestsResponse.data.length > 0) {
            const hopTest = hopTestsResponse.data[0];
            const testId = hopTest.testId || hopTest.id;
            const apiSource = hopTest.apiSource || 'Primary';

            console.log(`✅ Found hop test ${testId}`);

            // Fetch trials
            const useSecondary = apiSource === 'Secondary';
            const config = useSecondary ? valdApiService.config2 : valdApiService.config;
            const token = useSecondary ? await valdApiService.getAccessToken2() : await valdApiService.getAccessToken();

            const response = await axios.get(
              `${config.forceDecksUrl}/v2019q3/teams/${config.tenantId}/tests/${testId}/trials`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            const trials = response.data;

            if (trials && trials.length > 0) {
              console.log(`\n📊 TRIALS STRUCTURE FOR TEST ${testId}:`);
              console.log(`   Number of trials: ${trials.length}\n`);

              // Show structure of first trial
              const firstTrial = trials[0];
              console.log('🔍 FIRST TRIAL STRUCTURE:');
              console.log('==========================================');
              console.log(JSON.stringify(firstTrial, null, 2).substring(0, 5000));
              console.log('==========================================\n');

              // Show all available field names
              if (firstTrial.results && Array.isArray(firstTrial.results)) {
                console.log('📋 ALL AVAILABLE FIELDS IN RESULTS:');
                console.log('==========================================');
                firstTrial.results.forEach((result, idx) => {
                  if (result.definition && result.definition.result) {
                    console.log(`${idx + 1}. Field: "${result.definition.result}"`);
                    console.log(`   Limb: "${result.limb || 'N/A'}"`);
                    console.log(`   Unit: "${result.definition.unit || 'N/A'}"`);
                    console.log(`   Value: ${result.value}`);
                    console.log('');
                  }
                });
                console.log('==========================================\n');
              }

              // Success - exit
              process.exit(0);
            }
          }
        } catch (error) {
          // Skip this athlete, try next
        }
      }
    }

    console.log('❌ No hop tests found in first 50 athletes');
    process.exit(1);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

inspectHopTest();
