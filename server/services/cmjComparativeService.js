import { query, dataset } from '../config/bigquery.js';

/**
 * CMJ Comparative Analysis Service
 * Compares individual athlete CMJ metrics against professional athlete population
 */

// The 13 CMJ metrics we're tracking for comparative analysis
const CMJ_METRICS = {
  jumpHeight: 'JUMP_HEIGHT_Trial_cm',
  eccentricBrakingRFD: 'ECCENTRIC_BRAKING_RFD_Trial_N_per_s',
  forceAtZeroVelocity: 'FORCE_AT_ZERO_VELOCITY_Trial_N',
  eccentricPeakForce: 'PEAK_ECCENTRIC_FORCE_Trial_N',
  concentricImpulse: 'CONCENTRIC_IMPULSE_Trial_Ns',
  eccentricPeakVelocity: 'ECCENTRIC_PEAK_VELOCITY_Trial_m_per_s',
  concentricPeakVelocity: 'PEAK_TAKEOFF_VELOCITY_Trial_m_per_s',
  eccentricPeakPower: 'ECCENTRIC_PEAK_POWER_Trial_W',
  eccentricPeakPowerBM: 'BODYMASS_RELATIVE_ECCENTRIC_PEAK_POWER_Trial_W_per_kg',
  peakPower: 'PEAK_TAKEOFF_POWER_Trial_W',
  peakPowerBM: 'BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg',
  rsiMod: 'RSI_MODIFIED_Trial_RSI_mod',
  countermovementDepth: 'COUNTERMOVEMENT_DEPTH_Trial_cm'
};

// Metrics that need to be converted from cm to inches for display
const CM_TO_INCHES_METRICS = ['jumpHeight', 'countermovementDepth'];

/**
 * Convert centimeters to inches
 */
function cmToInches(cm) {
  if (cm === null || cm === undefined) return null;
  return cm / 2.54;
}

/**
 * Get professional athlete bucket statistics for all CMJ metrics
 * Returns mean, std dev, and percentile distribution for each metric
 */
async function getProAthleteStats() {
  try {
    console.log('📊 Fetching pro athlete CMJ statistics from BigQuery...');
    console.log('📊 CMJ_METRICS object:', CMJ_METRICS);

    // Build dynamic SQL to get stats for all metrics
    // Use p1 and p99 instead of MIN/MAX to filter outliers
    const metricStats = Object.entries(CMJ_METRICS).map(([key, column]) => `
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
      FROM \`vald-ref-data-copy.${dataset}.cmj_results\`
      WHERE (group_name_1 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB') OR
             group_name_2 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB') OR
             group_name_3 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB'))
        AND test_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 YEAR)
    `;

    console.log('🔍 Generated BigQuery SQL:', sql);
    const results = await query(sql);

    if (results.length === 0) {
      throw new Error('No pro athlete data found');
    }

    const stats = results[0];
    console.log(`✅ Loaded stats from ${stats.total_tests} pro athlete CMJ tests`);

    return stats;
  } catch (error) {
    console.error('❌ Error fetching pro athlete stats:', error);
    throw error;
  }
}

/**
 * Calculate percentile rank for a specific value compared to pro athlete population
 * @param {number} value - The athlete's metric value
 * @param {string} metricKey - The metric key (e.g., 'jumpHeight')
 * @param {object} proStats - Pro athlete statistics object
 * @param {boolean} lowerIsBetter - For some metrics (countermovement depth, eccentric peak velocity), lower values are better
 * @param {boolean} convertToInches - If true, athlete value is in inches and needs to be converted back to cm for comparison
 * @returns {number} Percentile rank (0-100)
 */
function calculatePercentile(value, metricKey, proStats, lowerIsBetter = false, convertToInches = false) {
  if (value === null || value === undefined) return null;

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

  // For metrics where lower is better, invert the percentile
  if (lowerIsBetter) {
    // Handle edge cases (inverted) - cap at p1 and p99 to filter outliers
    if (compareValue <= p1) return 99;   // Best possible (99th percentile)
    if (compareValue >= p99) return 1;   // Worst possible (1st percentile)

    // Linear interpolation between known percentiles (inverted)
    if (compareValue <= p5) {
      return 99 - 4 * (compareValue - p1) / (p5 - p1);
    } else if (compareValue <= p10) {
      return 95 - 5 * (compareValue - p5) / (p10 - p5);
    } else if (compareValue <= p25) {
      return 90 - 15 * (compareValue - p10) / (p25 - p10);
    } else if (compareValue <= p50) {
      return 75 - 25 * (compareValue - p25) / (p50 - p25);
    } else if (compareValue <= p75) {
      return 50 - 25 * (compareValue - p50) / (p75 - p50);
    } else if (compareValue <= p90) {
      return 25 - 15 * (compareValue - p75) / (p90 - p75);
    } else if (compareValue <= p95) {
      return 10 - 5 * (compareValue - p90) / (p95 - p90);
    } else {
      return 5 - 4 * (compareValue - p95) / (p99 - p95);
    }
  } else {
    // Normal percentile (higher is better)
    // Handle edge cases - cap at p1 and p99 to filter outliers
    if (compareValue <= p1) return 1;    // 1st percentile
    if (compareValue >= p99) return 99;  // 99th percentile

    // Linear interpolation between known percentiles
    if (compareValue <= p5) {
      return 1 + 4 * (compareValue - p1) / (p5 - p1);
    } else if (compareValue <= p10) {
      return 5 + 5 * (compareValue - p5) / (p10 - p5);
    } else if (compareValue <= p25) {
      return 10 + 15 * (compareValue - p10) / (p25 - p10);
    } else if (compareValue <= p50) {
      return 25 + 25 * (compareValue - p25) / (p50 - p25);
    } else if (compareValue <= p75) {
      return 50 + 25 * (compareValue - p50) / (p75 - p50);
    } else if (compareValue <= p90) {
      return 75 + 15 * (compareValue - p75) / (p90 - p75);
    } else if (compareValue <= p95) {
      return 90 + 5 * (compareValue - p90) / (p95 - p90);
    } else {
      return 95 + 4 * (compareValue - p95) / (p99 - p95);
    }
  }
}

/**
 * Get comparative analysis for an athlete's CMJ test results
 * @param {object} athleteMetrics - Object containing athlete's metric values
 * @returns {object} Comparative analysis with percentiles for each metric
 */
async function getComparativeAnalysis(athleteMetrics) {
  try {
    // Get pro athlete statistics
    const proStats = await getProAthleteStats();

    // Calculate percentiles for each metric
    const comparison = {
      totalProTests: proStats.total_tests,
      metrics: {}
    };

    for (const [key, column] of Object.entries(CMJ_METRICS)) {
      const athleteValue = athleteMetrics[key];

      // For countermovement depth and eccentric peak velocity, lower is better
      const lowerIsBetter = key === 'countermovementDepth' || key === 'eccentricPeakVelocity';

      // Check if this metric needs cm to inches conversion for display
      const needsConversion = CM_TO_INCHES_METRICS.includes(key);

      // IMPORTANT: athleteValue is in cm (raw from database/API), proStats are also in cm
      // So we calculate percentile using raw cm values (no conversion needed)
      // We only convert to inches for DISPLAY purposes (value, proMean, percentile markers)
      comparison.metrics[key] = {
        value: needsConversion ? cmToInches(athleteValue) : athleteValue, // Convert for display
        columnName: column,
        proMean: needsConversion ? cmToInches(proStats[`${key}_mean`]) : proStats[`${key}_mean`],
        proStdDev: needsConversion ? cmToInches(proStats[`${key}_stddev`]) : proStats[`${key}_stddev`],
        percentile: calculatePercentile(athleteValue, key, proStats, lowerIsBetter, false), // No conversion - both values are in cm
        p1: needsConversion ? cmToInches(proStats[`${key}_p1`]) : proStats[`${key}_p1`],
        p5: needsConversion ? cmToInches(proStats[`${key}_p5`]) : proStats[`${key}_p5`],
        p10: needsConversion ? cmToInches(proStats[`${key}_p10`]) : proStats[`${key}_p10`],
        p25: needsConversion ? cmToInches(proStats[`${key}_p25`]) : proStats[`${key}_p25`],
        p50: needsConversion ? cmToInches(proStats[`${key}_p50`]) : proStats[`${key}_p50`],
        p75: needsConversion ? cmToInches(proStats[`${key}_p75`]) : proStats[`${key}_p75`],
        p90: needsConversion ? cmToInches(proStats[`${key}_p90`]) : proStats[`${key}_p90`],
        p95: needsConversion ? cmToInches(proStats[`${key}_p95`]) : proStats[`${key}_p95`],
        p99: needsConversion ? cmToInches(proStats[`${key}_p99`]) : proStats[`${key}_p99`],
        unit: needsConversion ? 'in' : (column.includes('_cm') ? 'cm' : '')
      };
    }

    return comparison;
  } catch (error) {
    console.error('❌ Error in comparative analysis:', error);
    throw error;
  }
}

/**
 * Get percentile label for display (Elite, Above Average, Average, Below Average)
 */
function getPercentileLabel(percentile) {
  if (percentile === null) return 'N/A';
  if (percentile >= 90) return 'Elite';
  if (percentile >= 75) return 'Above Average';
  if (percentile >= 25) return 'Average';
  return 'Below Average';
}

/**
 * Get all CMJ tests for a specific athlete from BigQuery
 */
async function getAthleteHistory(profileId, limit = 10) {
  try {
    const metricColumns = Object.values(CMJ_METRICS).join(', ');

    const sql = `
      SELECT
        test_id,
        test_date,
        full_name,
        ${metricColumns}
      FROM \`vald-ref-data-copy.${dataset}.cmj_results\`
      WHERE profile_id = @profileId
      ORDER BY test_date DESC
      LIMIT @limit
    `;

    const results = await query(sql, [
      { name: 'profileId', value: profileId },
      { name: 'limit', value: limit }
    ]);

    return results;
  } catch (error) {
    console.error('❌ Error fetching athlete history:', error);
    throw error;
  }
}

export {
  CMJ_METRICS,
  getProAthleteStats,
  calculatePercentile,
  getComparativeAnalysis,
  getPercentileLabel,
  getAthleteHistory
};
