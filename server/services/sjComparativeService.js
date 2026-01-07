import { query, dataset } from '../config/bigquery.js';

/**
 * Squat Jump Comparative Analysis Service
 * Compares individual athlete SJ metrics against professional athlete population
 */

// The 5 Squat Jump metrics we're tracking for comparative analysis
// IMPORTANT: These field names match what VALD API actually returns
const SJ_METRICS = {
  jumpHeight: 'JUMP_HEIGHT_Trial_cm', // Convert from cm to inches (no native inches field)
  forceAtPeakPower: 'FORCE_AT_PEAK_POWER_Trial_N',
  concentricPeakVelocity: 'VELOCITY_AT_PEAK_POWER_Trial_m_per_s', // Was: CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s
  peakPower: 'PEAK_TAKEOFF_POWER_Trial_W', // Was: PEAK_POWER_Trial_W
  peakPowerBM: 'BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg' // Was: BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg
};

// Metrics that need to be converted from cm to inches for display
const CM_TO_INCHES_METRICS = ['jumpHeight'];

/**
 * Convert centimeters to inches
 */
function cmToInches(cm) {
  if (cm === null || cm === undefined) return null;
  return cm / 2.54;
}

/**
 * Get professional athlete bucket statistics for all SJ metrics
 * Returns mean, std dev, and percentile distribution for each metric
 */
async function getProAthleteStats() {
  try {
    console.log('📊 Fetching pro athlete SJ statistics from BigQuery...');
    console.log('📊 SJ_METRICS object:', SJ_METRICS);

    // Build dynamic SQL to get stats for all metrics
    // Use p1 and p99 instead of MIN/MAX to filter outliers
    const metricStats = Object.entries(SJ_METRICS).map(([key, column]) => `
      -- ${key}
      AVG(${column}) as ${key}_mean,
      STDDEV(${column}) as ${key}_stddev,
      APPROX_QUANTILES(${column}, 100)[OFFSET(1)] as ${key}_p1,
      APPROX_QUANTILES(${column}, 100)[OFFSET(5)] as ${key}_p5,
      APPROX_QUANTILES(${column}, 100)[OFFSET(10)] as ${key}_p10,
      APPROX_QUANTILES(${column}, 100)[OFFSET(25)] as ${key}_p25,
      APPROX_QUANTILES(${column}, 100)[OFFSET(50)] as ${key}_p50,
      APPROX_QUANTILES(${column}, 100)[OFFSET(75)] as ${key}_p75,
      APPROX_QUANTILES(${column}, 100)[OFFSET(90)] as ${key}_p90,
      APPROX_QUANTILES(${column}, 100)[OFFSET(95)] as ${key}_p95,
      APPROX_QUANTILES(${column}, 100)[OFFSET(99)] as ${key}_p99
    `).join(',\n');

    const sql = `
      SELECT
        COUNT(*) as total_tests,
        ${metricStats}
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
      WHERE (group_name_1 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB') OR
             group_name_2 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB') OR
             group_name_3 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB'))
        AND DATE(test_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 YEAR)
    `;

    console.log('🔍 Generated BigQuery SQL:', sql);
    const results = await query(sql);

    if (results.length === 0) {
      console.log('⚠️  No pro athlete SJ data found, will use mock data');
      return null;
    }

    const stats = results[0];
    console.log(`✅ Loaded stats from ${stats.total_tests} pro athlete SJ tests`);

    // Log the actual stat values to debug
    console.log('📊 Pro athlete SJ stats:');
    Object.keys(SJ_METRICS).forEach(key => {
      console.log(`   ${key}:`, {
        mean: stats[`${key}_mean`],
        p1: stats[`${key}_p1`],
        p50: stats[`${key}_p50`],
        p99: stats[`${key}_p99`]
      });
    });

    return stats;
  } catch (error) {
    console.error('❌ Error fetching pro athlete SJ stats:', error);
    return null;
  }
}

/**
 * Calculate percentile rank for a specific value compared to pro athlete population
 * @param {number} value - The athlete's metric value
 * @param {string} metricKey - The metric key (e.g., 'jumpHeight')
 * @param {object} proStats - Pro athlete statistics object
 * @param {boolean} convertToInches - If true, athlete value is in inches and needs to be converted back to cm for comparison
 * @returns {number} Percentile rank (0-100)
 */
function calculatePercentile(value, metricKey, proStats, convertToInches = false) {
  if (value === null || value === undefined || !proStats) return null;

  // If the value is in inches but proStats are in cm, convert value back to cm for comparison
  const compareValue = convertToInches ? value * 2.54 : value;

  // Use p1 and p99 to filter outliers instead of absolute min/max
  const p1 = proStats[`${metricKey}_p1`];
  const p5 = proStats[`${metricKey}_p5`];
  const p10 = proStats[`${metricKey}_p10`];
  const p25 = proStats[`${metricKey}_p25`];
  const p50 = proStats[`${metricKey}_p50`];
  const p75 = proStats[`${metricKey}_p75`];
  const p90 = proStats[`${metricKey}_p90`];
  const p95 = proStats[`${metricKey}_p95`];
  const p99 = proStats[`${metricKey}_p99`];

  // Detailed logging for debugging
  console.log(`\n🔍 Calculating percentile for ${metricKey}:`);
  console.log(`   Athlete value: ${value}${convertToInches ? ' (in)' : ''}, compareValue: ${compareValue}`);
  console.log(`   Pro stats - p1: ${p1}, p99: ${p99}, p50: ${p50}`);

  // Check if we have valid data
  if (p1 === null || p99 === null || p1 === undefined || p99 === undefined) {
    console.log(`⚠️  ${metricKey}: No valid percentile data`);
    return null;
  }

  // Check if p1 and p99 are the same (no variation in data)
  if (p1 === p99) {
    console.log(`⚠️  ${metricKey}: p1 equals p99 (${p1}), cannot calculate percentile`);
    return null;
  }

  // Handle edge cases - cap at p1 and p99 to filter outliers
  if (compareValue <= p1) {
    console.log(`   ➡️  Value ${compareValue} <= p1 ${p1}, returning 1st percentile`);
    return 1;
  }
  if (compareValue >= p99) {
    console.log(`   ➡️  Value ${compareValue} >= p99 ${p99}, returning 99th percentile`);
    return 99;
  }

  console.log(`   Percentile markers - p5: ${p5}, p10: ${p10}, p25: ${p25}, p50: ${p50}, p75: ${p75}, p90: ${p90}, p95: ${p95}`);

  // Linear interpolation between known percentiles
  let percentile;
  if (compareValue <= p5) {
    percentile = 1 + 4 * (compareValue - p1) / (p5 - p1);
    console.log(`   ✓ Value in 1-5th range, calculated: ${percentile.toFixed(1)}`);
  } else if (compareValue <= p10) {
    percentile = 5 + 5 * (compareValue - p5) / (p10 - p5);
    console.log(`   ✓ Value in 5-10th range, calculated: ${percentile.toFixed(1)}`);
  } else if (compareValue <= p25) {
    percentile = 10 + 15 * (compareValue - p10) / (p25 - p10);
    console.log(`   ✓ Value in 10-25th range, calculated: ${percentile.toFixed(1)}`);
  } else if (compareValue <= p50) {
    percentile = 25 + 25 * (compareValue - p25) / (p50 - p25);
    console.log(`   ✓ Value in 25-50th range, calculated: ${percentile.toFixed(1)}`);
  } else if (compareValue <= p75) {
    percentile = 50 + 25 * (compareValue - p50) / (p75 - p50);
    console.log(`   ✓ Value in 50-75th range, calculated: ${percentile.toFixed(1)}`);
  } else if (compareValue <= p90) {
    percentile = 75 + 15 * (compareValue - p75) / (p90 - p75);
    console.log(`   ✓ Value in 75-90th range, calculated: ${percentile.toFixed(1)}`);
  } else if (compareValue <= p95) {
    percentile = 90 + 5 * (compareValue - p90) / (p95 - p90);
    console.log(`   ✓ Value in 90-95th range, calculated: ${percentile.toFixed(1)}`);
  } else {
    percentile = 95 + 4 * (compareValue - p95) / (p99 - p95);
    console.log(`   ✓ Value in 95-99th range, calculated: ${percentile.toFixed(1)}`);
  }

  return percentile;
}

/**
 * Main function to get full comparative analysis for an athlete's SJ
 * @param {object} sjData - Athlete's SJ test data
 * @returns {object} Comparative analysis with percentiles for each metric
 */
async function getSJComparativeAnalysis(sjData) {
  if (!sjData) {
    return null;
  }

  try {
    console.log('🎯 Starting SJ comparative analysis...');

    // Get pro athlete stats
    const proStats = await getProAthleteStats();

    if (!proStats) {
      console.log('⚠️  No pro stats available for SJ');
      return null;
    }

    // Calculate percentiles for each metric
    const analysis = {
      metrics: {},
      summary: {
        totalTests: proStats.total_tests,
        comparisonDate: new Date().toISOString()
      }
    };

    // Process each metric
    Object.keys(SJ_METRICS).forEach(metricKey => {
      const value = sjData[metricKey];

      if (value !== null && value !== undefined) {
        // Check if this metric needs cm to inches conversion for display
        const needsConversion = CM_TO_INCHES_METRICS.includes(metricKey);

        // IMPORTANT: value is in cm (raw from database/API), proStats are also in cm
        // So we calculate percentile using raw cm values (no conversion needed)
        // We only convert to inches for DISPLAY purposes
        const percentile = calculatePercentile(value, metricKey, proStats, false);

        analysis.metrics[metricKey] = {
          value: needsConversion ? cmToInches(value) : value, // Convert for display
          percentile: Math.round(percentile),
          proMean: needsConversion ? cmToInches(proStats[`${metricKey}_mean`]) : proStats[`${metricKey}_mean`],
          proStdDev: needsConversion ? cmToInches(proStats[`${metricKey}_stddev`]) : proStats[`${metricKey}_stddev`],
          p1: needsConversion ? cmToInches(proStats[`${metricKey}_p1`]) : proStats[`${metricKey}_p1`],
          p5: needsConversion ? cmToInches(proStats[`${metricKey}_p5`]) : proStats[`${metricKey}_p5`],
          p10: needsConversion ? cmToInches(proStats[`${metricKey}_p10`]) : proStats[`${metricKey}_p10`],
          p25: needsConversion ? cmToInches(proStats[`${metricKey}_p25`]) : proStats[`${metricKey}_p25`],
          p50: needsConversion ? cmToInches(proStats[`${metricKey}_p50`]) : proStats[`${metricKey}_p50`],
          p75: needsConversion ? cmToInches(proStats[`${metricKey}_p75`]) : proStats[`${metricKey}_p75`],
          p90: needsConversion ? cmToInches(proStats[`${metricKey}_p90`]) : proStats[`${metricKey}_p90`],
          p95: needsConversion ? cmToInches(proStats[`${metricKey}_p95`]) : proStats[`${metricKey}_p95`],
          p99: needsConversion ? cmToInches(proStats[`${metricKey}_p99`]) : proStats[`${metricKey}_p99`],
          rating: getPerformanceRating(percentile),
          unit: needsConversion ? 'in' : ''
        };

        console.log(`  ${metricKey}: ${value} cm → ${needsConversion ? cmToInches(value).toFixed(2) + ' in' : value} → ${Math.round(percentile)}th percentile (${analysis.metrics[metricKey].rating})`);
      }
    });

    console.log('✅ SJ comparative analysis complete');
    return analysis;

  } catch (error) {
    console.error('❌ Error in SJ comparative analysis:', error);
    return null;
  }
}

/**
 * Get performance rating based on percentile
 * @param {number} percentile
 * @returns {string} Rating category
 */
function getPerformanceRating(percentile) {
  if (percentile >= 90) return 'Elite';
  if (percentile >= 75) return 'Above Average';
  if (percentile >= 50) return 'Average';
  if (percentile >= 25) return 'Below Average';
  return 'Needs Improvement';
}

export { getSJComparativeAnalysis, SJ_METRICS };
