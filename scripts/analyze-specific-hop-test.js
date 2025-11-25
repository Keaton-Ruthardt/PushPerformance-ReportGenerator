import 'dotenv/config';
import valdApiService from '../server/services/valdApiServiceInstance.js';
import axios from 'axios';

async function analyzeHopTest() {
  try {
    // Use a test ID from BigQuery (most recent from query)
    const testId = 'a4f807dd-2989-4597-a135-7b5046db023a';

    console.log(`🔍 Analyzing Hop Test: ${testId}\n`);

    await valdApiService.authenticate();
    const token = await valdApiService.getAccessToken();

    console.log('📡 Fetching trial data...\n');

    // Try primary API first, then secondary if it fails
    let response = null;
    let apiUsed = null;

    try {
      const url = `${valdApiService.config.forceDecksUrl}/v2019q3/teams/${valdApiService.config.tenantId}/tests/${testId}/trials`;
      console.log('Trying Primary API...');
      response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      apiUsed = 'Primary';
      console.log('✅ Found in Primary API\n');
    } catch (primaryError) {
      console.log('❌ Not in Primary API, trying Secondary API...');
      const url = `${valdApiService.config2.forceDecksUrl}/v2019q3/teams/${valdApiService.config2.tenantId}/tests/${testId}/trials`;
      response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      apiUsed = 'Secondary';
      console.log('✅ Found in Secondary API\n');
    }

    if (response.data && response.data.length > 0) {
      console.log(`✅ Found ${response.data.length} hops in this test\n`);

      // Show first hop structure
      const firstHop = response.data[0];
      console.log('=== First Hop Structure ===');
      console.log('Keys:', Object.keys(firstHop));

      if (firstHop.results) {
        console.log(`\n📊 Number of result metrics: ${firstHop.results.length}\n`);

        // Look for RSI, Jump Height, and Ground Contact Time
        const rsiMetrics = firstHop.results.filter(r =>
          r.definition?.result && r.definition.result.toLowerCase().includes('rsi')
        );

        const jumpHeightMetrics = firstHop.results.filter(r =>
          r.definition?.result &&
          r.definition.result.toLowerCase().includes('jump') &&
          r.definition.result.toLowerCase().includes('height')
        );

        const gctMetrics = firstHop.results.filter(r =>
          r.definition?.result &&
          (r.definition.result.toLowerCase().includes('contact') ||
           r.definition.result.toLowerCase().includes('gct') ||
           r.definition.result.toLowerCase().includes('time'))
        );

        console.log('🎯 RSI Metrics:');
        rsiMetrics.forEach(m => {
          console.log(`  - ${m.definition.result}: ${m.value} ${m.definition?.unit || ''}`);
        });

        console.log('\n🎯 Jump Height Metrics:');
        jumpHeightMetrics.forEach(m => {
          console.log(`  - ${m.definition.result}: ${m.value} ${m.definition?.unit || ''}`);
        });

        console.log('\n🎯 Ground Contact Time Metrics:');
        gctMetrics.forEach(m => {
          console.log(`  - ${m.definition.result}: ${m.value} ${m.definition?.unit || ''}`);
        });

        // Extract all individual hop values
        // NOTE: All individual hops are in firstHop.results with repeated metric names
        const rsiValues = firstHop.results
          .filter(r => r.definition?.result === 'HOP_RSI')
          .map(r => r.value)
          .filter(v => v != null)
          .sort((a, b) => b - a); // Descending for RSI (higher is better)

        const jumpHeightValues = firstHop.results
          .filter(r => r.definition?.result === 'HOP_JUMP_HEIGHT')
          .map(r => r.value)
          .filter(v => v != null)
          .sort((a, b) => b - a); // Descending for jump height (higher is better)

        const gctValues = firstHop.results
          .filter(r => r.definition?.result === 'HOP_CONTACT_TIME')
          .map(r => r.value)
          .filter(v => v != null)
          .sort((a, b) => a - b); // Ascending for GCT (lower is better)

        // Show all individual hops with their key metrics
        console.log('\n\n=== All Individual Hops ===');
        console.log(`Total hops in this test: ${rsiValues.length}\n`);

        // Display each hop's metrics
        for (let i = 0; i < Math.max(rsiValues.length, jumpHeightValues.length, gctValues.length); i++) {
          console.log(`Hop ${i + 1}:`);
          console.log(`  RSI: ${rsiValues[i]?.toFixed(4) || 'N/A'}`);
          console.log(`  Jump Height: ${jumpHeightValues[i]?.toFixed(2) || 'N/A'} cm`);
          console.log(`  Contact Time: ${gctValues[i]?.toFixed(3) || 'N/A'} ms`);
        }

        // Calculate best 5 averages
        console.log('\n\n=== Best 5 Calculations ===')

        const best5RSI = rsiValues.slice(0, 5);
        const best5JH = jumpHeightValues.slice(0, 5);
        const best5GCT = gctValues.slice(0, 5);

        const avgRSI = best5RSI.reduce((a, b) => a + b, 0) / best5RSI.length;
        const avgJH = best5JH.reduce((a, b) => a + b, 0) / best5JH.length;
        const avgGCT = best5GCT.reduce((a, b) => a + b, 0) / best5GCT.length;

        console.log(`\nBest 5 RSI: ${best5RSI.join(', ')}`);
        console.log(`Average of Best 5 RSI: ${avgRSI.toFixed(4)}`);

        console.log(`\nBest 5 Jump Height: ${best5JH.join(', ')}`);
        console.log(`Average of Best 5 Jump Height: ${avgJH.toFixed(4)}`);

        console.log(`\nBest 5 GCT (lowest): ${best5GCT.join(', ')}`);
        console.log(`Average of Best 5 GCT: ${avgGCT.toFixed(4)}`);
      }
    } else {
      console.log('❌ No trial data found for this test');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

analyzeHopTest();
