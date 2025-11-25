import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: './push-performance-app/.env' });

const VALD_API_KEY = "mFQIP7I5RvfzU1Q==";
const VALD_API_SECRET = "ySCLzZJJrrxwcnmZ1YDzcIN449kD3fokbQ=";
const TENANT_ID = "7275b162-e9fc-4f78-ae7e-50574a26f741";
const AUTH_URL = "https://security.valdperformance.com/connect/token";

async function testValdAuth() {
  console.log('Testing VALD API Authentication and Endpoints...\n');

  try {
    // Step 1: Authenticate
    console.log('1. Authenticating with VALD...');
    console.log('   Auth URL:', AUTH_URL);
    console.log('   API Key:', VALD_API_KEY);

    const authResponse = await axios.post(AUTH_URL,
      new URLSearchParams({
        grant_type: 'client_credentials'
      }),
      {
        auth: {
          username: VALD_API_KEY,
          password: VALD_API_SECRET
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const token = authResponse.data.access_token;
    console.log('✅ Authentication successful!');
    console.log('   Token expires in:', authResponse.data.expires_in, 'seconds');
    console.log('   Token (first 50 chars):', token.substring(0, 50) + '...\n');

    // Step 2: Test the endpoints that returned 400 with different approaches
    console.log('2. Testing the 400 endpoints with tenant ID as header/param...\n');

    // Test ForceDecks with tenant ID in header and ModifiedFromUtc
    try {
      console.log('Testing ForceDecks with tenant ID and ModifiedFromUtc:');
      const modifiedFromUtc = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
      const response = await axios.get('https://prd-use-api-extforcedecks.valdperformance.com/tests', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          TenantId: TENANT_ID,
          ModifiedFromUtc: modifiedFromUtc,
          limit: 5
        }
      });
      console.log('✅ SUCCESS! Status:', response.status);
      console.log('Data:', JSON.stringify(response.data, null, 2).substring(0, 500));
    } catch (error) {
      console.log('❌ ForceDecks with headers failed:', error.response?.status, error.response?.statusText);
      if (error.response?.data) {
        console.log('Error details:', JSON.stringify(error.response.data, null, 2));
      }
    }

    console.log('\n');

    // Test Profiles with tenant ID in header
    try {
      console.log('Testing Profiles with tenant ID in header:');
      const response = await axios.get('https://prd-use-api-externalprofile.valdperformance.com/profiles', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Tenant-Id': TENANT_ID,
          'TenantId': TENANT_ID
        },
        params: {
          tenantId: TENANT_ID,
          limit: 1
        }
      });
      console.log('✅ SUCCESS! Status:', response.status);
      console.log('Data:', JSON.stringify(response.data, null, 2).substring(0, 500));
    } catch (error) {
      console.log('❌ Profiles with headers failed:', error.response?.status, error.response?.statusText);
      if (error.response?.data) {
        console.log('Error details:', JSON.stringify(error.response.data, null, 2));
      }
    }

    // Step 3: Test different endpoint variations
    const endpoints = [
      // Try with 'api' prefix
      `https://prd-use-api-extforcedecks.valdperformance.com/api/v1/${TENANT_ID}/tests`,
      `https://prd-use-api-extforcedecks.valdperformance.com/api/tests`,
      `https://prd-use-api-externalprofile.valdperformance.com/api/v1/${TENANT_ID}/profiles`,
      `https://prd-use-api-externalprofile.valdperformance.com/api/profiles`,

      // Try without tenant ID at all
      `https://prd-use-api-extforcedecks.valdperformance.com/v1/tests`,
      `https://prd-use-api-externalprofile.valdperformance.com/v1/profiles`
    ];

    console.log('2. Testing various endpoint patterns...\n');

    for (const endpoint of endpoints) {
      try {
        console.log(`   Testing: ${endpoint}`);
        const response = await axios.get(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          params: {
            limit: 1
          },
          timeout: 5000
        });

        console.log(`   ✅ SUCCESS! Status: ${response.status}`);
        console.log(`      Data structure:`, Object.keys(response.data));
        if (response.data.data && Array.isArray(response.data.data)) {
          console.log(`      Records found: ${response.data.data.length}`);
        }
        console.log('');

      } catch (error) {
        console.log(`   ❌ FAILED: ${error.response?.status || error.message}`);
        if (error.response?.status === 401) {
          console.log(`      Unauthorized - Token might not have permission`);
        } else if (error.response?.status === 404) {
          console.log(`      Not Found - Endpoint doesn't exist`);
        } else if (error.response?.status === 403) {
          console.log(`      Forbidden - Access denied to this resource`);
        }
        console.log('');
      }
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testValdAuth();