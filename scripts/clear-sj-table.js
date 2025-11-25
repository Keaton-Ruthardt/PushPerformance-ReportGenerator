import { query, dataset } from '../server/config/bigquery.js';
import dotenv from 'dotenv';

dotenv.config();

async function clearSJTable() {
  console.log('\n🗑️  Clearing squat_jump_results table...\n');

  try {
    const sql = `
      DELETE FROM \`vald-ref-data-copy.${dataset}.squat_jump_results\`
      WHERE TRUE
    `;

    await query(sql);
    console.log('✅ Table cleared successfully!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

clearSJTable().then(() => process.exit(0));
