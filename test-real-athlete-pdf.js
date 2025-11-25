import valdApiService from './server/services/valdApiService.js';
import axios from 'axios';

/**
 * Test script to pull real athlete CMJ data and generate PDF
 */

async function testRealAthletePDF() {
  try {
    console.log('=== SEARCHING FOR ATHLETES ===\n');

    // Search for athletes - try a common name or leave blank to get recent athletes
    const searchTerm = ''; // Leave blank to get recent athletes, or enter a name
    const athletes = await valdApiService.searchAthletes(searchTerm);

    console.log(`Found ${athletes.length} athletes`);

    if (athletes.length === 0) {
      console.log('No athletes found. Try a different search term.');
      return;
    }

    // Display first 5 athletes
    console.log('\nFirst 5 athletes:');
    athletes.slice(0, 5).forEach((athlete, index) => {
      console.log(`${index + 1}. ${athlete.name} (ID: ${athlete.id})`);
      console.log(`   Position: ${athlete.position || 'N/A'}`);
      console.log(`   Organization: ${athlete.organization || 'N/A'}`);
    });

    // Select the first athlete for testing
    const selectedAthlete = athletes[0];
    console.log(`\n=== SELECTED ATHLETE ===`);
    console.log(`Name: ${selectedAthlete.name}`);
    console.log(`ID: ${selectedAthlete.id}`);

    // Get athlete's CMJ test data
    console.log('\n=== FETCHING CMJ TEST DATA ===\n');
    const cmjTest = await valdApiService.getLatestCMJ(selectedAthlete.id);

    if (!cmjTest) {
      console.log('No CMJ test found for this athlete. Trying another athlete...');

      // Try next athletes until we find one with CMJ data
      for (let i = 1; i < Math.min(athletes.length, 10); i++) {
        console.log(`\nTrying athlete: ${athletes[i].name}`);
        const test = await valdApiService.getLatestCMJ(athletes[i].id);
        if (test) {
          selectedAthlete.name = athletes[i].name;
          selectedAthlete.id = athletes[i].id;
          selectedAthlete.position = athletes[i].position;
          selectedAthlete.organization = athletes[i].organization;
          cmjTest = test;
          break;
        }
      }

      if (!cmjTest) {
        console.log('Could not find any athlete with CMJ data in the first 10 results.');
        return;
      }
    }

    console.log('✅ Found CMJ test!');
    console.log(`Test Date: ${cmjTest.testDate}`);
    console.log(`Test Type: ${cmjTest.testType}`);

    // Display ALL available fields in the CMJ test
    console.log('\n=== ALL AVAILABLE FIELDS IN CMJ TEST ===\n');
    console.log(JSON.stringify(cmjTest, null, 2));

    // Map VALD test data to our 13 CMJ metrics
    console.log('\n=== MAPPING TO OUR 13 CMJ METRICS ===\n');

    // We need to find the exact field names from the test data
    // These are our target metrics:
    const targetMetrics = [
      'jumpHeight',
      'eccentricBrakingRFD',
      'forceAtZeroVelocity',
      'eccentricPeakForce',
      'concentricImpulse',
      'eccentricPeakVelocity',
      'concentricPeakVelocity',
      'eccentricPeakPower',
      'eccentricPeakPowerBM',
      'peakPower',
      'peakPowerBM',
      'rsiMod',
      'countermovementDepth'
    ];

    console.log('Target metrics we need:');
    targetMetrics.forEach(metric => console.log(`  - ${metric}`));

    console.log('\n=== NEXT STEP ===');
    console.log('Review the fields above and create the mapping to generate PDF');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testRealAthletePDF();
