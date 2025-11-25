import { getValdApiClient } from './valdAuthService.js';
import pool from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const PROFILE_URL = process.env.PROFILE_URL;
const FORCEDECKS_URL = process.env.FORCEDECKS_URL;
const TENANT_ID = process.env.TENANT_ID;

/**
 * Fetch pro athletes from VALD
 * Pro athletes should be tagged or in a specific group
 * @param {string} tenantId - Tenant ID (defaults to env)
 * @returns {Array} Array of pro athlete profiles
 */
export const fetchProAthletes = async (tenantId = TENANT_ID) => {
  try {
    console.log('🏆 Fetching pro athletes from VALD...\n');

    const valdApi = await getValdApiClient();
    valdApi.defaults.baseURL = PROFILE_URL;

    // Fetch all profiles
    const response = await valdApi.get('/profiles', {
      params: { tenantId },
    });

    const allProfiles = response.data || [];
    console.log(`📊 Total profiles found: ${allProfiles.length}`);

    // Filter for pro athletes
    // Pro athletes are typically identified by:
    // 1. Tags containing "pro", "professional", "elite"
    // 2. Being in a group/category named "Pro" or "Professional"
    // 3. Having a specific flag/property

    const proAthletes = allProfiles.filter(profile => {
      // Check tags
      if (profile.tags && Array.isArray(profile.tags)) {
        const hasProTag = profile.tags.some(tag =>
          tag.toLowerCase().includes('pro') ||
          tag.toLowerCase().includes('professional') ||
          tag.toLowerCase().includes('elite')
        );
        if (hasProTag) return true;
      }

      // Check groups/categories
      if (profile.groups && Array.isArray(profile.groups)) {
        const hasProGroup = profile.groups.some(group =>
          group.name?.toLowerCase().includes('pro') ||
          group.name?.toLowerCase().includes('professional') ||
          group.name?.toLowerCase().includes('elite')
        );
        if (hasProGroup) return true;
      }

      // Check if profile has isPro flag
      if (profile.isPro || profile.professional || profile.elite) {
        return true;
      }

      return false;
    });

    console.log(`✅ Pro athletes found: ${proAthletes.length}\n`);

    return proAthletes;

  } catch (error) {
    console.error('❌ Error fetching pro athletes:', error.message);
    throw new Error('Failed to fetch pro athletes from VALD');
  }
};

/**
 * Fetch all force deck tests for pro athletes
 * @param {Array} proAthletes - Array of pro athlete profiles
 * @param {string} tenantId - Tenant ID
 * @param {number} daysBack - How many days back to fetch tests (default: 365)
 * @returns {Array} Array of all test results
 */
export const fetchProAthleteTests = async (proAthletes, tenantId = TENANT_ID, daysBack = 365) => {
  try {
    console.log('📊 Fetching test results for pro athletes...\n');

    const valdApi = await getValdApiClient();
    valdApi.defaults.baseURL = FORCEDECKS_URL;

    // Calculate date filter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const modifiedFromUtc = startDate.toISOString();

    console.log(`Fetching tests from: ${modifiedFromUtc}`);
    console.log(`Processing ${proAthletes.length} pro athletes...\n`);

    const allTests = [];
    let processedCount = 0;

    // Fetch tests for each pro athlete
    for (const athlete of proAthletes) {
      const profileId = athlete.id || athlete.profileId;
      const athleteName = athlete.name || `${athlete.firstName} ${athlete.lastName}`;

      try {
        const response = await valdApi.get('/tests', {
          params: {
            tenantId,
            profileId,
            modifiedFromUtc,
          },
        });

        const tests = response.data || [];

        if (tests.length > 0) {
          console.log(`  ✅ ${athleteName}: ${tests.length} tests`);
          allTests.push(...tests);
        }

        processedCount++;

        // Progress indicator every 10 athletes
        if (processedCount % 10 === 0) {
          console.log(`  📈 Progress: ${processedCount}/${proAthletes.length} athletes processed`);
        }

      } catch (error) {
        console.log(`  ⚠️  ${athleteName}: Error fetching tests - ${error.message}`);
      }
    }

    console.log(`\n✅ Total tests collected: ${allTests.length}\n`);

    return allTests;

  } catch (error) {
    console.error('❌ Error fetching pro athlete tests:', error.message);
    throw new Error('Failed to fetch pro athlete tests');
  }
};

/**
 * Calculate percentiles from test data
 * @param {Array} values - Array of numerical values
 * @returns {Object} Object with p25, p50, p75, min, max
 */
const calculatePercentiles = (values) => {
  if (!values || values.length === 0) {
    return null;
  }

  // Sort values
  const sorted = values.slice().sort((a, b) => a - b);
  const len = sorted.length;

  const getPercentile = (p) => {
    const index = (p / 100) * (len - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sorted[lower];
    }

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  return {
    min: sorted[0],
    max: sorted[len - 1],
    p25: getPercentile(25),
    p50: getPercentile(50),
    p75: getPercentile(75),
    sampleSize: len,
  };
};

/**
 * Process test results and calculate percentiles for each metric
 * @param {Array} tests - Array of test results
 * @returns {Object} Object with percentiles by test type and metric
 */
export const calculateTestPercentiles = (tests) => {
  console.log('📊 Calculating percentiles for all metrics...\n');

  const metricsByTestType = {};

  // Group tests by type and extract metrics
  tests.forEach(test => {
    const testType = (test.testType || test.type || 'unknown').toLowerCase();

    if (!metricsByTestType[testType]) {
      metricsByTestType[testType] = {};
    }

    // Extract all numerical metrics from test data
    const testData = test.data || test.results || test.metrics || {};

    Object.entries(testData).forEach(([metricName, value]) => {
      // Only process numerical values
      if (typeof value === 'number' && !isNaN(value)) {
        if (!metricsByTestType[testType][metricName]) {
          metricsByTestType[testType][metricName] = [];
        }
        metricsByTestType[testType][metricName].push(value);
      }
    });
  });

  // Calculate percentiles for each metric
  const percentileData = {};

  Object.entries(metricsByTestType).forEach(([testType, metrics]) => {
    console.log(`  📈 ${testType.toUpperCase()}`);
    percentileData[testType] = {};

    Object.entries(metrics).forEach(([metricName, values]) => {
      const percentiles = calculatePercentiles(values);

      if (percentiles) {
        percentileData[testType][metricName] = percentiles;
        console.log(`     ${metricName}: n=${percentiles.sampleSize}, p50=${percentiles.p50.toFixed(2)}`);
      }
    });

    console.log('');
  });

  return percentileData;
};

/**
 * Store percentile data in PostgreSQL database
 * @param {Object} percentileData - Percentile data by test type and metric
 * @returns {number} Number of records inserted/updated
 */
export const storePercentiles = async (percentileData) => {
  console.log('💾 Storing percentile data in database...\n');

  let recordsProcessed = 0;

  try {
    for (const [testType, metrics] of Object.entries(percentileData)) {
      for (const [metricName, stats] of Object.entries(metrics)) {
        // Upsert percentile data (insert or update if exists)
        await pool.query(
          `
          INSERT INTO percentile_ranges
            (test_type, metric_name, min_value, max_value, p25, p50, p75, sample_size, last_updated)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (test_type, metric_name)
          DO UPDATE SET
            min_value = EXCLUDED.min_value,
            max_value = EXCLUDED.max_value,
            p25 = EXCLUDED.p25,
            p50 = EXCLUDED.p50,
            p75 = EXCLUDED.p75,
            sample_size = EXCLUDED.sample_size,
            last_updated = NOW()
          `,
          [
            testType,
            metricName,
            stats.min,
            stats.max,
            stats.p25,
            stats.p50,
            stats.p75,
            stats.sampleSize,
          ]
        );

        recordsProcessed++;
      }
    }

    console.log(`✅ Stored ${recordsProcessed} percentile records\n`);
    return recordsProcessed;

  } catch (error) {
    console.error('❌ Error storing percentiles:', error.message);
    throw new Error('Failed to store percentile data in database');
  }
};

/**
 * Full sync process: Fetch pro athletes, get tests, calculate percentiles, store in DB
 * @param {string} tenantId - Tenant ID (optional)
 * @param {number} daysBack - How many days of test data to fetch (default: 365)
 * @returns {Object} Summary of sync process
 */
export const syncProAthletePercentiles = async (tenantId = TENANT_ID, daysBack = 365) => {
  console.log('🚀 Starting Pro Athlete Percentile Sync\n');
  console.log('='.repeat(70));
  console.log('');

  const startTime = Date.now();

  try {
    // Step 1: Fetch pro athletes
    const proAthletes = await fetchProAthletes(tenantId);

    if (proAthletes.length === 0) {
      console.log('⚠️  No pro athletes found. Make sure athletes are tagged as "pro" in VALD Hub.\n');
      return {
        success: false,
        message: 'No pro athletes found',
        proAthletes: 0,
        tests: 0,
        percentiles: 0,
      };
    }

    // Step 2: Fetch all test results for pro athletes
    const tests = await fetchProAthleteTests(proAthletes, tenantId, daysBack);

    if (tests.length === 0) {
      console.log('⚠️  No test results found for pro athletes.\n');
      return {
        success: false,
        message: 'No test results found',
        proAthletes: proAthletes.length,
        tests: 0,
        percentiles: 0,
      };
    }

    // Step 3: Calculate percentiles
    const percentileData = calculateTestPercentiles(tests);

    // Step 4: Store in database
    const recordsStored = await storePercentiles(percentileData);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('='.repeat(70));
    console.log('\n🎉 Sync Complete!\n');
    console.log(`Pro Athletes Processed: ${proAthletes.length}`);
    console.log(`Tests Analyzed: ${tests.length}`);
    console.log(`Percentile Records Stored: ${recordsStored}`);
    console.log(`Duration: ${duration} seconds\n`);

    return {
      success: true,
      message: 'Sync completed successfully',
      proAthletes: proAthletes.length,
      tests: tests.length,
      percentiles: recordsStored,
      duration,
    };

  } catch (error) {
    console.error('\n❌ Sync Failed:', error.message);
    throw error;
  }
};

export default {
  fetchProAthletes,
  fetchProAthleteTests,
  calculateTestPercentiles,
  storePercentiles,
  syncProAthletePercentiles,
};
