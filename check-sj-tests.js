import { query, dataset } from './server/config/bigquery.js';

async function checkSquatJumpTests() {
  try {
    console.log('🔍 Querying Squat Jump tests...\n');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total_tests
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
    `;

    const countResults = await query(countQuery);
    console.log(`📊 Total Squat Jump tests in database: ${countResults[0].total_tests}\n`);

    // Get some athlete names with SJ tests
    const athletesQuery = `
      SELECT
        athlete_name,
        test_date,
        JUMP_HEIGHT_IMP_MOM_Trial_cm,
        FORCE_AT_PEAK_POWER_Trial_N,
        CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s,
        CONCENTRIC_PEAK_POWER_Trial_W,
        BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg
      FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
      WHERE athlete_name IS NOT NULL
      ORDER BY test_date DESC
      LIMIT 10
    `;

    const athleteResults = await query(athletesQuery);
    console.log('👥 Recent athletes with Squat Jump tests:\n');

    athleteResults.forEach((row, index) => {
      console.log(`${index + 1}. ${row.athlete_name}`);
      console.log(`   Date: ${row.test_date}`);
      console.log(`   Jump Height: ${row.JUMP_HEIGHT_IMP_MOM_Trial_cm?.toFixed(2) || 'N/A'} cm`);
      console.log(`   Peak Power/BW: ${row.BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg?.toFixed(2) || 'N/A'} W/kg\n`);
    });

  } catch (error) {
    console.error('❌ Error querying Squat Jump tests:', error);
  }
}

checkSquatJumpTests();
