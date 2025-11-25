import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function checkBlakeBothApis() {
  try {
    const blakeName = 'Blake Weiman';

    console.log('🔍 Checking for Blake Weiman in BOTH VALD APIs...\n');

    // PRIMARY API
    console.log('📊 PRIMARY API:');
    const token1 = await getToken(
      process.env.AUTH_URL,
      process.env.VALD_API_KEY.replace(/"/g, ''),
      process.env.VALD_API_SECRET.replace(/"/g, '')
    );

    const primaryTests = await getHopTests(
      token1,
      process.env.FORCEDECKS_URL,
      process.env.TENANT_ID
    );
    console.log(`  Found ${primaryTests.length} HJ tests total in Primary`);
    const blakePrimary = primaryTests.filter(t =>
      t.profileName && t.profileName.toLowerCase().includes('blake') && t.profileName.toLowerCase().includes('weiman')
    );
    console.log(`  Found ${blakePrimary.length} Blake Weiman HJ tests in Primary`);
    if (blakePrimary.length > 0) {
      console.log('  Test IDs:');
      blakePrimary.forEach((t, i) => {
        console.log(`    ${i + 1}. ${t.testId} - ${t.profileName} (${t.profileId})`);
      });
    }

    // SECONDARY API
    console.log('\n📊 SECONDARY API:');
    const token2 = await getToken(
      process.env.AUTH_URL,
      process.env.VALD_API_KEY_2.replace(/"/g, ''),
      process.env.VALD_API_SECRET_2.replace(/"/g, '')
    );

    const secondaryTests = await getHopTests(
      token2,
      process.env.FORCEDECKS_URL,
      process.env.TENANT_ID_2
    );
    console.log(`  Found ${secondaryTests.length} HJ tests total in Secondary`);
    const blakeSecondary = secondaryTests.filter(t =>
      t.profileName && t.profileName.toLowerCase().includes('blake') && t.profileName.toLowerCase().includes('weiman')
    );
    console.log(`  Found ${blakeSecondary.length} Blake Weiman HJ tests in Secondary`);
    if (blakeSecondary.length > 0) {
      console.log('  Test IDs:');
      blakeSecondary.forEach((t, i) => {
        console.log(`    ${i + 1}. ${t.testId} - ${t.profileName} (${t.profileId})`);
      });
    }

    console.log('\n📊 SUMMARY:');
    console.log(`  Primary API: ${blakePrimary.length} tests`);
    console.log(`  Secondary API: ${blakeSecondary.length} tests`);
    console.log(`  Total: ${blakePrimary.length + blakeSecondary.length} tests`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function getToken(authUrl, clientId, clientSecret) {
  const response = await axios.post(authUrl, {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret
  }, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return response.data.access_token;
}

async function getHopTests(token, forceDecksUrl, tenantId) {
  const modifiedFromUtc = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days ago

  const response = await axios.get(
    `${forceDecksUrl}/tests`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        tenantId: tenantId,
        modifiedFromUtc: modifiedFromUtc,
        testType: 'HJ',
        limit: 1000
      }
    }
  );

  // Handle different response structures
  const data = response.data;
  if (Array.isArray(data)) {
    return data;
  } else if (data && data.data && Array.isArray(data.data)) {
    return data.data;
  } else if (data && data.tests && Array.isArray(data.tests)) {
    return data.tests;
  } else {
    return [];
  }
}

checkBlakeBothApis();
