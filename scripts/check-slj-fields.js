import 'dotenv/config';
import valdApiService from '../server/services/valdApiServiceInstance.js';
import axios from 'axios';

async function checkSLJFields() {
  await valdApiService.authenticate();

  const profileId = '6d93d813-94fe-4690-9925-0ac473d8645d';
  const allTests = await valdApiService.getForceDecksTests(profileId);

  // Find an SLJ test
  const sljTest = allTests.data.find(t => t.testType === 'SLJ' || t.testType === 'Single Leg Jump');

  if (!sljTest) {
    console.log('No SLJ test found');
    process.exit(1);
  }

  console.log('SLJ Test ID:', sljTest.testId || sljTest.id);

  // Get trial details
  const token = await valdApiService.getAccessToken();
  const config = valdApiService.config;

  const response = await axios.get(
    `${config.forceDecksUrl}/v2019q3/teams/${config.tenantId}/tests/${sljTest.testId || sljTest.id}/trials`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  console.log('\nNumber of trials:', response.data.length);

  // Check first trial's results
  if (response.data.length > 0) {
    const trial = response.data[0];
    console.log('\nTrial 0 limb:', trial.limb);
    console.log('\nAvailable result names:');

    if (trial.results) {
      trial.results.forEach(r => {
        console.log(`  - ${r.definition?.result} (${r.definition?.unit}) = ${r.value}`);
      });
    }
  }

  process.exit(0);
}

checkSLJFields().catch(e => { console.error(e); process.exit(1); });
