import pool from '../config/database.js';

/**
 * Get percentile range for a specific test metric
 * @param {string} testType - Type of test (e.g., 'cmj', 'sj', 'imtp')
 * @param {string} metricName - Name of the metric
 * @returns {Object} Percentile data or null
 */
export const getPercentileRange = async (testType, metricName) => {
  try {
    const result = await pool.query(
      `SELECT * FROM percentile_ranges
       WHERE test_type = $1 AND metric_name = $2`,
      [testType.toLowerCase(), metricName]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching percentile range:', error);
    return null;
  }
};

/**
 * Calculate which percentile an athlete's value falls into
 * @param {number} value - Athlete's test value
 * @param {Object} range - Percentile range data
 * @returns {Object} Percentile info with color coding
 */
export const calculatePercentileRank = (value, range) => {
  if (!range || value === null || value === undefined) {
    return {
      percentile: null,
      color: 'gray',
      label: 'No Data',
      rank: 'insufficient_data',
    };
  }

  const { p25, p50, p75, min_value, max_value } = range;

  let percentile, color, label, rank;

  if (value >= p75) {
    // Top 25% (elite)
    percentile = 75 + ((value - p75) / (max_value - p75)) * 25;
    color = 'green';
    label = 'Elite';
    rank = 'elite';
  } else if (value >= p50) {
    // 50th-75th percentile (above average)
    percentile = 50 + ((value - p50) / (p75 - p50)) * 25;
    color = 'lightgreen';
    label = 'Above Average';
    rank = 'above_average';
  } else if (value >= p25) {
    // 25th-50th percentile (average)
    percentile = 25 + ((value - p25) / (p50 - p25)) * 25;
    color = 'yellow';
    label = 'Average';
    rank = 'average';
  } else {
    // Below 25th percentile (needs improvement)
    percentile = (value - min_value) / (p25 - min_value) * 25;
    color = 'red';
    label = 'Needs Improvement';
    rank = 'below_average';
  }

  return {
    percentile: Math.round(percentile),
    color,
    label,
    rank,
    value,
    proComparison: {
      p25: p25,
      p50: p50,
      p75: p75,
      min: min_value,
      max: max_value,
    },
  };
};

/**
 * Compare an athlete's test results against pro benchmarks
 * @param {Object} testData - Athlete's test data
 * @param {string} testType - Type of test
 * @returns {Object} Comparison results with percentile rankings
 */
export const compareAthleteToProBenchmarks = async (testData, testType) => {
  const comparison = {
    testType,
    metrics: {},
    overallRank: null,
    insights: [],
  };

  // Process each metric in the test data
  for (const [metricName, value] of Object.entries(testData)) {
    if (typeof value === 'number' && !isNaN(value)) {
      // Get percentile range for this metric
      const range = await getPercentileRange(testType, metricName);

      if (range) {
        // Calculate athlete's percentile rank
        const ranking = calculatePercentileRank(value, range);

        comparison.metrics[metricName] = ranking;

        // Generate insights
        if (ranking.rank === 'elite') {
          comparison.insights.push({
            metric: metricName,
            type: 'strength',
            message: `${metricName}: Elite level (top 25% of pros)`,
          });
        } else if (ranking.rank === 'below_average') {
          comparison.insights.push({
            metric: metricName,
            type: 'improvement',
            message: `${metricName}: Focus area - below pro baseline`,
          });
        }
      }
    }
  }

  // Calculate overall rank (average of all metric percentiles)
  const percentiles = Object.values(comparison.metrics)
    .map(m => m.percentile)
    .filter(p => p !== null);

  if (percentiles.length > 0) {
    const avgPercentile = percentiles.reduce((a, b) => a + b, 0) / percentiles.length;

    if (avgPercentile >= 75) {
      comparison.overallRank = 'elite';
    } else if (avgPercentile >= 50) {
      comparison.overallRank = 'above_average';
    } else if (avgPercentile >= 25) {
      comparison.overallRank = 'average';
    } else {
      comparison.overallRank = 'developing';
    }
  }

  return comparison;
};

/**
 * Compare multiple tests for an athlete
 * @param {Array} testResults - Array of test result objects
 * @returns {Object} Comprehensive comparison report
 */
export const compareAthleteProfile = async (testResults) => {
  const profile = {
    tests: {},
    strengths: [],
    improvements: [],
    overallSummary: null,
  };

  // Process each test
  for (const test of testResults) {
    const { testType, data } = test;

    if (data && typeof data === 'object') {
      const comparison = await compareAthleteToProBenchmarks(data, testType);
      profile.tests[testType] = comparison;

      // Collect strengths and improvements
      comparison.insights.forEach(insight => {
        if (insight.type === 'strength') {
          profile.strengths.push(insight.message);
        } else if (insight.type === 'improvement') {
          profile.improvements.push(insight.message);
        }
      });
    }
  }

  // Generate overall summary
  const allRanks = Object.values(profile.tests).map(t => t.overallRank);
  const eliteCount = allRanks.filter(r => r === 'elite').length;
  const aboveAvgCount = allRanks.filter(r => r === 'above_average').length;

  if (eliteCount > testResults.length / 2) {
    profile.overallSummary = 'Elite athlete with exceptional performance across multiple tests';
  } else if (eliteCount + aboveAvgCount > testResults.length / 2) {
    profile.overallSummary = 'Strong athlete performing above professional baseline';
  } else {
    profile.overallSummary = 'Developing athlete with room for improvement in key areas';
  }

  return profile;
};

/**
 * Get all available percentile data (for reference/debugging)
 * @returns {Array} All percentile ranges in database
 */
export const getAllPercentileRanges = async () => {
  try {
    const result = await pool.query(
      `SELECT test_type, metric_name, p25, p50, p75, sample_size, last_updated
       FROM percentile_ranges
       ORDER BY test_type, metric_name`
    );

    return result.rows;
  } catch (error) {
    console.error('Error fetching all percentile ranges:', error);
    return [];
  }
};

/**
 * Get summary of percentile data by test type
 * @returns {Object} Summary grouped by test type
 */
export const getPercentileSummary = async () => {
  try {
    const result = await pool.query(
      `SELECT test_type, COUNT(*) as metric_count, MAX(last_updated) as last_updated
       FROM percentile_ranges
       GROUP BY test_type
       ORDER BY test_type`
    );

    const summary = {};
    result.rows.forEach(row => {
      summary[row.test_type] = {
        metricCount: parseInt(row.metric_count),
        lastUpdated: row.last_updated,
      };
    });

    return summary;
  } catch (error) {
    console.error('Error fetching percentile summary:', error);
    return {};
  }
};

export default {
  getPercentileRange,
  calculatePercentileRank,
  compareAthleteToProBenchmarks,
  compareAthleteProfile,
  getAllPercentileRanges,
  getPercentileSummary,
};
