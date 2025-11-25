import 'dotenv/config';
import valdApiService from '../server/services/valdApiServiceInstance.js';

async function testEndpoint() {
  try {
    await valdApiService.authenticate();

    const profileId = '6d93d813-94fe-4690-9925-0ac473d8645d'; // Colton Lafave

    // Get ALL tests for this athlete
    const allTests = await valdApiService.getForceDecksTests(profileId);

    console.log('Total tests:', allTests.data?.length);

    // Group tests by type (mimicking the route logic)
    const testsByType = {
      cmj: [],
      squatJump: [],
      imtp: [],
      singleLegCMJ: [],
      hopTest: [],
      plyoPushUp: [],
      dropJump: []
    };

    const genericSLJTests = [];

    allTests.data?.forEach((test, index) => {
      const testId = test.id || test.testId || test.testType + '-' + index;
      const testWithId = { ...test, testId, id: testId };

      console.log('Test:', test.testType, testId);

      switch(test.testType) {
        case 'CMJ':
          testsByType.cmj.push(testWithId);
          break;
        case 'SJ':
          testsByType.squatJump.push(testWithId);
          break;
        case 'SLJ':
        case 'Single Leg Jump':
          console.log('  -> Found SLJ test!');
          genericSLJTests.push(testWithId);
          break;
        case 'HJ':
        case 'Hop Test':
          testsByType.hopTest.push(testWithId);
          break;
        case 'IMTP':
          testsByType.imtp.push(testWithId);
          break;
        case 'PPU':
          testsByType.plyoPushUp.push(testWithId);
          break;
      }
    });

    console.log('\nGeneric SLJ tests to process:', genericSLJTests.length);

    // Process SLJ tests
    for (const test of genericSLJTests) {
      console.log('\nProcessing SLJ test:', test.testId);
      const testDetails = await valdApiService.getTestDetails(test);
      console.log('  testDetails exists:', testDetails ? 'yes' : 'no');
      console.log('  testDetails.trials exists:', testDetails?.trials ? 'yes' : 'no');
      console.log('  testDetails.trials length:', testDetails?.trials?.length);

      if (testDetails?.trials?.[0]) {
        const trial = testDetails.trials[0];
        console.log('  trial.limb:', trial.limb);
        console.log('  trial.side:', trial.side);
        console.log('  trial keys:', Object.keys(trial).slice(0, 10));
      }

      // Add to singleLegCMJ
      testsByType.singleLegCMJ.push({ ...test, limb: 'Unknown' });
    }

    console.log('\nFinal singleLegCMJ count:', testsByType.singleLegCMJ.length);
    console.log('\nAll test counts:');
    Object.entries(testsByType).forEach(([type, tests]) => {
      console.log('  ' + type + ':', tests.length);
    });

  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  }
  process.exit(0);
}

testEndpoint();
