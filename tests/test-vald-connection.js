import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const VALD_API_URL = process.env.VALD_API_URL;
const VALD_API_KEY = process.env.VALD_API_KEY;
const VALD_API_SECRET = process.env.VALD_API_SECRET;

console.log('\n🔍 Testing VALD API Connection...\n');
console.log('📡 VALD API URL:', VALD_API_URL);
console.log('🔑 API Key:', VALD_API_KEY ? 'Set ✅' : 'Missing ❌');
console.log('🔐 API Secret:', VALD_API_SECRET ? 'Set ✅' : 'Missing ❌');
console.log('\n' + '='.repeat(60) + '\n');

// Test 1: Basic connectivity
console.log('Test 1: Checking VALD API availability...');
try {
  const response = await axios.get(VALD_API_URL, {
    timeout: 5000,
    validateStatus: () => true, // Accept any status
  });

  console.log('✅ VALD API is reachable');
  console.log('   Status:', response.status);
  console.log('   Response headers:', response.headers['content-type']);
} catch (error) {
  console.log('❌ Cannot reach VALD API');
  console.log('   Error:', error.message);
  if (error.code === 'ENOTFOUND') {
    console.log('   ⚠️  DNS lookup failed - check if api.vald.com is the correct URL');
  }
}

console.log('\n' + '='.repeat(60) + '\n');

// Test 2: Authentication
console.log('Test 2: Testing authentication...');
try {
  const valdApi = axios.create({
    baseURL: VALD_API_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VALD_API_KEY}`,
    },
    timeout: 10000,
  });

  // Try common VALD endpoints
  const endpoints = [
    '/athletes',
    '/api/athletes',
    '/v1/athletes',
    '/api/v1/athletes',
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`   Trying: ${endpoint}...`);
      const response = await valdApi.get(endpoint, {
        validateStatus: (status) => status < 500, // Accept 4xx as "endpoint found but auth might be wrong"
      });

      console.log(`   ✅ Response from ${endpoint}`);
      console.log(`      Status: ${response.status}`);
      console.log(`      Message: ${response.statusText || 'Success'}`);

      if (response.status === 200) {
        console.log(`      📊 Data received: ${JSON.stringify(response.data).substring(0, 100)}...`);
        console.log('\n   🎉 SUCCESS! VALD API is working!');
        break;
      } else if (response.status === 401) {
        console.log('      ⚠️  Authentication failed - API key may be invalid');
      } else if (response.status === 403) {
        console.log('      ⚠️  Access forbidden - check API permissions');
      } else if (response.status === 404) {
        console.log('      ℹ️  Endpoint not found - trying next...');
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }
} catch (error) {
  console.log('❌ Authentication test failed');
  console.log('   Error:', error.message);
}

console.log('\n' + '='.repeat(60) + '\n');

// Test 3: Check if we need different auth method
console.log('Test 3: Testing Basic Auth (API Key + Secret)...');
try {
  const basicAuth = Buffer.from(`${VALD_API_KEY}:${VALD_API_SECRET}`).toString('base64');

  const valdApiBasic = axios.create({
    baseURL: VALD_API_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${basicAuth}`,
    },
    timeout: 10000,
  });

  const response = await valdApiBasic.get('/athletes', {
    validateStatus: () => true,
  });

  console.log('   Status:', response.status);
  if (response.status === 200) {
    console.log('   ✅ Basic Auth works!');
    console.log('   📊 Data:', JSON.stringify(response.data).substring(0, 100));
  } else if (response.status === 401) {
    console.log('   ❌ Basic Auth failed - credentials may be invalid');
  } else {
    console.log('   ℹ️  Status:', response.status, response.statusText);
  }
} catch (error) {
  console.log('   ❌ Error:', error.message);
}

console.log('\n' + '='.repeat(60) + '\n');

// Summary
console.log('📋 SUMMARY:\n');
console.log('To fix VALD API connection, you may need to:');
console.log('1. Verify the correct VALD API base URL (contact VALD support)');
console.log('2. Confirm your API credentials are valid');
console.log('3. Check if VALD uses a different authentication method');
console.log('4. Review VALD API documentation for correct endpoints');
console.log('\n💡 Recommendation:');
console.log('   Contact VALD support to get:');
console.log('   - Correct API base URL');
console.log('   - Valid API credentials');
console.log('   - API documentation with endpoint examples');
console.log('\n');
