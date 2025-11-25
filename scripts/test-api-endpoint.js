import 'dotenv/config';

async function testApiEndpoint() {
  try {
    // Start a simple test - make an HTTP request to the actual endpoint
    const athleteId = '6d93d813-94fe-4690-9925-0ac473d8645d'; // Colton Lafave

    console.log('Testing endpoint: /api/athletes/' + athleteId + '/tests/all');
    console.log('Make sure the server is running on port 5000\n');

    const response = await fetch(`http://localhost:5000/api/athletes/${athleteId}/tests/all`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('Response success:', data.success);
    console.log('Total tests:', data.totalTests);
    console.log('\nTests by type:');

    Object.entries(data.tests).forEach(([type, tests]) => {
      console.log(`  ${type}: ${tests.length}`);
      if (type === 'singleLegCMJ' && tests.length > 0) {
        tests.forEach((test, i) => {
          console.log(`    [${i}] ID: ${test.testId?.substring(0, 8)}...`);
          console.log(`        Date: ${test.recordedDateUtc || test.testDate}`);
          console.log(`        Limbs Available: ${test.limbsAvailable || 'N/A'}`);
        });
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\nMake sure the server is running: npm run dev');
    }
  }
  process.exit(0);
}

testApiEndpoint();
