import { getValidToken, refreshToken } from './server/services/valdAuthService.js';
import {
  fetchTenants,
  fetchProfiles,
  fetchProfileById,
  fetchProfileTests,
} from './server/services/valdServiceUpdated.js';

console.log('\n🚀 VALD API Integration Test\n');
console.log('='.repeat(70));

/**
 * Step 1: Test Authentication
 */
console.log('\n📝 Step 1: Testing Authentication...\n');

try {
  const token = await getValidToken();
  console.log('✅ Authentication successful!');
  console.log(`   Token (first 50 chars): ${token.substring(0, 50)}...`);
} catch (error) {
  console.log('❌ Authentication failed:', error.message);
  console.log('\n⚠️  Check your credentials in .env file:');
  console.log('   VALD_API_KEY (clientId)');
  console.log('   VALD_API_SECRET (clientSecret)');
  process.exit(1);
}

console.log('\n' + '='.repeat(70));

/**
 * Step 2: Fetch Tenants
 */
console.log('\n📝 Step 2: Fetching Tenants...\n');

let tenants = [];
let tenantId = null;

try {
  tenants = await fetchTenants();

  if (tenants && tenants.length > 0) {
    console.log(`✅ Found ${tenants.length} tenant(s):`);
    tenants.forEach((tenant, index) => {
      console.log(`   ${index + 1}. ${tenant.name || 'Unnamed'} (ID: ${tenant.id || tenant.tenantId})`);
    });

    // Use the first tenant for subsequent tests
    tenantId = tenants[0].id || tenants[0].tenantId;
    console.log(`\n   📌 Using tenant: ${tenants[0].name || tenantId}`);
  } else {
    console.log('⚠️  No tenants found. You may not have access to any organizations.');
    process.exit(0);
  }
} catch (error) {
  console.log('❌ Failed to fetch tenants:', error.message);
  console.log('\n💡 Possible reasons:');
  console.log('   - Incorrect API endpoint');
  console.log('   - Invalid credentials');
  console.log('   - Network connectivity issues');
  process.exit(1);
}

console.log('\n' + '='.repeat(70));

/**
 * Step 3: Fetch Profiles (Athletes)
 */
console.log('\n📝 Step 3: Fetching Profiles (Athletes)...\n');

let profiles = [];

try {
  profiles = await fetchProfiles(tenantId);

  if (profiles && profiles.length > 0) {
    console.log(`✅ Found ${profiles.length} profile(s):`);

    // Show first 5 profiles
    const displayCount = Math.min(5, profiles.length);
    for (let i = 0; i < displayCount; i++) {
      const profile = profiles[i];
      console.log(`   ${i + 1}. ${profile.name || profile.firstName + ' ' + profile.lastName} (ID: ${profile.id || profile.profileId})`);
    }

    if (profiles.length > 5) {
      console.log(`   ... and ${profiles.length - 5} more`);
    }
  } else {
    console.log('⚠️  No profiles found for this tenant.');
    console.log('   This might be normal if you haven\'t added any athletes yet.');
  }
} catch (error) {
  console.log('❌ Failed to fetch profiles:', error.message);
  console.log('   Error details:', error.response?.data || error);
}

console.log('\n' + '='.repeat(70));

/**
 * Step 4: Fetch Tests for First Profile (if available)
 */
if (profiles && profiles.length > 0) {
  console.log('\n📝 Step 4: Fetching Tests for First Profile...\n');

  const firstProfile = profiles[0];
  const profileId = firstProfile.id || firstProfile.profileId;

  try {
    const tests = await fetchProfileTests(profileId, tenantId);

    if (tests && tests.length > 0) {
      console.log(`✅ Found ${tests.length} test(s) for ${firstProfile.name || 'athlete'}:`);

      // Show first 5 tests
      const displayCount = Math.min(5, tests.length);
      for (let i = 0; i < displayCount; i++) {
        const test = tests[i];
        console.log(`   ${i + 1}. ${test.testType || 'Unknown'} - ${test.testDate || 'No date'}`);
      }

      if (tests.length > 5) {
        console.log(`   ... and ${tests.length - 5} more`);
      }
    } else {
      console.log('⚠️  No tests found for this profile.');
    }
  } catch (error) {
    console.log('❌ Failed to fetch tests:', error.message);
  }
}

console.log('\n' + '='.repeat(70));

/**
 * Summary
 */
console.log('\n📊 Test Summary:\n');
console.log(`   ✅ Authentication: ${token ? 'Success' : 'Failed'}`);
console.log(`   ✅ Tenants found: ${tenants.length}`);
console.log(`   ✅ Profiles found: ${profiles.length}`);
console.log('\n' + '='.repeat(70));

console.log('\n🎉 VALD API Integration Test Complete!\n');

if (tenants.length > 0 && profiles.length > 0) {
  console.log('✅ Your VALD API is fully connected and working!');
  console.log('\n📝 Next steps:');
  console.log('   1. Update athlete routes to use VALD data');
  console.log('   2. Add athlete search functionality to frontend');
  console.log('   3. Auto-populate assessment forms with VALD test data');
} else if (tenants.length > 0) {
  console.log('⚠️  VALD API is connected but no profiles found.');
  console.log('   Add some athletes in VALD Hub first.');
} else {
  console.log('❌ Could not connect to VALD API.');
  console.log('   Please verify your credentials and endpoint URL.');
}

console.log('\n');
