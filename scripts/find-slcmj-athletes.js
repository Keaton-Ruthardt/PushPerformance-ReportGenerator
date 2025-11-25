import 'dotenv/config';
import valdApiService from '../server/services/valdApiServiceInstance.js';

/**
 * Find athletes with Single Leg CMJ tests (SLJ)
 * Searches across both primary and secondary VALD APIs
 */
async function findSLCMJAthletes() {
  try {
    console.log('🔍 Searching for athletes with Single Leg CMJ/SLJ tests...\n');

    // Authenticate first
    await valdApiService.authenticate();

    // Get all ForceDecks tests
    const allTests = await valdApiService.getForceDecksTests();

    if (!allTests || !allTests.data) {
      console.log('No tests found');
      process.exit(1);
    }

    console.log(`📊 Found ${allTests.data.length} total ForceDecks tests\n`);

    // Filter for SLJ/Single Leg related tests
    const sljTestTypes = [
      'SLJ',
      'Single Leg Jump',
      'Single Leg CMJ',
      'Single Leg CMJ - Left',
      'Single Leg CMJ - Right',
      'SL CMJ',
      'SL CMJ - Left',
      'SL CMJ - Right'
    ];

    const sljTests = allTests.data.filter(t =>
      sljTestTypes.some(type => t.testType === type || (t.testType && t.testType.includes(type)))
    );

    console.log(`🦵 Found ${sljTests.length} Single Leg CMJ/SLJ tests\n`);

    // Group by athlete
    const byAthlete = {};
    sljTests.forEach(t => {
      const name = t.fullName || t.athleteName || 'Unknown';
      const profileId = t.profileId;
      const key = `${name}_${profileId}`;

      if (!byAthlete[key]) {
        byAthlete[key] = {
          name,
          profileId,
          tests: []
        };
      }
      byAthlete[key].tests.push({
        testId: t.testId || t.id,
        date: t.testDate || t.recordedDateUtc,
        testType: t.testType
      });
    });

    // Show athletes with SLJ tests
    console.log('Athletes with Single Leg CMJ/SLJ tests:');
    console.log('=' .repeat(60) + '\n');

    const athletes = Object.values(byAthlete);
    athletes.slice(0, 25).forEach((athlete, idx) => {
      console.log(`${idx + 1}. ${athlete.name}`);
      console.log(`   Profile ID: ${athlete.profileId}`);
      console.log(`   Tests: ${athlete.tests.length}`);

      // Group tests by date
      const byDate = {};
      athlete.tests.forEach(t => {
        const dateKey = t.date ? t.date.split('T')[0] : 'Unknown';
        if (!byDate[dateKey]) byDate[dateKey] = [];
        byDate[dateKey].push(t);
      });

      Object.entries(byDate).slice(0, 3).forEach(([date, tests]) => {
        console.log(`     ${date}: ${tests.length} test(s) - ${tests.map(t => t.testType).join(', ')}`);
      });
      console.log('');
    });

    console.log('=' .repeat(60));
    console.log(`\n🎯 Total: ${athletes.length} athlete(s) with SLJ tests`);

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

findSLCMJAthletes();
