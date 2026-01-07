import { query, dataset } from '../config/bigquery.js';

/**
 * Plyometric Push Up Comparative Analysis Service
 * Compares individual athlete PPU metrics against professional athlete population
 */

// The 6 Plyometric Push Up metrics we're tracking for comparative analysis
const PPU_METRICS = {
  pushupHeight: 'PUSHUP_HEIGHT_INCHES_Trial_in', // Native inches field from API
  eccentricPeakForce: 'PEAK_ECCENTRIC_FORCE_Trial_N',
  concentricPeakForce: 'PEAK_CONCENTRIC_FORCE_Trial_N',
  concentricRFD_L: 'CONCENTRIC_RFD_Left_N_per_s',
  concentricRFD_R: 'CONCENTRIC_RFD_Right_N_per_s',
  eccentricBrakingRFD: 'ECCENTRIC_BRAKING_RFD_Trial_N_per_s'
};

// Metrics that are already in inches (no conversion needed)
const CM_TO_INCHES_METRICS = [];

/**
 * Convert centimeters to inches
 */
function cmToInches(cm) {
  if (cm === null || cm === undefined) return null;
  return cm / 2.54;
}

/**
 * Get professional athlete bucket statistics for all PPU metrics
 * Returns mean, std dev, and percentile distribution for each metric
 */
async function getProAthleteStats() {
  try {
    console.log('📊 Fetching pro athlete PPU statistics from BigQuery...');
    console.log('📊 PPU_METRICS object:', PPU_METRICS);

    // Build dynamic SQL to get stats for all metrics
    const metricStats = Object.entries(PPU_METRICS).map(([key, column]) => `
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
      FROM \`vald-ref-data-copy.${dataset}.ppu_results\`
      WHERE (group_name_1 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB') OR
             group_name_2 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB') OR
             group_name_3 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB'))
        AND DATE(test_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 YEAR)
    `;

    console.log('🔍 Generated BigQuery SQL for PPU');
    const results = await query(sql);

    if (results.length === 0) {
      console.log('⚠️  No pro athlete PPU data found');
      return null;
    }

    const stats = results[0];
    console.log(`✅ Loaded stats from ${stats.total_tests} pro athlete PPU tests`);

    return stats;
  } catch (error) {
    console.error('❌ Error fetching pro athlete PPU stats:', error);
    return null;
  }
}

/**
 * Calculate percentile rank for a specific value compared to pro athlete population
 * @param {number} value - The athlete's metric value
 * @param {string} metricKey - The metric key (e.g., 'pushupHeight')
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
  if (value <= min) return 0;
  if (value >= max) return 100;

  // Use percentile markers for more accurate calculation
  const p25 = proStats[`${metricKey}_p25`];
  const p50 = proStats[`${metricKey}_p50`];
  const p75 = proStats[`${metricKey}_p75`];
  const p90 = proStats[`${metricKey}_p90`];
  const p95 = proStats[`${metricKey}_p95`];

  // Linear interpolation between known percentiles
  if (value <= p25) {
    return (value - min) / (p25 - min) * 25;
  } else if (value <= p50) {
    return 25 + (value - p25) / (p50 - p25) * 25;
  } else if (value <= p75) {
    return 50 + (value - p50) / (p75 - p50) * 25;
  } else if (value <= p90) {
    return 75 + (value - p75) / (p90 - p75) * 15;
  } else if (value <= p95) {
    return 90 + (value - p90) / (p95 - p90) * 5;
  } else {
    return 95 + (value - p95) / (max - p95) * 5;
  }
}

/**
 * Main function to get full comparative analysis for an athlete's PPU
 * @param {object} ppuData - Athlete's PPU test data
 * @returns {object} Comparative analysis with percentiles for each metric
 */
async function getPPUComparativeAnalysis(ppuData) {
  if (!ppuData) {
    return null;
  }

  try {
    console.log('🎯 Starting PPU comparative analysis...');

    // Get pro athlete stats
    const proStats = await getProAthleteStats();

    if (!proStats) {
      console.log('⚠️  No pro stats available for PPU');
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
    Object.keys(PPU_METRICS).forEach(metricKey => {
      const value = ppuData[metricKey];

      if (value !== null && value !== undefined) {
        const percentile = calculatePercentile(value, metricKey, proStats);
        const needsConversion = CM_TO_INCHES_METRICS.includes(metricKey);

        analysis.metrics[metricKey] = {
          value: needsConversion ? cmToInches(value) : value, // Convert to inches for display
          percentile: Math.round(percentile),
          proMean: needsConversion ? cmToInches(proStats[`${metricKey}_mean`]) : proStats[`${metricKey}_mean`],
          proStdDev: needsConversion ? cmToInches(proStats[`${metricKey}_stddev`]) : proStats[`${metricKey}_stddev`],
          proMin: needsConversion ? cmToInches(proStats[`${metricKey}_min`]) : proStats[`${metricKey}_min`],
          proMax: needsConversion ? cmToInches(proStats[`${metricKey}_max`]) : proStats[`${metricKey}_max`],
          proP50: needsConversion ? cmToInches(proStats[`${metricKey}_p50`]) : proStats[`${metricKey}_p50`],
          proP75: needsConversion ? cmToInches(proStats[`${metricKey}_p75`]) : proStats[`${metricKey}_p75`],
          proP90: needsConversion ? cmToInches(proStats[`${metricKey}_p90`]) : proStats[`${metricKey}_p90`],
          rating: getPerformanceRating(percentile),
          unit: needsConversion ? 'in' : '' // Add unit indicator
        };

        console.log(`  ${metricKey}: ${value} → ${Math.round(percentile)}th percentile (${analysis.metrics[metricKey].rating})`);
      }
    });

    console.log('✅ PPU comparative analysis complete');
    return analysis;

  } catch (error) {
    console.error('❌ Error in PPU comparative analysis:', error);
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

export { getPPUComparativeAnalysis };
