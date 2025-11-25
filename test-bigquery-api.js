import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Test credentials
const loginData = {
  username: 'pushtrainer',
  password: 'PushPerformance2025!'
};

async function testAPI() {
  console.log('🧪 Testing BigQuery API Integration\n');

  try {
    // 1. Test login
    console.log('1️⃣ Testing authentication...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, loginData);
    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // Configure axios with auth token
    const authAxios = axios.create({
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // 2. Test athlete search
    console.log('\n2️⃣ Testing athlete search...');
    const searchResponse = await authAxios.get(`${API_URL}/performance/search?name=John`);
    console.log(`✅ Found ${searchResponse.data.length} athletes`);

    if (searchResponse.data.length > 0) {
      console.log('Sample athlete:', searchResponse.data[0]);
    }

    // 3. Test getting a specific athlete profile (if we have any results)
    if (searchResponse.data.length > 0) {
      const profileId = searchResponse.data[0].profile_id;
      console.log(`\n3️⃣ Testing athlete profile fetch (ID: ${profileId})...`);

      const profileResponse = await authAxios.get(`${API_URL}/performance/profile/${profileId}`);
      console.log('✅ Profile fetched:', {
        name: `${profileResponse.data.given_name} ${profileResponse.data.family_name}`,
        sport: profileResponse.data.sport,
        gender: profileResponse.data.gender
      });

      // 4. Test getting performance data
      console.log(`\n4️⃣ Testing performance data fetch...`);
      const performanceResponse = await authAxios.get(`${API_URL}/performance/athlete/${profileId}/all`);
      console.log('✅ Performance data fetched');

      // Show what tests are available
      const perf = performanceResponse.data.performance;
      console.log('Available test data:');
      console.log(`   - CMJ tests: ${perf.cmj ? perf.cmj.length : 0}`);
      console.log(`   - Sprint tests: ${perf.sprint ? perf.sprint.length : 0}`);
      console.log(`   - HJ tests: ${perf.horizontalJump ? perf.horizontalJump.length : 0}`);

      // 5. Test report generation
      console.log(`\n5️⃣ Testing report generation...`);
      const reportResponse = await authAxios.post(`${API_URL}/performance/athlete/${profileId}/report`, {
        testTypes: ['cmj', 'sprint']
      });
      console.log('✅ Report generated successfully');
      console.log('Report includes:', Object.keys(reportResponse.data));
    }

    console.log('\n✅ All tests passed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Run tests
testAPI();