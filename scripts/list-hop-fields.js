import 'dotenv/config';
import axios from 'axios';
import VALDApiService from '../server/services/valdApiService.js';

// Create service instance
const valdApiService = new VALDApiService();

async function listHopFields() {
  try {
    console.log('🔍 Listing all Hop Test fields...\n');

    // Get one athlete with a hop test
    const allAthletes = await valdApiService.getAllAthletes();

    // Loop through athletes to find one with a hop test
    for (const athlete of allAthletes.slice(0, 50)) {
      const profileIds = athlete.profileIds || [athlete.id];

      for (const profileId of profileIds) {
        try {
          // Get hop tests
          const hopTestsResponse = await valdApiService.getForceDecksTests(profileId, 'Hop Test');

          if (hopTestsResponse && hopTestsResponse.data && hopTestsResponse.data.length > 0) {
            const hopTest = hopTestsResponse.data[0];
            const testId = hopTest.testId || hopTest.id;
            const apiSource = hopTest.apiSource || 'Primary';

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

            if (trials && trials.length > 0 && trials[0].results) {
              console.log('📋 ALL FIELD NAMES:\n');
              console.log('==========================================');

              trials[0].results.forEach((result, idx) => {
                if (result.definition && result.definition.result) {
                  const fieldName = result.definition.result;
                  const limb = result.limb || 'N/A';
                  const unit = result.definition.unit || 'N/A';
                  console.log(`${(idx + 1).toString().padStart(3)}. ${fieldName.padEnd(40)} | Limb: ${limb.padEnd(10)} | Unit: ${unit.padEnd(15)} | Value: ${result.value}`);
                }
              });

              console.log('==========================================\n');

              // Search for potential contact time fields
              console.log('🔍 POTENTIAL CONTACT TIME FIELDS:\n');
              trials[0].results.forEach((result, idx) => {
                if (result.definition && result.definition.result) {
                  const fieldName = result.definition.result.toUpperCase();
                  if (fieldName.includes('CONTACT') || fieldName.includes('TIME') || fieldName.includes('GCT')) {
                    console.log(`   ✓ ${result.definition.result} (Limb: ${result.limb || 'N/A'}, Unit: ${result.definition.unit || 'N/A'}, Value: ${result.value})`);
                  }
                }
              });

              process.exit(0);
            }
          }
        } catch (error) {
          // Skip this athlete, try next
        }
      }
    }

    console.log('❌ No hop tests found');
    process.exit(1);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listHopFields();
