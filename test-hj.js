import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const VALD_API_KEY = process.env.VALD_API_KEY;
const VALD_API_SECRET = process.env.VALD_API_SECRET;
const TENANT_ID = process.env.TENANT_ID;
const AUTH_URL = "https://security.valdperformance.com/connect/token";
const FORCEDECKS_URL = "https://prd-use-api-extforcedecks.valdperformance.com";

async function checkHJTest() {
  console.log('Checking if HJ is a valid test in VALD ForceDecks...\n');

  try {
    // Authenticate
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

    // Get recent tests to see what test types exist
    console.log('2. Fetching recent tests from ForceDecks...');
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const response = await axios.get(`${FORCEDECKS_URL}/tests`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        TenantId: TENANT_ID,
        ModifiedFromUtc: ninetyDaysAgo.toISOString(),
        limit: 100
      }
    });

    console.log('✅ Tests retrieved\n');

    if (response.data && response.data.tests) {
      const allTestTypes = new Set();
      const hjTests = [];

      response.data.tests.forEach(test => {
        allTestTypes.add(test.testType);
        if (test.testType && test.testType.toLowerCase().includes('hj')) {
          hjTests.push(test);
        }
      });

      console.log('=== ALL TEST TYPES FOUND ===');
      const sortedTypes = Array.from(allTestTypes).sort();
      sortedTypes.forEach(type => {
        console.log(`  - ${type}`);
      });

      console.log(`\n=== HJ TEST SEARCH ===`);
      if (hjTests.length > 0) {
        console.log(`✅ Found ${hjTests.length} tests with "HJ" in the name:`);
        hjTests.slice(0, 5).forEach((test, i) => {
          console.log(`\n${i + 1}. Test Type: ${test.testType}`);
          console.log(`   Test ID: ${test.testId}`);
          console.log(`   Profile: ${test.profileGivenName} ${test.profileFamilyName}`);
          console.log(`   Date: ${test.testDateTimeUtc}`);
        });
      } else {
        console.log('❌ No tests found with "HJ" in the test type');
        console.log('\nSearching for similar test types...');
        const jumpTests = sortedTypes.filter(t =>
          t.toLowerCase().includes('jump') ||
          t.toLowerCase().includes('hop') ||
          t.toLowerCase().includes('horizontal')
        );
        if (jumpTests.length > 0) {
          console.log('Found these jump-related test types:');
          jumpTests.forEach(type => console.log(`  - ${type}`));
        }
      }

      // Check if there's a specific HJ test type exactly
      const exactHJ = sortedTypes.find(t => t.toUpperCase() === 'HJ' || t.toLowerCase() === 'hj');
      if (exactHJ) {
        console.log(`\n✅ YES - "HJ" is a valid test type in VALD (exact match: "${exactHJ}")`);
      } else {
        console.log(`\n❌ NO - "HJ" is NOT found as an exact test type match`);
      }

    } else {
      console.log('No tests found in response');
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkHJTest();
