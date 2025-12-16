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

const rateLimiter = new RateLimiter(10, 5000); // 10 calls per 5 seconds (very conservative to avoid 403/404)

async function calculateHopMetrics(testId, apiSource) {
  try {
    await rateLimiter.waitIfNeeded();

    // Get the correct token for the API source
    const token = apiSource === 'Secondary'
      ? await valdApiService.getAccessToken2()
      : await valdApiService.getAccessToken();
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

    // Debug: log available fields for first successful test
    if (!calculateHopMetrics.hasLoggedFields) {
      const availableFields = [...new Set(trial.results.map(r => r.definition?.result))];
      console.log(`\n  📋 Available VALD fields in hop test trials:`);
      console.log(`     ${availableFields.filter(f => f && f.includes('HOP')).join(', ')}\n`);
      calculateHopMetrics.hasLoggedFields = true;
    }

    // Extract individual hop values (filter by limb === 'Trial' to get individual jumps, not summary stats)
    // This MUST match the web UI logic exactly (reportRoutes.js:61-67)
    const jumpHeightValues = trial.results
      .filter(r => r.definition?.result === 'HOP_JUMP_HEIGHT' && r.limb === 'Trial')
      .map(r => r.value)
      .filter(v => v != null)
      .sort((a, b) => b - a); // Descending (higher is better)

    const gctValues = trial.results
      .filter(r => r.definition?.result === 'HOP_CONTACT_TIME' && r.limb === 'Trial')
      .map(r => r.value)
      .filter(v => v != null)
      .sort((a, b) => a - b); // Ascending (lower is better)

    // Extract regular HOP_RSI values (standard RSI = flight time / ground contact time ratio)
    // NOT HOP_RSI_MODIFIED!
    const rsiValues = trial.results
      .filter(r => r.definition?.result === 'HOP_RSI' && r.limb === 'Trial')
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

    // Log raw values for debugging
    if (avgRSI !== null) {
      console.log(`     📊 Found ${rsiValues.length} RSI values, best 5: ${best5RSI.map(v => v.toFixed(2)).join(', ')}`);
      console.log(`     📊 Avg RSI: ${avgRSI.toFixed(2)}`);
    }

    return {
      jumpHeight: avgJH,
      gct: avgGCT,
      rsi: avgRSI
    };
  } catch (error) {
    // Only log non-404 errors (404 means test doesn't exist in this API)
    if (error.response?.status !== 404) {
      console.error(`  ❌ Error fetching trials for ${testId}: ${error.message}`);
    }
    return { jumpHeight: null, gct: null, rsi: null };
  }
}

async function populateHopMetrics() {
  try {
    console.log('🔄 RE-POPULATING ALL Hop Test metrics in BigQuery...\n');
    console.log('⚠️  This will overwrite existing data to ensure correct RSI values\n');

    // Authenticate with VALD (try primary, fall back to secondary only if primary fails)
    try {
      await valdApiService.authenticate();
      console.log('✅ VALD Primary authentication successful\n');
    } catch (error) {
      console.log('⚠️  Primary VALD API unavailable, will use Secondary API only\n');
    }

    // Get ALL hop tests from BigQuery (including those with existing data)
    // Filter to Pro/MLB athletes only
    const queryStr = `
      SELECT test_id, full_name, test_date,
             hop_rsi_avg_best_5 as existing_rsi,
             hop_gct_avg_best_5 as existing_gct,
             hop_jump_height_avg_best_5 as existing_jh
      FROM \`${datasetName}.hj_results\`
      WHERE (group_name_1 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball') OR
             group_name_2 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball') OR
             group_name_3 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball'))
      ORDER BY test_date DESC
    `;

    const tests = await query(queryStr);
    console.log(`📊 Found ${tests.length} pro athlete hop tests to process\n`);

    if (tests.length === 0) {
      console.log('⚠️  No pro athlete hop tests found!');
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

    // Step 2: Calculate statistics and identify outliers
    console.log('\n\n🔍 Step 2: Identifying and removing outliers (>3 SD from mean)...\n');

    const statsQuery = `
      SELECT
        AVG(hop_rsi_avg_best_5) as rsi_mean,
        STDDEV(hop_rsi_avg_best_5) as rsi_stddev,
        AVG(hop_gct_avg_best_5) as gct_mean,
        STDDEV(hop_gct_avg_best_5) as gct_stddev,
        AVG(hop_jump_height_avg_best_5) as jh_mean,
        STDDEV(hop_jump_height_avg_best_5) as jh_stddev
      FROM \`${datasetName}.hj_results\`
      WHERE (group_name_1 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball') OR
             group_name_2 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball') OR
             group_name_3 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball'))
        AND hop_rsi_avg_best_5 IS NOT NULL
        AND hop_gct_avg_best_5 IS NOT NULL
        AND hop_jump_height_avg_best_5 IS NOT NULL
    `;

    const stats = await query(statsQuery);
    const { rsi_mean, rsi_stddev, gct_mean, gct_stddev, jh_mean, jh_stddev } = stats[0];

    console.log('📊 Current Statistics (before outlier removal):');
    console.log(`   RSI: Mean = ${rsi_mean?.toFixed(3)}, StdDev = ${rsi_stddev?.toFixed(3)}`);
    console.log(`   GCT: Mean = ${gct_mean?.toFixed(4)}s, StdDev = ${gct_stddev?.toFixed(4)}s`);
    console.log(`   Jump Height: Mean = ${jh_mean?.toFixed(2)}cm, StdDev = ${jh_stddev?.toFixed(2)}cm\n`);

    // Identify outliers (values >3 SD from mean)
    const outliersQuery = `
      SELECT test_id, full_name, test_date,
             hop_rsi_avg_best_5 as rsi,
             hop_gct_avg_best_5 as gct,
             hop_jump_height_avg_best_5 as jh,
             ABS(hop_rsi_avg_best_5 - ${rsi_mean}) / ${rsi_stddev} as rsi_z_score,
             ABS(hop_gct_avg_best_5 - ${gct_mean}) / ${gct_stddev} as gct_z_score,
             ABS(hop_jump_height_avg_best_5 - ${jh_mean}) / ${jh_stddev} as jh_z_score
      FROM \`${datasetName}.hj_results\`
      WHERE (group_name_1 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball') OR
             group_name_2 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball') OR
             group_name_3 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball'))
        AND hop_rsi_avg_best_5 IS NOT NULL
        AND hop_gct_avg_best_5 IS NOT NULL
        AND hop_jump_height_avg_best_5 IS NOT NULL
        AND (
          ABS(hop_rsi_avg_best_5 - ${rsi_mean}) / ${rsi_stddev} > 3
          OR ABS(hop_gct_avg_best_5 - ${gct_mean}) / ${gct_stddev} > 3
          OR ABS(hop_jump_height_avg_best_5 - ${jh_mean}) / ${jh_stddev} > 3
        )
      ORDER BY test_date DESC
    `;

    const outliers = await query(outliersQuery);
    console.log(`🚨 Found ${outliers.length} outliers (>3 SD from mean):\n`);

    for (const outlier of outliers) {
      console.log(`${outlier.full_name} - ${outlier.test_date.value}`);
      if (outlier.rsi_z_score > 3) {
        console.log(`  ⚠️  RSI: ${outlier.rsi?.toFixed(2)} (${outlier.rsi_z_score?.toFixed(1)} SD from mean)`);
      }
      if (outlier.gct_z_score > 3) {
        console.log(`  ⚠️  GCT: ${outlier.gct?.toFixed(4)}s (${outlier.gct_z_score?.toFixed(1)} SD from mean)`);
      }
      if (outlier.jh_z_score > 3) {
        console.log(`  ⚠️  Jump Height: ${outlier.jh?.toFixed(2)}cm (${outlier.jh_z_score?.toFixed(1)} SD from mean)`);
      }
    }

    if (outliers.length > 0) {
      console.log('\n🗑️  Removing outliers from HJ_result_updated table...\n');

      // Delete outliers from the comparison table
      const deleteQuery = `
        DELETE FROM \`vald-ref-data-copy.${datasetName}.HJ_result_updated\`
        WHERE (group_name_1 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball') OR
               group_name_2 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball') OR
               group_name_3 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball'))
          AND (
            ABS(hop_rsi_avg_best_5 - ${rsi_mean}) / ${rsi_stddev} > 3
            OR ABS(hop_gct_avg_best_5 - ${gct_mean}) / ${gct_stddev} > 3
            OR ABS(hop_jump_height_avg_best_5 - ${jh_mean}) / ${jh_stddev} > 3
          )
      `;

      await query(deleteQuery);
      console.log(`✅ Removed ${outliers.length} outliers from comparison dataset\n`);
    }

    // Final statistics after outlier removal
    const finalStats = await query(statsQuery);
    const { rsi_mean: final_rsi_mean, rsi_stddev: final_rsi_stddev,
            gct_mean: final_gct_mean, gct_stddev: final_gct_stddev,
            jh_mean: final_jh_mean, jh_stddev: final_jh_stddev } = finalStats[0];

    console.log('\n📊 Final Statistics (after outlier removal):');
    console.log(`   RSI: Mean = ${final_rsi_mean?.toFixed(3)}, StdDev = ${final_rsi_stddev?.toFixed(3)}`);
    console.log(`   GCT: Mean = ${final_gct_mean?.toFixed(4)}s, StdDev = ${final_gct_stddev?.toFixed(4)}s`);
    console.log(`   Jump Height: Mean = ${final_jh_mean?.toFixed(2)}cm, StdDev = ${final_jh_stddev?.toFixed(2)}cm\n`);

    console.log('\n✅ All done! Data is clean and ready for percentile calculations.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

populateHopMetrics();
