import axios from 'axios';

/**
 * Test the /api/athletes/search endpoint directly
 */

async function testSearchEndpoint() {
  try {
    console.log('🔍 Testing /api/athletes/search endpoint...\n');

    // Test searching for "Blake"
    const response = await axios.get('http://localhost:5000/api/athletes/search', {
      params: {
        term: 'Blake',
        mode: 'name'
      }
    });

    console.log('📊 API Response:');
    console.log('Success:', response.data.success);
    console.log('Count:', response.data.count);
    console.log('Athletes returned:', response.data.athletes?.length || 0);
    console.log('\n');

    if (response.data.athletes && response.data.athletes.length > 0) {
      console.log('✅ Athletes found:');
      response.data.athletes.forEach((athlete, index) => {
        console.log(`\n${index + 1}. ${athlete.name}`);
        console.log(`   ID: ${athlete.id}`);
        console.log(`   Profile IDs: ${JSON.stringify(athlete.profileIds)}`);
        console.log(`   Position: ${athlete.position}`);
        console.log(`   Team: ${athlete.team}`);
      });

      // Check specifically for Blake Weiman
      const blakeWeiman = response.data.athletes.find(a =>
        a.name.toLowerCase().includes('blake') && a.name.toLowerCase().includes('weiman')
      );

      if (blakeWeiman) {
        console.log('\n\n✅ ✅ ✅ Blake Weiman IS in the API response!');
        console.log('Full Blake Weiman object:');
        console.log(JSON.stringify(blakeWeiman, null, 2));
      } else {
        console.log('\n\n❌ Blake Weiman NOT found in API response');
      }
    } else {
      console.log('❌ No athletes returned from API');
    }

  } catch (error) {
    console.error('❌ Error calling API endpoint:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testSearchEndpoint();
