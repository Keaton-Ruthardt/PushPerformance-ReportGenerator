import 'dotenv/config';
import valdApiService from '../server/services/valdApiServiceInstance.js';
import axios from 'axios';

async function findSLJ() {
  try {
    console.log('🔍 Searching for SLJ tests in VALD API...\n');

    await valdApiService.authenticate();

    const token = await valdApiService.getAccessToken();

    // Search for athletes by name
    const searchTerms = ['a', 'b', 'c', 'd', 'e', 'm', 'r', 's', 'j', 'w'];
    const athletesChecked = new Set();
    let foundSLJ = [];

    for (const term of searchTerms) {
      console.log(`Searching for athletes with '${term}'...`);

      try {
        const athletes = await valdApiService.searchAthletes(term, 'name');
        console.log(`  Found ${athletes.length} athletes`);

        for (const athlete of athletes.slice(0, 20)) {
          if (athletesChecked.has(athlete.id)) continue;
          athletesChecked.add(athlete.id);

          try {
            // Get athlete's tests
            const profileIds = athlete.profileIds || [athlete.id];
            const tests = await valdApiService.getForceDecksTests(profileIds);

            if (tests && tests.data) {
              // Look for SLJ tests
              const sljTests = tests.data.filter(t => {
                const type = (t.testType || '').toLowerCase();
                return type.includes('single leg') ||
                  type === 'slj' ||
                  type.includes('sl cmj') ||
                  type.includes('slj');
              });

              if (sljTests.length > 0) {
                console.log(`  🦵 ${athlete.name}: ${sljTests.length} SLJ test(s)`);
                sljTests.forEach(t => {
                  console.log(`     - ${t.testType} on ${(t.testDate || t.recordedDateUtc || '').split('T')[0]}`);
                  console.log(`       Test ID: ${t.testId || t.id}`);
                });
                foundSLJ.push({
                  name: athlete.name,
                  id: athlete.id,
                  profileIds: athlete.profileIds,
                  tests: sljTests
                });

                if (foundSLJ.length >= 5) {
                  console.log('\n✅ Found 5 athletes with SLJ tests!');
                  process.exit(0);
                }
              }
            }
          } catch (e) {
            // Skip errors for individual athletes
          }
        }
      } catch (e) {
        console.log(`  Error: ${e.message}`);
      }

      if (foundSLJ.length >= 5) break;
    }

    if (foundSLJ.length > 0) {
      console.log('\n\n===== Athletes with Single Leg CMJ Tests =====\n');
      foundSLJ.forEach((a, i) => {
        console.log(`${i + 1}. ${a.name}`);
        console.log(`   Profile IDs: ${JSON.stringify(a.profileIds)}`);
        console.log(`   Tests: ${a.tests.length}`);
      });
    } else {
      console.log('\n⚠️  No athletes with SLJ tests found.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

findSLJ();
