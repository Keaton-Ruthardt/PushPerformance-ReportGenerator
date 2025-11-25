import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function checkBlakeProfileTests() {
  try {
    const profileId = '947548a9-b81f-474a-9863-6dc14a3078c4';

    console.log('🔍 Checking Blake Weiman HJ tests by profile ID in both APIs...\n');

    // PRIMARY API
    console.log('📊 PRIMARY API:');
    const token1 = await getToken(
      process.env.AUTH_URL,
      process.env.VALD_API_KEY.replace(/"/g, ''),
      process.env.VALD_API_SECRET.replace(/"/g, '')
    );

    const primaryTests = await getProfileTests(
      token1,
      process.env.FORCEDECKS_URL,
      process.env.TENANT_ID,
      profileId
    );
    const primaryHJ = primaryTests.filter(t => t.testType === 'HJ');
    console.log(`  Found ${primaryHJ.length} HJ tests for Blake in Primary API`);
    if (primaryHJ.length > 0) {
      console.log('  Test IDs:');
      primaryHJ.forEach((t, i) => {
        console.log(`    ${i + 1}. ${t.testId || t.id} - ${t.recordedDateUtc}`);
      });
    }

    // SECONDARY API
    console.log('\n📊 SECONDARY API:');
    const token2 = await getToken(
      process.env.AUTH_URL,
      process.env.VALD_API_KEY_2.replace(/"/g, ''),
      process.env.VALD_API_SECRET_2.replace(/"/g, '')
    );

    const secondaryTests = await getProfileTests(
      token2,
      process.env.FORCEDECKS_URL,
      process.env.TENANT_ID_2,
      profileId
    );
    const secondaryHJ = secondaryTests.filter(t => t.testType === 'HJ');
    console.log(`  Found ${secondaryHJ.length} HJ tests for Blake in Secondary API`);
    if (secondaryHJ.length > 0) {
      console.log('  Test IDs:');
      secondaryHJ.forEach((t, i) => {
        console.log(`    ${i + 1}. ${t.testId || t.id} - ${t.recordedDateUtc}`);
      });
    }

    console.log('\n📊 TOTAL:');
    console.log(`  Primary: ${primaryHJ.length} HJ tests`);
    console.log(`  Secondary: ${secondaryHJ.length} HJ tests`);
    console.log(`  Combined: ${primaryHJ.length + secondaryHJ.length} HJ tests`);
    console.log('\n📊 Expected from BigQuery: 8 HJ tests');
    console.log(`  Difference: ${8 - (primaryHJ.length + secondaryHJ.length)} tests`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.response?.data);
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

async function getProfileTests(token, forceDecksUrl, tenantId, profileId) {
  try {
    const modifiedFromUtc = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString(); // 730 days ago (2 years)

    const response = await axios.get(
      `${forceDecksUrl}/tests`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          TenantId: tenantId,        // Capital T
          ProfileId: profileId,      // Capital P
          ModifiedFromUtc: modifiedFromUtc,  // Capital M and F and U
          limit: 1000,
          IncludeExtendedParameters: true,
          IncludeAttributes: true
        }
      }
    );

    // Handle different response structures (same as valdApiService)
    if (response.data) {
      const tests = response.data.tests || response.data.data || [];
      return tests;
    }
    return [];
  } catch (error) {
    console.log(`  ⚠️ Error fetching from this API: ${error.response?.status || error.message}`);
    return [];
  }
}

checkBlakeProfileTests();
