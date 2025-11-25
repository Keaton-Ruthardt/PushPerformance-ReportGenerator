import { getValdApiClient } from './server/services/valdAuthService.js';
import { fetchProfiles, fetchProfileTests } from './server/services/valdServiceUpdated.js';
import dotenv from 'dotenv';

dotenv.config();

const TENANT_ID = process.env.TENANT_ID;
const PROFILE_URL = process.env.PROFILE_URL;
const FORCEDECKS_URL = process.env.FORCEDECKS_URL;

console.log('\n🚀 Testing VALD API with Your Tenant ID\n');
console.log('='.repeat(70));
console.log(`Tenant ID: ${TENANT_ID}\n`);

try {
  // Step 1: Fetch Profiles (Athletes)
  console.log('📝 Step 1: Fetching Profiles (Athletes)...\n');

  const profiles = await fetchProfiles(TENANT_ID);

  if (profiles && profiles.length > 0) {
    console.log(`✅ Found ${profiles.length} athlete(s):\n`);

    // Display first 10 athletes
    const displayCount = Math.min(10, profiles.length);
    for (let i = 0; i < displayCount; i++) {
      const profile = profiles[i];
      const name = profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unnamed';
      const id = profile.id || profile.profileId || 'No ID';
      console.log(`${i + 1}. ${name}`);
      console.log(`   ID: ${id}`);
      console.log('');
    }

    if (profiles.length > 10) {
      console.log(`   ... and ${profiles.length - 10} more\n`);
    }

    console.log('='.repeat(70));

    // Step 2: Fetch Tests for First Athlete
    if (profiles.length > 0) {
      console.log('\n📝 Step 2: Fetching Force Deck Tests...\n');

      const firstProfile = profiles[0];
      const profileId = firstProfile.id || firstProfile.profileId;
      const profileName = firstProfile.name || `${firstProfile.firstName || ''} ${firstProfile.lastName || ''}`.trim();

      console.log(`Getting tests for: ${profileName} (${profileId})\n`);

      // Fetch tests from last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const modifiedFrom = ninetyDaysAgo.toISOString();

      const tests = await fetchProfileTests(profileId, TENANT_ID, modifiedFrom);

      if (tests && tests.length > 0) {
        console.log(`✅ Found ${tests.length} test(s) in the last 90 days:\n`);

        // Display first 5 tests
        const testDisplayCount = Math.min(5, tests.length);
        for (let i = 0; i < testDisplayCount; i++) {
          const test = tests[i];
          const testDate = test.testDate || test.modifiedDateUtc || test.createdDate || 'Unknown date';
          const testType = test.testType || test.type || 'Unknown type';
          console.log(`${i + 1}. ${testType} - ${testDate}`);
        }

        if (tests.length > 5) {
          console.log(`   ... and ${tests.length - 5} more tests\n`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('\n🎉 SUCCESS! Your VALD API Integration is Working!\n');
        console.log('Next Steps:');
        console.log('1. ✅ You can now search for athletes in your app');
        console.log('2. ✅ Import test data automatically');
        console.log('3. ✅ Generate reports with real VALD data\n');

      } else {
        console.log('⚠️  No tests found in the last 90 days for this athlete.\n');
        console.log('Try testing with an athlete who has recent ForceDecks data.\n');
      }
    }

  } else {
    console.log('⚠️  No profiles found for this tenant.\n');
    console.log('Possible reasons:');
    console.log('  1. No athletes have been added to this tenant yet');
    console.log('  2. The tenant ID might be incorrect');
    console.log('  3. Your API key might not have access to this tenant\n');
    console.log('Try adding some athletes in VALD Hub first.\n');
  }

  console.log('='.repeat(70) + '\n');

} catch (error) {
  console.log('\n❌ ERROR:', error.message);
  console.log('\nDetails:');
  console.log('  Status:', error.response?.status);
  console.log('  Message:', error.response?.data?.message || error.response?.statusText);

  if (error.response?.data) {
    console.log('  Data:', JSON.stringify(error.response.data, null, 2));
  }

  console.log('\n💡 Troubleshooting:');
  console.log('  - Verify tenant ID is correct');
  console.log('  - Check API key has access to this tenant');
  console.log('  - Confirm region URL is correct (US East)\n');
}
