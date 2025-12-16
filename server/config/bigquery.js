import { BigQuery } from '@google-cloud/bigquery';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Initialize BigQuery client
// In production, use GOOGLE_APPLICATION_CREDENTIALS or BIGQUERY_CREDENTIALS
// In development, use keyFilename
let bigQueryConfig = {
  projectId: process.env.BIGQUERY_PROJECT_ID || 'vald-ref-data-copy'
};

if (process.env.BIGQUERY_CREDENTIALS_BASE64) {
  // Production: Decode base64-encoded credentials
  try {
    const decoded = Buffer.from(process.env.BIGQUERY_CREDENTIALS_BASE64, 'base64').toString('utf8');
    bigQueryConfig.credentials = JSON.parse(decoded);
    console.log('✅ Using BigQuery credentials from BIGQUERY_CREDENTIALS_BASE64 environment variable');
  } catch (error) {
    console.error('❌ Failed to decode BIGQUERY_CREDENTIALS_BASE64:', error.message);
    throw new Error('Invalid BIGQUERY_CREDENTIALS_BASE64 format');
  }
} else if (process.env.BIGQUERY_CREDENTIALS) {
  // Production: Parse credentials from environment variable (JSON string)
  try {
    bigQueryConfig.credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS);
    console.log('✅ Using BigQuery credentials from BIGQUERY_CREDENTIALS environment variable');
  } catch (error) {
    console.error('❌ Failed to parse BIGQUERY_CREDENTIALS:', error.message);
    throw new Error('Invalid BIGQUERY_CREDENTIALS format');
  }
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // Production: Use credentials file path from GOOGLE_APPLICATION_CREDENTIALS
  bigQueryConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  console.log('✅ Using BigQuery credentials from file:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
} else {
  // Development: Use credentials file from BIGQUERY_KEYFILE or default
  bigQueryConfig.keyFilename = join(__dirname, '..', '..', process.env.BIGQUERY_KEYFILE || 'vald-ref-data-copy-0c0792ad4944.json');
  console.log('ℹ️  Using BigQuery credentials from file (development mode)');
}

const bigquery = new BigQuery(bigQueryConfig);

const dataset = process.env.BIGQUERY_DATASET || 'VALDrefDataCOPY';

// Test connection function
async function testConnection() {
  try {
    const [datasets] = await bigquery.getDatasets();
    console.log('✅ Connected to BigQuery successfully');
    console.log(`   Project: ${process.env.BIGQUERY_PROJECT_ID}`);
    console.log(`   Dataset: ${dataset}`);
    return true;
  } catch (error) {
    console.error('❌ BigQuery connection failed:', error.message);
    return false;
  }
}

// Query helper function
async function query(sql, params = []) {
  try {
    const options = {
      query: sql,
      location: 'US',
      params: params
    };

    const [rows] = await bigquery.query(options);
    return rows;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

// Get table reference
function getTable(tableName) {
  return bigquery.dataset(dataset).table(tableName);
}

export {
  bigquery,
  dataset,
  testConnection,
  query,
  getTable
};