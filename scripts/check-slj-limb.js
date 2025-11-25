import 'dotenv/config';
import valdApiService from '../server/services/valdApiServiceInstance.js';
import axios from 'axios';

async function checkSLJLimbInfo() {
  try {
    await valdApiService.authenticate();

    const testObj = {
      testId: '3deb6228-d98c-49af-89d4-6af28cf1540b',
      testType: 'SLJ',
      apiSource: 'Primary'
    };

    const token = await valdApiService.getAccessToken();

    const url = `${valdApiService.config.forceDecksUrl}/v2019q3/teams/${valdApiService.config.tenantId}/tests/${testObj.testId}/trials`;

    console.log('Fetching trial data from:', url);

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.length > 0) {
      const trial = response.data[0];
      console.log('\n=== Trial Data Structure ===');
      console.log('Has limb property?', trial.limb ? 'YES' : 'NO');
      console.log('Limb value:', trial.limb);
      console.log('\nFirst 10 results with limb info:');
      if (trial.results) {
        trial.results.slice(0, 10).forEach(r => {
          console.log(`  - ${r.definition?.result}: limb=${r.limb || 'N/A'}, value=${r.value}`);
        });
      }

      // Check if any results have limb = "Left" or "Right"
      if (trial.results) {
        const leftResults = trial.results.filter(r => r.limb === 'Left' || r.limb === 'left' || r.limb === 'L');
        const rightResults = trial.results.filter(r => r.limb === 'Right' || r.limb === 'right' || r.limb === 'R');

        console.log(`\nLeft limb results: ${leftResults.length}`);
        console.log(`Right limb results: ${rightResults.length}`);

        if (leftResults.length > 0) {
          console.log('\nSample LEFT results:');
          leftResults.slice(0, 3).forEach(r => {
            console.log(`  - ${r.definition?.result} (${r.limb}): ${r.value}`);
          });
        }

        if (rightResults.length > 0) {
          console.log('\nSample RIGHT results:');
          rightResults.slice(0, 3).forEach(r => {
            console.log(`  - ${r.definition?.result} (${r.limb}): ${r.value}`);
          });
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

checkSLJLimbInfo();
