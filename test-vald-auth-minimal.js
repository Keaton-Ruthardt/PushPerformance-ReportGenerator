import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testMinimalAuth() {
  console.log('🧪 Testing minimal VALD authentication...\n');

  const authUrl = 'https://security.valdperformance.com/connect/token';
  const apiKey = process.env.VALD_API_KEY?.replace(/"/g, '');
  const apiSecret = process.env.VALD_API_SECRET?.replace(/"/g, '');

  console.log('API Key (first 10 chars):', apiKey?.substring(0, 10) + '...');
  console.log('Auth URL:', authUrl);

  // Test 1: With 'external' scope
  try {
    console.log('\n1️⃣  Testing with scope: "external"');
    const response1 = await axios.post(authUrl,
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'external'
      }),
      {
        auth: {
          username: apiKey,
          password: apiSecret
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    console.log('✅ Success with "external" scope');
    console.log('Token received:', response1.data.access_token?.substring(0, 20) + '...');
  } catch (error) {
    console.log('❌ Failed:', error.response?.data || error.message);
  }

  // Test 2: Without scope
  try {
    console.log('\n2️⃣  Testing without scope');
    const response2 = await axios.post(authUrl,
      new URLSearchParams({
        grant_type: 'client_credentials'
      }),
      {
        auth: {
          username: apiKey,
          password: apiSecret
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    console.log('✅ Success without scope');
    console.log('Token received:', response2.data.access_token?.substring(0, 20) + '...');
    console.log('Expires in:', response2.data.expires_in, 'seconds');
    console.log('Token type:', response2.data.token_type);
  } catch (error) {
    console.log('❌ Failed:', error.response?.data || error.message);
  }

  // Test 3: With 'api' scope
  try {
    console.log('\n3️⃣  Testing with scope: "api"');
    const response3 = await axios.post(authUrl,
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'api'
      }),
      {
        auth: {
          username: apiKey,
          password: apiSecret
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    console.log('✅ Success with "api" scope');
    console.log('Token received:', response3.data.access_token?.substring(0, 20) + '...');
  } catch (error) {
    console.log('❌ Failed:', error.response?.data || error.message);
  }
}

testMinimalAuth();