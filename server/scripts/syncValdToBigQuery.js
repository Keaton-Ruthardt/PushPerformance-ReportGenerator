import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';
import valdApiService from '../services/valdApiServiceInstance.js';

dotenv.config();

// Initialize BigQuery client
let bigQueryConfig = {
  projectId: process.env.BIGQUERY_PROJECT_ID || 'vald-ref-data-copy'
};

if (process.env.BIGQUERY_CREDENTIALS_BASE64) {
  const decoded = Buffer.from(process.env.BIGQUERY_CREDENTIALS_BASE64, 'base64').toString('utf8');
  bigQueryConfig.credentials = JSON.parse(decoded);
  console.log('✅ Using BigQuery credentials from BIGQUERY_CREDENTIALS_BASE64');
} else if (process.env.BIGQUERY_CREDENTIALS) {
  bigQueryConfig.credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS);
  console.log('✅ Using BigQuery credentials from BIGQUERY_CREDENTIALS');
}

const bigquery = new BigQuery(bigQueryConfig);
const dataset = process.env.BIGQUERY_DATASET || 'VALDrefDataCOPY';

// Rate limiting configuration
const RATE_LIMIT = {
  MAX_REQUESTS: 20,
  TIME_WINDOW: 5000  // 5 seconds in milliseconds
};

let requestQueue = [];
let requestCount = 0;

/**
 * Rate-limited API request wrapper
 * Ensures we don't exceed 20 requests per 5 seconds
 */
async function rateLimitedRequest(requestFn) {
  const now = Date.now();

  // Remove requests older than the time window
  requestQueue = requestQueue.filter(timestamp => now - timestamp < RATE_LIMIT.TIME_WINDOW);

  // If we've hit the limit, wait until we can make another request
  if (requestQueue.length >= RATE_LIMIT.MAX_REQUESTS) {
    const oldestRequest = requestQueue[0];
    const waitTime = RATE_LIMIT.TIME_WINDOW - (now - oldestRequest) + 100; // Add 100ms buffer
    console.log(`   ⏳ Rate limit reached, waiting ${Math.round(waitTime / 1000)}s...`);
    await sleep(waitTime);
    return rateLimitedRequest(requestFn); // Retry after waiting
  }

  // Record this request and execute it
  requestQueue.push(now);
  requestCount++;
  return await requestFn();
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sync all athlete test data from VALD to BigQuery
 * Creates tables with ALL columns from VALD including group IDs
 */
async function syncValdToBigQuery() {
  console.log('\n🚀 Starting VALD to BigQuery sync...\n');
  console.log(`📊 Project: ${bigQueryConfig.projectId}`);
  console.log(`📊 Dataset: ${dataset}`);
  console.log(`⚡ Rate Limit: ${RATE_LIMIT.MAX_REQUESTS} requests per ${RATE_LIMIT.TIME_WINDOW / 1000} seconds\n`);

  try {
    // Authenticate with VALD
    console.log('🔐 Authenticating with VALD API...');
    await valdApiService.authenticate();
    console.log('✅ Authenticated\n');

    // Define test types to sync
    const testTypes = [
      { vald: 'CMJ', table: 'cmj_results' },
      { vald: 'IMTP', table: 'imtp_results' },
      { vald: 'PPU', table: 'ppu_results' },
      { vald: 'SJ', table: 'sj_results' }
    ];

    // Process each test type
    for (const testType of testTypes) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 Processing ${testType.vald} tests...`);
      console.log(`${'='.repeat(60)}\n`);

      try {
        // Fetch ALL tests from VALD (not filtered by professional athletes)
        let tests = await fetchAllTests(testType.vald);

        if (!tests || tests.length === 0) {
          console.log(`⚠️  No ${testType.vald} tests found\n`);
          continue;
        }

        console.log(`✅ Found ${tests.length} ${testType.vald} tests\n`);

        // Create or replace BigQuery table
        console.log(`📊 Creating BigQuery table: ${testType.table}...`);
        await createOrReplaceBigQueryTable(testType.table, tests);
        console.log(`✅ Table ${testType.table} created successfully\n`);

      } catch (error) {
        console.error(`❌ Error processing ${testType.vald}:`);
        console.error(error);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ VALD to BigQuery sync completed successfully!');
    console.log(`📊 Total API requests made: ${requestCount}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error during sync:', error);
    throw error;
  }
}

/**
 * Fetch ALL tests from VALD for a specific test type
 * No filtering - gets all athletes, all tests
 */
async function fetchAllTests(testType) {
  console.log(`🔍 Fetching ALL ${testType} tests from VALD...`);

  const allTests = [];

  // Fetch tests from Primary API only
  for (const apiSource of ['Primary']) {
    console.log(`   Checking ${apiSource} API...`);

    try {
      const config = apiSource === 'Primary' ? valdApiService.config : valdApiService.config2;

      if (!config) {
        console.log(`   ⚠️  ${apiSource} API not configured, skipping`);
        continue;
      }

      // Get the correct token for this API
      const token = apiSource === 'Primary'
        ? await valdApiService.getAccessToken()
        : await valdApiService.getAccessToken2();

      // Get all tests of this type using rate-limited requests
      const axios = (await import('axios')).default;
      const url = `${config.forceDecksUrl}/tests`;

      // Fetch tests from last 2 years
      const modifiedFromUtc = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();

      const response = await rateLimitedRequest(async () => {
        return await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          params: {
            TenantId: config.tenantId,  // Capital T!
            TestType: testType,  // Capital T!
            ModifiedFromUtc: modifiedFromUtc,
            limit: 10000,  // Get as many as possible
            IncludeExtendedParameters: true,
            IncludeAttributes: true
          }
        });
      });

      // Extract tests from response (can be in response.data.tests or response.data.data)
      let tests = response.data?.tests || response.data?.data || [];

      // CRITICAL: Filter to only include tests of the requested type
      // The API sometimes returns mixed test types, so we must filter client-side
      tests = tests.filter(test => test.testType === testType);

      if (tests && tests.length > 0) {
        console.log(`   Found ${tests.length} ${testType} tests in ${apiSource} API`);

        // Fetch detailed data for each test with rate limiting
        let processedCount = 0;
        for (const test of tests) {
          try {
            const detailedTest = await fetchTestDetails(test, apiSource, testType);
            if (detailedTest) {
              allTests.push(detailedTest);
              processedCount++;

              // Progress indicator every 50 tests
              if (processedCount % 50 === 0) {
                console.log(`   📊 Processed ${processedCount}/${tests.length} tests...`);
              }
            }
          } catch (error) {
            console.error(`   ⚠️  Failed to fetch details for test ${test.id}:`, error.message);
          }
        }

        console.log(`   ✅ Successfully processed ${processedCount} tests from ${apiSource} API`);
      } else {
        console.log(`   No tests found in ${apiSource} API`);
      }

    } catch (error) {
      console.error(`   ⚠️  Error fetching from ${apiSource} API:`, error.message);
    }
  }

  console.log(`📊 Total ${testType} tests collected: ${allTests.length}\n`);
  return allTests;
}

/**
 * Fetch detailed test data including all metrics (rate-limited)
 */
async function fetchTestDetails(test, apiSource, expectedTestType) {
  // Double-check test type matches what we expect
  if (test.testType !== expectedTestType) {
    console.error(`   ⚠️  Test type mismatch: expected ${expectedTestType}, got ${test.testType}`);
    return null;
  }

  const config = apiSource === 'Primary' ? valdApiService.config : valdApiService.config2;
  // Get the correct token for this API source
  const token = apiSource === 'Primary'
    ? await valdApiService.getAccessToken()
    : await valdApiService.getAccessToken2();
  const axios = (await import('axios')).default;

  // Extract test ID (can be 'testId' or 'id')
  const testId = test.testId || test.id;
  if (!testId) {
    console.error('   ⚠️  Test object missing testId/id:', test);
    return null;
  }

  // Fetch trials for this test to get all metrics (with rate limiting)
  const url = `${config.forceDecksUrl}/v2019q3/teams/${config.tenantId}/tests/${testId}/trials`;

  const response = await rateLimitedRequest(async () => {
    return await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  });

  if (!response.data || response.data.length === 0) {
    return null;
  }

  // Extract all metrics from trials (NO test_type column - it's redundant)
  const metrics = {
    test_id: testId,
    profile_id: test.profileId,
    athlete_name: test.name || test.athleteName || test.athlete_name || null,
    test_date: test.recordedDateUtc || test.testDate,
    group_name_1: test.group_name_1 || null,
    group_name_2: test.group_name_2 || null,
    group_name_3: test.group_name_3 || null,
    api_source: apiSource,
    tenant_id: config.tenantId,
    tenant_name: apiSource === 'Primary' ? 'Push Performance' : 'Next Era'
  };

  // Extract all result values from trials
  for (const trial of response.data) {
    if (trial.results && Array.isArray(trial.results)) {
      for (const result of trial.results) {
        if (!result.definition || !result.definition.result) continue;

        const fieldName = result.definition.result;
        const limb = result.limb || 'Trial';
        const unit = result.definition.unit || '';

        // Build field name (e.g., "JUMP_HEIGHT_Trial_cm")
        let key = `${fieldName}_${limb}`;
        if (unit) {
          const normalizedUnit = unit
            .replace(/\s+/g, '_')
            .replace(/Centimeter/g, 'cm')
            .replace(/Millimeter/g, 'mm')
            .replace(/Meter/g, 'm')
            .replace(/Newton/g, 'N')
            .replace(/Watt/g, 'W')
            .replace(/Kilo/g, 'kg')
            .replace(/Second/g, 's')
            .replace(/RSIModified/g, 'RSIModified')
            .replace(/No Unit/g, 'No_Unit');
          key += `_${normalizedUnit}`;
        }

        metrics[key] = result.value;
      }
    }
  }

  return metrics;
}

/**
 * Create or replace BigQuery table with test data
 */
async function createOrReplaceBigQueryTable(tableName, tests) {
  const datasetRef = bigquery.dataset(dataset);
  const tableRef = datasetRef.table(tableName);

  // Check if table exists
  let [tableExists] = [false];
  try {
    [tableExists] = await tableRef.exists();
  } catch (error) {
    tableExists = false;
  }

  // If table exists, insert into it without recreating
  if (tableExists) {
    console.log(`   Table ${tableName} already exists, will insert into existing table`);

    // Insert all test data in batches
    const BATCH_SIZE = 500;
    let insertedTotal = 0;

    for (let i = 0; i < tests.length; i += BATCH_SIZE) {
      const batch = tests.slice(i, i + BATCH_SIZE);
      console.log(`   Inserting batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} rows)...`);
      try {
        await tableRef.insert(batch);
        insertedTotal += batch.length;
      } catch (error) {
        if (error.name === 'PartialFailureError' && error.errors) {
          console.error(`   ⚠️  Partial insertion failure. Showing first 3 errors:`);
          error.errors.slice(0, 3).forEach((err, idx) => {
            console.error(`   Error ${idx + 1}:`, JSON.stringify(err, null, 2));
          });
        }
        throw error;
      }
    }

    console.log(`   ✅ Inserted ${insertedTotal} rows total`);
    return; // Exit early - we're done
  }

  if (tests.length === 0) {
    console.log(`   No data to insert for ${tableName}`);
    return;
  }

  // Collect ALL unique field names from ALL tests to ensure schema includes everything
  const allFieldNames = new Set();
  const fieldSamples = {}; // Store a sample value for each field to determine type

  for (const test of tests) {
    for (const [key, value] of Object.entries(test)) {
      allFieldNames.add(key);
      // Store first non-null value for type detection
      if (value !== null && value !== undefined && !fieldSamples[key]) {
        fieldSamples[key] = value;
      }
    }
  }

  // Create schema from all collected fields
  const fields = Array.from(allFieldNames).map(key => {
    // Determine field type from sample value
    let type = 'STRING';
    const value = fieldSamples[key];

    if (typeof value === 'number') {
      // ALWAYS use FLOAT for numbers to handle both integers and decimals
      type = 'FLOAT';
    } else if (value instanceof Date || key.includes('date') || key.includes('Date')) {
      type = 'TIMESTAMP';
    }

    return { name: key, type: type, mode: 'NULLABLE' };
  });

  // Create table with schema - NO EXPIRATION
  const options = {
    schema: { fields: fields },
    location: 'US',
    expirationTime: null  // NEVER EXPIRE
  };

  const [table] = await datasetRef.createTable(tableName, options);
  console.log(`   Created table ${tableName} with ${fields.length} columns`);

  // Explicitly remove table expiration
  await table.setMetadata({
    expirationTime: null
  });
  console.log(`   ✅ Table expiration removed (set to NEVER)`);

  // Wait for table to propagate (BigQuery eventual consistency)
  console.log(`   Waiting 60 seconds for table to propagate...`);
  await sleep(60000);

  // Insert all test data in batches to avoid hitting limits
  const BATCH_SIZE = 500;
  let insertedTotal = 0;

  for (let i = 0; i < tests.length; i += BATCH_SIZE) {
    const batch = tests.slice(i, i + BATCH_SIZE);
    console.log(`   Inserting batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} rows)...`);
    try {
      await table.insert(batch);
      insertedTotal += batch.length;
    } catch (error) {
      if (error.name === 'PartialFailureError' && error.errors) {
        console.error(`   ⚠️  Partial insertion failure. Showing first 3 errors:`);
        error.errors.slice(0, 3).forEach((err, idx) => {
          console.error(`   Error ${idx + 1}:`, JSON.stringify(err, null, 2));
        });
      }
      throw error;
    }
  }

  console.log(`   ✅ Inserted ${insertedTotal} rows total`);
}

// Run the sync if executed directly
// Use a more reliable method that works on both Windows and Unix
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && __filename === process.argv[1];

if (isMainModule) {
  syncValdToBigQuery()
    .then(() => {
      console.log('\n✅ Sync completed successfully. Exiting...\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Sync failed:', error);
      process.exit(1);
    });
}

export default syncValdToBigQuery;
