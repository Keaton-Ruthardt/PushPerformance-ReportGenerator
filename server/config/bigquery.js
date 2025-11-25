import { BigQuery } from '@google-cloud/bigquery';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID || 'vald-ref-data-copy',
  keyFilename: join(__dirname, '..', '..', process.env.BIGQUERY_KEYFILE || 'vald-ref-data-copy-0c0792ad4944.json')
});

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