import VALDApiService from '../server/services/valdApiService.js';
import dotenv from 'dotenv';

dotenv.config();

const valdApiService = new VALDApiService();

async function inspectSJTestData() {
  console.log('\n🔍 INSPECTING SJ TEST DATA FROM VALD API\n');

  // Use a profile we know has SJ tests (from earlier testing)
  const profileId = '5abe0262-8f68-4ef5-bf3f-b98e01f60267'; // Mady Lackey
  const profileName = 'Mady Lackey';

  try {
    console.log(`📋 Fetching SJ tests for: ${profileName}`);
    console.log(`   Profile ID: ${profileId}\n`);

    // Get all tests
    const allTests = await valdApiService.getForceDecksTests(profileId, null);
    const sjTests = allTests.data.filter(t => t.testType === 'SJ');

    if (sjTests.length === 0) {
      console.log('❌ No SJ tests found');
      return;
    }

    console.log(`✅ Found ${sjTests.length} SJ test(s)\n`);

    // Get first SJ test
    const sjTest = sjTests[0];

    console.log('='.repeat(70));
    console.log('TEST SUMMARY (from getForceDecksTests):');
    console.log('='.repeat(70));
    console.log(JSON.stringify(sjTest, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('FETCHING DETAILED TEST DATA (getTestDetails):');
    console.log('='.repeat(70));

    const detailedTest = await valdApiService.getTestDetails(sjTest);

    console.log('\nDetailed Test Data:');
    console.log(JSON.stringify(detailedTest, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('CHECKING FOR REQUIRED METRICS:');
    console.log('='.repeat(70));

    const requiredMetrics = {
      'JUMP_HEIGHT_Trial_cm': detailedTest.JUMP_HEIGHT_Trial_cm,
      'FORCE_AT_PEAK_POWER_Trial_N': detailedTest.FORCE_AT_PEAK_POWER_Trial_N,
      'CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s': detailedTest.CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s,
      'PEAK_POWER_Trial_W': detailedTest.PEAK_POWER_Trial_W,
      'BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg': detailedTest.BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg
    };

    Object.entries(requiredMetrics).forEach(([metric, value]) => {
      if (value !== null && value !== undefined) {
        console.log(`✅ ${metric.padEnd(50)} ${value}`);
      } else {
        console.log(`❌ ${metric.padEnd(50)} NOT FOUND`);
      }
    });

    console.log('\n' + '='.repeat(70));
    console.log('ALL AVAILABLE FIELDS IN DETAILED TEST:');
    console.log('='.repeat(70));
    const fields = Object.keys(detailedTest).sort();
    fields.forEach((field, index) => {
      const value = detailedTest[field];
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      console.log(`${(index + 1).toString().padStart(3)}. ${field.padEnd(50)} = ${valueStr.substring(0, 50)}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

inspectSJTestData().then(() => process.exit(0));
