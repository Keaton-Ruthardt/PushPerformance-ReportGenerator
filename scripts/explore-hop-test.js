import 'dotenv/config';
import valdApiService from '../server/services/valdApiServiceInstance.js';
import axios from 'axios';

async function exploreHopTest() {
  try {
    console.log('🔍 Exploring Hop Test data structure...\n');

    await valdApiService.authenticate();

    // Search for an athlete with hop tests
    console.log('📊 Searching for athletes with Hop Test data...');

    // Get a sample of athletes
    const searchTerms = ['a', 'b', 'c'];
    let allAthletes = new Map();

    for (const term of searchTerms) {
      const results = await valdApiService.searchAthletes(term, 'name');
      results.forEach(athlete => {
        allAthletes.set(athlete.id, athlete);
      });
    }

    const athletes = Array.from(allAthletes.values());
    console.log(`Found ${athletes.length} athletes to check\n`);

    // Check first 50 athletes for hop tests
    for (let i = 0; i < Math.min(50, athletes.length); i++) {
      const athlete = athletes[i];

      try {
        for (const profileId of athlete.profileIds) {
          const result = await valdApiService.getForceDecksTests(profileId);
          const tests = result.data || [];

          const hopTests = tests.filter(t =>
            t.testType && (
              t.testType.toLowerCase().includes('hop') ||
              t.testType === 'HT' ||
              t.testType === 'Hop Test'
            )
          );

          if (hopTests.length > 0) {
            console.log(`\n✅ Found ${hopTests.length} Hop Test(s) for ${athlete.name}`);

            // Get detailed data for the first hop test
            const hopTest = hopTests[0];
            console.log(`\n📋 Hop Test ID: ${hopTest.testId}`);
            console.log(`   Test Type: ${hopTest.testType}`);
            console.log(`   Date: ${hopTest.recordedDateUtc}`);

            // Fetch trial data to see individual hops
            const token = await valdApiService.getAccessToken();
            const config = hopTest.apiSource === 'Secondary' ? valdApiService.config2 : valdApiService.config;

            const trialsResponse = await axios.get(
              `${config.forceDecksUrl}/v2019q3/teams/${config.tenantId}/tests/${hopTest.testId}/trials`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (trialsResponse.data && trialsResponse.data.length > 0) {
              console.log(`\n📊 Found ${trialsResponse.data.length} trial(s)/hop(s)`);

              // Show first trial structure
              const firstTrial = trialsResponse.data[0];
              console.log(`\n=== First Hop/Trial Structure ===`);
              console.log('Trial keys:', Object.keys(firstTrial).slice(0, 20));

              if (firstTrial.results) {
                console.log(`\n📈 Number of results: ${firstTrial.results.length}`);
                console.log('\nFirst 20 result metrics:');
                firstTrial.results.slice(0, 20).forEach(r => {
                  console.log(`  - ${r.definition?.result}: ${r.value} ${r.definition?.unit || ''}`);
                });

                // Look for RSI, Jump Height, and Ground Contact Time
                const rsiResults = firstTrial.results.filter(r =>
                  r.definition?.result?.toLowerCase().includes('rsi')
                );
                const jumpHeightResults = firstTrial.results.filter(r =>
                  r.definition?.result?.toLowerCase().includes('jump') &&
                  r.definition?.result?.toLowerCase().includes('height')
                );
                const gctResults = firstTrial.results.filter(r =>
                  r.definition?.result?.toLowerCase().includes('contact') ||
                  r.definition?.result?.toLowerCase().includes('gct')
                );

                console.log(`\n🎯 Key Metrics Found:`);
                console.log(`   RSI metrics: ${rsiResults.length}`);
                if (rsiResults.length > 0) {
                  rsiResults.forEach(r => {
                    console.log(`     - ${r.definition.result}: ${r.value}`);
                  });
                }

                console.log(`   Jump Height metrics: ${jumpHeightResults.length}`);
                if (jumpHeightResults.length > 0) {
                  jumpHeightResults.forEach(r => {
                    console.log(`     - ${r.definition.result}: ${r.value} ${r.definition?.unit}`);
                  });
                }

                console.log(`   Ground Contact Time metrics: ${gctResults.length}`);
                if (gctResults.length > 0) {
                  gctResults.forEach(r => {
                    console.log(`     - ${r.definition.result}: ${r.value} ${r.definition?.unit}`);
                  });
                }

                // Show all trials to understand how many hops
                console.log(`\n📊 All ${trialsResponse.data.length} hops/trials:`);
                trialsResponse.data.forEach((trial, idx) => {
                  const jumpHeight = trial.results?.find(r =>
                    r.definition?.result?.toLowerCase().includes('jump') &&
                    r.definition?.result?.toLowerCase().includes('height')
                  );
                  const gct = trial.results?.find(r =>
                    r.definition?.result?.toLowerCase().includes('contact time')
                  );
                  const rsi = trial.results?.find(r =>
                    r.definition?.result?.toLowerCase().includes('rsi') &&
                    !r.definition?.result?.toLowerCase().includes('modified')
                  );

                  console.log(`   Hop ${idx + 1}: JH=${jumpHeight?.value || 'N/A'}${jumpHeight?.definition?.unit || ''}, GCT=${gct?.value || 'N/A'}${gct?.definition?.unit || ''}, RSI=${rsi?.value || 'N/A'}`);
                });
              }

              console.log('\n✅ Found hop test data! Stopping search.');
              process.exit(0);
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`  ❌ Error checking ${athlete.name}: ${error.message}`);
      }
    }

    console.log('\n⚠️  No hop tests found in sample');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

exploreHopTest();
