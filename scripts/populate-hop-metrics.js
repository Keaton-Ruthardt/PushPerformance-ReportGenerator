import 'dotenv/config';
import { query, dataset as datasetName } from '../server/config/bigquery.js';
import valdApiService from '../server/services/valdApiServiceInstance.js';
import axios from 'axios';

// Rate limiting helper
class RateLimiter {
  constructor(maxCalls, perMs) {
    this.maxCalls = maxCalls;
    this.perMs = perMs;
    this.calls = [];
  }

  async waitIfNeeded() {
    const now = Date.now();
    // Remove calls older than the time window
    this.calls = this.calls.filter(time => now - time < this.perMs);

    if (this.calls.length >= this.maxCalls) {
      const oldestCall = this.calls[0];
      const waitTime = this.perMs - (now - oldestCall);
      console.log(`  ⏳ Rate limit: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitIfNeeded();
    }

    this.calls.push(now);
  }
}

const rateLimiter = new RateLimiter(20, 5000); // 20 calls per 5 seconds (conservative)

async function calculateHopMetrics(testId, apiSource) {
  try {
    await rateLimiter.waitIfNeeded();

    const token = await valdApiService.getAccessToken();
    const config = apiSource === 'Secondary' ? valdApiService.config2 : valdApiService.config;

    const response = await axios.get(
      `${config.forceDecksUrl}/v2019q3/teams/${config.tenantId}/tests/${testId}/trials`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data || response.data.length === 0) {
      return { jumpHeight: null, gct: null, rsi: null };
    }

    const trial = response.data[0];
    if (!trial.results) {
      return { jumpHeight: null, gct: null, rsi: null };
    }

    // Extract individual hop values
    const jumpHeightValues = trial.results
      .filter(r => r.definition?.result === 'HOP_JUMP_HEIGHT')
      .map(r => r.value)
      .filter(v => v != null)
      .sort((a, b) => b - a); // Descending (higher is better)

    const gctValues = trial.results
      .filter(r => r.definition?.result === 'HOP_CONTACT_TIME')
      .map(r => r.value)
      .filter(v => v != null)
      .sort((a, b) => a - b); // Ascending (lower is better)

    // Extract regular RSI values (flight time / ground contact time ratio)
    const rsiValues = trial.results
      .filter(r => r.definition?.result === 'HOP_RSI')
      .map(r => r.value)
      .filter(v => v != null)
      .sort((a, b) => b - a); // Descending (higher is better)

    // Calculate best 5 averages
    const best5JH = jumpHeightValues.slice(0, 5);
    const best5GCT = gctValues.slice(0, 5);
    const best5RSI = rsiValues.slice(0, 5);

    const avgJH = best5JH.length > 0
      ? best5JH.reduce((a, b) => a + b, 0) / best5JH.length
      : null;
    const avgGCT = best5GCT.length > 0
      ? best5GCT.reduce((a, b) => a + b, 0) / best5GCT.length
      : null;
    const avgRSI = best5RSI.length > 0
      ? best5RSI.reduce((a, b) => a + b, 0) / best5RSI.length
      : null;

    return {
      jumpHeight: avgJH,
      gct: avgGCT,
      rsi: avgRSI
    };
  } catch (error) {
    console.error(`  ❌ Error fetching trials for ${testId}: ${error.message}`);
    return { jumpHeight: null, gct: null, rsi: null };
  }
}

async function populateHopMetrics() {
  try {
    console.log('🔄 Populating Hop Test metrics in BigQuery...\n');

    // Authenticate with VALD
    await valdApiService.authenticate();
    console.log('✅ VALD authentication successful\n');

    // Get all hop tests from BigQuery
    const queryStr = `
      SELECT test_id, full_name, test_date
      FROM \`${datasetName}.hj_results\`
      WHERE hop_jump_height_avg_best_5 IS NULL
         OR hop_gct_avg_best_5 IS NULL
         OR hop_rsi_avg_best_5 IS NULL
      ORDER BY test_date DESC
    `;

    const tests = await query(queryStr);
    console.log(`📊 Found ${tests.length} hop tests to process\n`);

    if (tests.length === 0) {
      console.log('✅ All tests already have metrics calculated!');
      process.exit(0);
    }

    let processed = 0;
    let updated = 0;
    let failed = 0;

    // Process tests in batches
    const batchSize = 50;
    for (let i = 0; i < tests.length; i += batchSize) {
      const batch = tests.slice(i, i + batchSize);
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1} (tests ${i + 1}-${Math.min(i + batchSize, tests.length)} of ${tests.length})`);

      for (const test of batch) {
        processed++;
        console.log(`\n[${processed}/${tests.length}] ${test.full_name} - ${test.test_date.value}`);
        console.log(`  Test ID: ${test.test_id}`);

        // Try primary API first
        let metrics = await calculateHopMetrics(test.test_id, 'Primary');

        // If not found, try secondary API
        if (metrics.jumpHeight === null && metrics.gct === null && metrics.rsi === null) {
          console.log('  🔄 Trying secondary API...');
          metrics = await calculateHopMetrics(test.test_id, 'Secondary');
        }

        if (metrics.jumpHeight !== null || metrics.gct !== null || metrics.rsi !== null) {
          // Update BigQuery
          const updateQuery = `
            UPDATE \`${datasetName}.hj_results\`
            SET
              hop_jump_height_avg_best_5 = ${metrics.jumpHeight !== null ? metrics.jumpHeight : 'NULL'},
              hop_gct_avg_best_5 = ${metrics.gct !== null ? metrics.gct : 'NULL'},
              hop_rsi_avg_best_5 = ${metrics.rsi !== null ? metrics.rsi : 'NULL'}
            WHERE test_id = '${test.test_id}'
          `;

          await query(updateQuery);
          updated++;

          console.log(`  ✅ Updated:`);
          if (metrics.rsi !== null) {
            console.log(`     RSI Avg: ${metrics.rsi.toFixed(2)}`);
          }
          if (metrics.jumpHeight !== null) {
            console.log(`     Jump Height Avg: ${metrics.jumpHeight.toFixed(2)} cm`);
          }
          if (metrics.gct !== null) {
            console.log(`     GCT Avg: ${metrics.gct.toFixed(3)} s`);
          }
        } else {
          failed++;
          console.log('  ⚠️  No metrics found in either API');
        }
      }

      // Progress update
      console.log(`\n📈 Progress: ${processed}/${tests.length} processed, ${updated} updated, ${failed} failed`);
    }

    console.log('\n\n✅ Population complete!');
    console.log(`📊 Final stats:`);
    console.log(`   Total processed: ${processed}`);
    console.log(`   Successfully updated: ${updated}`);
    console.log(`   Failed: ${failed}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

populateHopMetrics();
