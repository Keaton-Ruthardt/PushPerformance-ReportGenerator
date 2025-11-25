import valdApiService from '../server/services/valdApiServiceInstance.js';

async function checkBlakeValdTests() {
  try {
    console.log('🔍 Checking Blake Weiman test types in VALD API...\n');

    const profileId = '947548a9-b81f-474a-9863-6dc14a3078c4';
    const tests = await valdApiService.getForceDecksTests([profileId]);

    console.log(`✅ Found ${tests.data.length} total tests\n`);

    // Group by test type
    const testTypes = {};
    tests.data.forEach(test => {
      const type = test.testType || 'Unknown';
      if (!testTypes[type]) {
        testTypes[type] = [];
      }
      testTypes[type].push(test);
    });

    console.log('📊 Test types breakdown:');
    Object.entries(testTypes)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([type, tests]) => {
        console.log(`  ${type}: ${tests.length} tests`);
      });

    // Check specifically for hop-related test types
    console.log('\n🔍 Hop-related test types:');
    Object.keys(testTypes)
      .filter(type => type.toLowerCase().includes('hop'))
      .forEach(type => {
        console.log(`  ✓ ${type}: ${testTypes[type].length} tests`);
        // Show first test as example
        if (testTypes[type].length > 0) {
          console.log(`    Example test ID: ${testTypes[type][0].testId || testTypes[type][0].id}`);
        }
      });

    if (Object.keys(testTypes).filter(t => t.toLowerCase().includes('hop')).length === 0) {
      console.log('  ⚠️  No hop-related test types found!');
      console.log('\n  All test types:');
      Object.keys(testTypes).forEach(type => {
        console.log(`    - ${type}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBlakeValdTests();
