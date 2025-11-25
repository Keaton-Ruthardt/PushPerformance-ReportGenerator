import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const VALD_API_KEY = process.env.VALD_API_KEY;
const VALD_API_SECRET = process.env.VALD_API_SECRET;
const TENANT_ID = process.env.TENANT_ID;
const AUTH_URL = "https://security.valdperformance.com/connect/token";
const PROFILE_URL = "https://prd-use-api-externalprofile.valdperformance.com";

async function testSpencerSearch() {
  console.log('Testing Spencer Steer search...\\n');

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
    console.log('✅ Authentication successful\\n');

    // MLB/MiLB Group ID
    const MLB_MILB_GROUP_ID = 'c29bf68e-d057-479b-b216-18ee05b8c913';

    // Step 2: Search for Spencer in MLB/MiLB group
    console.log('2. Searching for Spencer Steer in MLB/MiLB group...');
    const response = await axios.get(`${PROFILE_URL}/profiles`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        tenantId: TENANT_ID,
        groupId: MLB_MILB_GROUP_ID,
        search: 'Spencer',
        limit: 200
      }
    });

    console.log('✅ Search successful\\n');
    console.log(`Total profiles found: ${response.data.profiles ? response.data.profiles.length : 0}\\n`);

    if (response.data && response.data.profiles && response.data.profiles.length > 0) {
      console.log('=== FIRST PROFILE FULL DETAILS ===');
      console.log(JSON.stringify(response.data.profiles[0], null, 2));
      console.log('\\n=== ALL FIELDS ===');
      console.log(Object.keys(response.data.profiles[0]));

      // Find Spencer Steer specifically
      const spencerSteer = response.data.profiles.find(p =>
        p.familyName && p.familyName.toLowerCase().includes('steer')
      );

      if (spencerSteer) {
        console.log('\\n=== FOUND SPENCER STEER ===');
        console.log(JSON.stringify(spencerSteer, null, 2));
      } else {
        console.log('\\n❌ Spencer Steer NOT found in results');
      }
    } else {
      console.log('❌ No profiles found for search term "Spencer"');
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testSpencerSearch();
