import axios from 'axios';

async function testBlakeWSearch() {
  try {
    console.log('🔍 Testing search for "blake w"...\n');

    const response = await axios.get('http://localhost:5000/api/athletes/search', {
      params: {
        term: 'blake w',
        mode: 'name'
      }
    });

    console.log('Success:', response.data.success);
    console.log('Count:', response.data.count);
    console.log('\nAthletes returned:');

    if (response.data.athletes) {
      response.data.athletes.forEach((athlete, index) => {
        console.log(`${index + 1}. ${athlete.name} (ID: ${athlete.id})`);
      });

      const hasWeiman = response.data.athletes.some(a => a.name.includes('Weiman'));
      const hasWilson = response.data.athletes.some(a => a.name.includes('Wilson'));

      console.log('\n');
      console.log('Blake Weiman found?', hasWeiman ? '✅ YES' : '❌ NO');
      console.log('Blake Wilson found?', hasWilson ? '✅ YES' : '❌ NO');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBlakeWSearch();
