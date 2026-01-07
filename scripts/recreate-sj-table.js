import { bigquery, dataset } from '../server/config/bigquery.js';
import dotenv from 'dotenv';

dotenv.config();

const TABLE_NAME = 'squat_jump_results';

async function recreateTable() {
  console.log('\n🔄 Recreating squat_jump_results table...\n');

  try {
    const table = bigquery.dataset(dataset).table(TABLE_NAME);

    // Check if table exists
    const [exists] = await table.exists();

    if (exists) {
      console.log(`🗑️  Deleting existing table ${TABLE_NAME}...`);
      await table.delete();
      console.log(`✅ Table deleted successfully\n`);
    } else {
      console.log(`⚠️  Table ${TABLE_NAME} does not exist\n`);
    }

    // Create new table with simple schema
    console.log(`🔨 Creating new table ${TABLE_NAME} with updated schema...`);

    const SCHEMA = [
      { name: 'test_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'profile_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'full_name', type: 'STRING' },
      { name: 'test_date', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'api_source', type: 'STRING' },
      { name: 'test_type', type: 'STRING' },
      { name: 'group_name_1', type: 'STRING' },
      { name: 'group_name_2', type: 'STRING' },
      { name: 'group_name_3', type: 'STRING' },
      { name: 'BODY_MASS_Trial_kg', type: 'FLOAT' },
      { name: 'JUMP_HEIGHT_IMP_MOM_Trial_cm', type: 'FLOAT' },
      { name: 'JUMP_HEIGHT_Trial_cm', type: 'FLOAT' },
      { name: 'FORCE_AT_PEAK_POWER_Trial_N', type: 'FLOAT' },
      { name: 'CONCENTRIC_PEAK_FORCE_Trial_N', type: 'FLOAT' },
      { name: 'PEAK_CONCENTRIC_FORCE_Trial_N', type: 'FLOAT' },
      { name: 'CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s', type: 'FLOAT' },
      { name: 'VELOCITY_AT_PEAK_POWER_Trial_m_per_s', type: 'FLOAT' },
      { name: 'PEAK_TAKEOFF_VELOCITY_Trial_m_per_s', type: 'FLOAT' },
      { name: 'CONCENTRIC_PEAK_POWER_Trial_W', type: 'FLOAT' },
      { name: 'MEAN_CONCENTRIC_POWER_Trial_W', type: 'FLOAT' },
      { name: 'PEAK_POWER_Trial_W', type: 'FLOAT' },
      { name: 'PEAK_TAKEOFF_POWER_Trial_W', type: 'FLOAT' },
      { name: 'BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg', type: 'FLOAT' },
      { name: 'BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg', type: 'FLOAT' },
      { name: 'BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_Per_kg', type: 'FLOAT' }
    ];

    const [newTable] = await bigquery.dataset(dataset).createTable(TABLE_NAME, {
      schema: SCHEMA,
      location: 'US',
    });

    console.log(`✅ Table ${newTable.id} created successfully!`);
    console.log(`   Total fields: ${SCHEMA.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

recreateTable().then(() => {
  console.log('\n✅ Table recreation complete!\n');
  process.exit(0);
});
