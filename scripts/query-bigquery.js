import { BigQuery } from '@google-cloud/bigquery';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bigquery = new BigQuery({
  projectId: 'vald-ref-data',
  keyFilename: join(__dirname, 'vald-bigquery-credentials.json')
});

async function sampleTables() {
  console.log('📊 Sampling data from BigQuery tables\n');

  try {
    // Sample from profile_metadata to see the structure
    console.log('1️⃣  Profile Metadata (Sample):');
    console.log('─'.repeat(80));
    const profileQuery = `
      SELECT *
      FROM \`vald-ref-data.athlete_performance_db.profile_metadata\`
      LIMIT 5
    `;
    const [profileRows] = await bigquery.query(profileQuery);
    console.table(profileRows);

    // Sample from CMJ results
    console.log('\n2️⃣  CMJ Results (Sample):');
    console.log('─'.repeat(80));
    const cmjQuery = `
      SELECT *
      FROM \`vald-ref-data.athlete_performance_db.cmj_results\`
      LIMIT 5
    `;
    const [cmjRows] = await bigquery.query(cmjQuery);
    console.table(cmjRows);

    // Get column information for a table
    console.log('\n3️⃣  CMJ Table Schema:');
    console.log('─'.repeat(80));
    const schemaQuery = `
      SELECT column_name, data_type
      FROM \`vald-ref-data.athlete_performance_db.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'cmj_results'
      ORDER BY ordinal_position
    `;
    const [schemaRows] = await bigquery.query(schemaQuery);
    console.table(schemaRows);

    console.log('\n✅ Query completed successfully!\n');

  } catch (error) {
    console.error('❌ Error querying BigQuery:', error.message);
    console.error('Full error:', error);
  }
}

// Run the queries
sampleTables();
