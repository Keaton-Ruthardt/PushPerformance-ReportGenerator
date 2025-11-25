import pool from '../config/database.js';

/**
 * Calculate percentile value for a given metric
 * @param {number} value - The value to calculate percentile for
 * @param {Array} sortedData - Sorted array of all values
 * @returns {number} Percentile (0-100)
 */
export const calculatePercentile = (value, sortedData) => {
  if (!sortedData || sortedData.length === 0) return null;

  const count = sortedData.filter(v => v <= value).length;
  return Math.round((count / sortedData.length) * 100);
};

/**
 * Calculate statistics for a dataset
 * @param {Array} data - Array of numbers
 * @returns {Object} Statistics object with min, max, p25, p50, p75
 */
export const calculateStats = (data) => {
  if (!data || data.length === 0) return null;

  const sorted = [...data].filter(v => v !== null && v !== undefined).sort((a, b) => a - b);

  if (sorted.length === 0) return null;

  const getPercentileValue = (arr, percentile) => {
    const index = Math.ceil((percentile / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  };

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p25: getPercentileValue(sorted, 25),
    p50: getPercentileValue(sorted, 50),
    p75: getPercentileValue(sorted, 75),
    sampleSize: sorted.length,
  };
};

/**
 * Store percentile ranges in database
 * @param {string} testType - Type of test
 * @param {string} metricName - Name of the metric
 * @param {Object} stats - Statistics object
 */
export const storePercentileRange = async (testType, metricName, stats) => {
  const query = `
    INSERT INTO percentile_ranges (test_type, metric_name, min_value, max_value, p25, p50, p75, sample_size, last_updated)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    ON CONFLICT (test_type, metric_name)
    DO UPDATE SET
      min_value = EXCLUDED.min_value,
      max_value = EXCLUDED.max_value,
      p25 = EXCLUDED.p25,
      p50 = EXCLUDED.p50,
      p75 = EXCLUDED.p75,
      sample_size = EXCLUDED.sample_size,
      last_updated = CURRENT_TIMESTAMP
  `;

  const values = [
    testType,
    metricName,
    stats.min,
    stats.max,
    stats.p25,
    stats.p50,
    stats.p75,
    stats.sampleSize,
  ];

  await pool.query(query, values);
};

/**
 * Get percentile ranges for a specific test type
 * @param {string} testType - Type of test
 * @returns {Promise<Object>} Object with metric names as keys and stats as values
 */
export const getPercentileRanges = async (testType) => {
  const query = `
    SELECT metric_name, min_value, max_value, p25, p50, p75, sample_size
    FROM percentile_ranges
    WHERE test_type = $1
  `;

  const result = await pool.query(query, [testType]);

  const ranges = {};
  result.rows.forEach(row => {
    ranges[row.metric_name] = {
      min: parseFloat(row.min_value),
      max: parseFloat(row.max_value),
      p25: parseFloat(row.p25),
      p50: parseFloat(row.p50),
      p75: parseFloat(row.p75),
      sampleSize: row.sample_size,
    };
  });

  return ranges;
};

/**
 * Calculate percentile for athlete value based on stored ranges
 * @param {string} testType - Type of test
 * @param {string} metricName - Name of the metric
 * @param {number} value - Athlete's value
 * @returns {Promise<Object>} Object with percentile and color coding
 */
export const getAthletePercentile = async (testType, metricName, value) => {
  const query = `
    SELECT min_value, max_value, p25, p50, p75
    FROM percentile_ranges
    WHERE test_type = $1 AND metric_name = $2
  `;

  const result = await pool.query(query, [testType, metricName]);

  if (result.rows.length === 0) {
    return { percentile: null, color: 'gray' };
  }

  const { min_value, max_value, p25, p50, p75 } = result.rows[0];

  // Calculate approximate percentile based on quartiles
  let percentile;
  if (value <= p25) {
    percentile = Math.round((value - min_value) / (p25 - min_value) * 25);
  } else if (value <= p50) {
    percentile = 25 + Math.round((value - p25) / (p50 - p25) * 25);
  } else if (value <= p75) {
    percentile = 50 + Math.round((value - p50) / (p75 - p50) * 25);
  } else {
    percentile = 75 + Math.round((value - p75) / (max_value - p75) * 25);
  }

  // Clamp percentile between 0 and 100
  percentile = Math.max(0, Math.min(100, percentile));

  // Determine color based on percentile
  let color;
  if (percentile >= 75) {
    color = 'green'; // Top 25%
  } else if (percentile >= 25) {
    color = 'yellow'; // Middle 50%
  } else {
    color = 'red'; // Bottom 25%
  }

  return { percentile, color };
};

/**
 * Calculate asymmetry percentage between left and right values
 * @param {number} leftValue - Left side value
 * @param {number} rightValue - Right side value
 * @returns {Object} Asymmetry percentage and dominant side
 */
export const calculateAsymmetry = (leftValue, rightValue) => {
  if (!leftValue || !rightValue) return null;

  const difference = Math.abs(leftValue - rightValue);
  const average = (leftValue + rightValue) / 2;
  const asymmetryPercent = (difference / average) * 100;

  const dominantSide = leftValue > rightValue ? 'L' : 'R';

  // Determine color based on asymmetry percentage
  let color;
  if (asymmetryPercent < 5) {
    color = 'green';
  } else if (asymmetryPercent < 10) {
    color = 'yellow';
  } else {
    color = 'red';
  }

  return {
    percentage: asymmetryPercent.toFixed(1),
    dominantSide,
    color,
  };
};

export default {
  calculatePercentile,
  calculateStats,
  storePercentileRange,
  getPercentileRanges,
  getAthletePercentile,
  calculateAsymmetry,
};
