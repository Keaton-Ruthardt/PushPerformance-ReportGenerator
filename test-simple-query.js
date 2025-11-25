import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: 'vald-ref-data-copy',
  keyFilename: 'vald-ref-data-copy-0c0792ad4944.json'
});

async function testSimpleQuery() {
  console.log('Testing simple BigQuery query...\n');

  try {
    // Simple query without parameters
    const query = `
      SELECT
        profile_id,
        given_name,
        family_name,
        gender,
        sport
      FROM \`vald-ref-data-copy.VALDrefDataCOPY.profile_metadata\`
      LIMIT 10
    `;

    console.log('Running query...');
    const [rows] = await bigquery.query(query);

    console.log(`\n✅ Found ${rows.length} athletes:\n`);

    rows.forEach(row => {
      console.log(`- ${row.given_name} ${row.family_name} (${row.sport || 'No sport'})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSimpleQuery();