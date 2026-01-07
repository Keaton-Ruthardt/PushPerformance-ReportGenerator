import VALDApiService from '../server/services/valdApiService.js';
import dotenv from 'dotenv';

dotenv.config();

const valdApiService = new VALDApiService();

// Test with Aaron Cohn who we know has SJ test
const profileId = '78b34d0c-e77c-4f65-a71d-da0c69db03cd';

async function quickVerify() {
  console.log('\n🔍 QUICK VERIFICATION OF CORRECT FIELD NAMES\n');
  console.log('='.repeat(70));

  const tests = await valdApiService.getForceDecksTests(profileId, null);
  const sjTests = tests.data.filter(t => t.testType === 'SJ');

  if (sjTests.length === 0) {
    console.log('❌ No SJ tests found!');
    return;
  }

  console.log(`✅ Found ${sjTests.length} SJ test(s)\n`);

  const sjTest = sjTests[0];
  const detailed = await valdApiService.getTestDetails(sjTest);

  console.log('CHECKING THE 5 REQUIRED METRICS:\n');
  console.log('='.repeat(70));

  const requiredMetrics = {
    'JUMP_HEIGHT_Trial_cm': detailed.JUMP_HEIGHT_Trial_cm,
    'FORCE_AT_PEAK_POWER_Trial_N': detailed.FORCE_AT_PEAK_POWER_Trial_N,
    'VELOCITY_AT_PEAK_POWER_Trial_m_per_s': detailed.VELOCITY_AT_PEAK_POWER_Trial_m_per_s,
    'PEAK_TAKEOFF_POWER_Trial_W': detailed.PEAK_TAKEOFF_POWER_Trial_W,
    'BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg': detailed.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg
  };

  let allPresent = true;
  Object.entries(requiredMetrics).forEach(([field, value]) => {
    if (value !== null && value !== undefined) {
      console.log(`✅ ${field.padEnd(55)} = ${value}`);
    } else {
      console.log(`❌ ${field.padEnd(55)} = MISSING!`);
      allPresent = false;
    }
  });

  console.log('\n' + '='.repeat(70));
  if (allPresent) {
    console.log('✅ ALL 5 REQUIRED METRICS HAVE DATA!');
    console.log('   Safe to proceed with full population.');
  } else {
    console.log('❌ SOME METRICS ARE MISSING!');
    console.log('   DO NOT proceed - fix field names first.');
  }
  console.log('='.repeat(70));
}

quickVerify().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
