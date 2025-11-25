import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const VALD_API_KEY = process.env.VALD_API_KEY;
const VALD_API_SECRET = process.env.VALD_API_SECRET;
const TENANT_ID = process.env.TENANT_ID;
const AUTH_URL = "https://security.valdperformance.com/connect/token";
const PROFILE_URL = "https://prd-use-api-externalprofile.valdperformance.com";
const TENANTS_URL = "https://prd-use-api-externaltenants.valdperformance.com";

// Group ID for MLB/MiLB from your discovery
const MLB_MILB_GROUP_ID = "c29bf68e-d057-479b-b216-18ee05b8c913";

async function testGroupProfiles() {
  console.log('Testing profile retrieval by group...\n');

  try {
    // Step 1: Authenticate
    console.log('1. Authenticating with VALD...');
    const authResponse = await axios.post(AUTH_URL, {
      grant_type: 'client_credentials',
      client_id: VALD_API_KEY.replace(/"/g, ''),
      client_secret: VALD_API_SECRET.replace(/"/g, '')
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const token = authResponse.data.access_token;
    console.log('✅ Authentication successful\n');

    // Step 2: Try to get profiles with groupId parameter
    console.log('2. Testing profiles endpoint with groupId parameter...');
    try {
      const response = await axios.get(`${PROFILE_URL}/profiles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          tenantId: TENANT_ID,
          groupId: MLB_MILB_GROUP_ID,
          limit: 10
        }
      });

      console.log('✅ Success! Found profiles by group');
      console.log(`Total profiles: ${response.data.profiles ? response.data.profiles.length : 0}\n`);

      if (response.data.profiles && response.data.profiles.length > 0) {
        console.log('=== FIRST PROFILE ===');
        console.log(JSON.stringify(response.data.profiles[0], null, 2));
        console.log('\n=== ALL PROFILE NAMES ===');
        response.data.profiles.forEach((p, i) => {
          console.log(`${i + 1}. ${p.givenName} ${p.familyName}`);
        });
      }
    } catch (error) {
      console.log('❌ groupId parameter not supported:', error.response?.status);
    }

    // Step 3: Try tenants API to get group members
    console.log('\n3. Testing tenants API for group members...');
    try {
      const response = await axios.get(`${TENANTS_URL}/groups/${MLB_MILB_GROUP_ID}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          TenantId: TENANT_ID
        }
      });

      console.log('✅ Success! Found group members');
      console.log('Response:', JSON.stringify(response.data, null, 2).substring(0, 1000));
    } catch (error) {
      console.log('❌ Group members endpoint failed:', error.response?.status, error.response?.statusText);
      if (error.response?.data) {
        console.log('Error details:', JSON.stringify(error.response.data, null, 2));
      }
    }

    // Step 4: Try profiles endpoint with different parameters
    console.log('\n4. Testing profiles endpoint variations...');
    const testParams = [
      { name: 'with categoryId', params: { tenantId: TENANT_ID, categoryId: '7b428a17-172f-4b61-9c11-65bafc47c0c9', limit: 5 } },
      { name: 'with group in path', url: `${PROFILE_URL}/groups/${MLB_MILB_GROUP_ID}/profiles`, params: { tenantId: TENANT_ID, limit: 5 } },
      { name: 'with search Spencer + group', params: { tenantId: TENANT_ID, search: 'Spencer', groupId: MLB_MILB_GROUP_ID, limit: 50 } }
    ];

    for (const test of testParams) {
      try {
        console.log(`\n   Testing: ${test.name}`);
        const response = await axios.get(test.url || `${PROFILE_URL}/profiles`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          params: test.params
        });

        console.log(`   ✅ Success! Found ${response.data.profiles?.length || 0} profiles`);
        if (response.data.profiles && response.data.profiles.length > 0) {
          console.log(`      First profile: ${response.data.profiles[0].givenName} ${response.data.profiles[0].familyName}`);
        }
      } catch (error) {
        console.log(`   ❌ Failed: ${error.response?.status || error.message}`);
      }
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testGroupProfiles();
