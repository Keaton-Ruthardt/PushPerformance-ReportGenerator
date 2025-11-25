import { query, dataset } from '../config/bigquery.js';

/**
 * IMTP Comparative Analysis Service
 * Compares individual athlete IMTP metrics against professional athlete population
 */

// The 4 IMTP metrics we're tracking for comparative analysis
const IMTP_METRICS = {
  peakVerticalForce: 'PEAK_VERTICAL_FORCE_Trial_N',
  peakForceBM: 'ISO_BM_REL_FORCE_PEAK_Trial_N_per_kg',
  forceAt100ms: 'FORCE_AT_100MS_Trial_N',
  timeToPeakForce: 'START_TO_PEAK_FORCE_Trial_s'
};

/**
 * Get professional athlete bucket statistics for all IMTP metrics
 * Returns mean, std dev, and percentile distribution for each metric
 */
async function getProAthleteStats() {
  try {
    console.log('📊 Fetching pro athlete IMTP statistics from BigQuery...');

    // Build dynamic SQL to get stats for all metrics
    const metricStats = Object.entries(IMTP_METRICS).map(([key, column]) => `
      -- ${key}
      AVG(${column}) as ${key}_mean,
      STDDEV(${column}) as ${key}_stddev,
      MIN(${column}) as ${key}_min,
      MAX(${column}) as ${key}_max,
      APPROX_QUANTILES(${column}, 100)[OFFSET(25)] as ${key}_p25,
      APPROX_QUANTILES(${column}, 100)[OFFSET(50)] as ${key}_p50,
      APPROX_QUANTILES(${column}, 100)[OFFSET(75)] as ${key}_p75,
      APPROX_QUANTILES(${column}, 100)[OFFSET(90)] as ${key}_p90,
      APPROX_QUANTILES(${column}, 100)[OFFSET(95)] as ${key}_p95
    `).join(',\n');

    const sql = `
      SELECT
        COUNT(*) as total_tests,
        ${metricStats}
      FROM \`vald-ref-data-copy.${dataset}.imtp_results\`
      WHERE (group_name_1 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB') OR
             group_name_2 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB') OR
             group_name_3 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB'))
        AND DATE(test_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 YEAR)
    `;

    console.log('🔍 Generated BigQuery SQL for IMTP');
    const results = await query(sql);

    if (results.length === 0) {
      console.log('⚠️  No pro athlete IMTP data found, will use mock data');
      return null;
    }

    const stats = results[0];
    console.log(`✅ Loaded stats from ${stats.total_tests} pro athlete IMTP tests`);

    return stats;
  } catch (error) {
    console.error('❌ Error fetching pro athlete IMTP stats:', error);
    return null;
  }
}

/**
 * Calculate percentile rank for a specific value compared to pro athlete population
 * For time to peak force, lower is better, so we invert the percentile
 * @param {number} value - The athlete's metric value
 * @param {string} metricKey - The metric key (e.g., 'peakVerticalForce')
 * @param {object} proStats - Pro athlete statistics object
 * @returns {number} Percentile rank (0-100)
 */
function calculatePercentile(value, metricKey, proStats) {
  if (value === null || value === undefined || !proStats) return null;

  const mean = proStats[`${metricKey}_mean`];
  const stddev = proStats[`${metricKey}_stddev`];
  const min = proStats[`${metricKey}_min`];
  const max = proStats[`${metricKey}_max`];

  // Handle edge cases
  if (value <= min) return metricKey === 'timeToPeakForce' ? 100 : 0;
  if (value >= max) return metricKey === 'timeToPeakForce' ? 0 : 100;

  // Use percentile markers for more accurate calculation
  const p25 = proStats[`${metricKey}_p25`];
  const p50 = proStats[`${metricKey}_p50`];
  const p75 = proStats[`${metricKey}_p75`];
  const p90 = proStats[`${metricKey}_p90`];
  const p95 = proStats[`${metricKey}_p95`];

  let percentile;

  // Linear interpolation between known percentiles
  if (value <= p25) {
    percentile = (value - min) / (p25 - min) * 25;
  } else if (value <= p50) {
    percentile = 25 + (value - p25) / (p50 - p25) * 25;
  } else if (value <= p75) {
    percentile = 50 + (value - p50) / (p75 - p50) * 25;
  } else if (value <= p90) {
    percentile = 75 + (value - p75) / (p90 - p75) * 15;
  } else if (value <= p95) {
    percentile = 90 + (value - p90) / (p95 - p90) * 5;
  } else {
    percentile = 95 + (value - p95) / (max - p95) * 5;
  }

  // Invert percentile for time to peak force (lower time = better performance)
  if (metricKey === 'timeToPeakForce') {
    percentile = 100 - percentile;
  }

  return percentile;
}

/**
 * Main function to get full comparative analysis for an athlete's IMTP
 * @param {object} imtpData - Athlete's IMTP test data
 * @returns {object} Comparative analysis with percentiles for each metric
 */
async function getIMTPComparativeAnalysis(imtpData) {
  if (!imtpData) {
    return null;
  }

  try {
    console.log('🎯 Starting IMTP comparative analysis...');

    // Get pro athlete stats
    const proStats = await getProAthleteStats();

    if (!proStats) {
      console.log('⚠️  No pro stats available for IMTP');
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
    Object.keys(IMTP_METRICS).forEach(metricKey => {
      const value = imtpData[metricKey];

      if (value !== null && value !== undefined) {
        const percentile = calculatePercentile(value, metricKey, proStats);

        analysis.metrics[metricKey] = {
          value: value,
          percentile: Math.round(percentile),
          proMean: proStats[`${metricKey}_mean`],
          proStdDev: proStats[`${metricKey}_stddev`],
          proMin: proStats[`${metricKey}_min`],
          proMax: proStats[`${metricKey}_max`],
          proP50: proStats[`${metricKey}_p50`],
          proP75: proStats[`${metricKey}_p75`],
          proP90: proStats[`${metricKey}_p90`],
          rating: getPerformanceRating(percentile)
        };

        console.log(`  ${metricKey}: ${value} → ${Math.round(percentile)}th percentile (${analysis.metrics[metricKey].rating})`);
      }
    });

    console.log('✅ IMTP comparative analysis complete');
    return analysis;

  } catch (error) {
    console.error('❌ Error in IMTP comparative analysis:', error);
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

export { getIMTPComparativeAnalysis, IMTP_METRICS };
