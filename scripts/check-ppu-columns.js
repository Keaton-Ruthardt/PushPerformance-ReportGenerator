import { query, dataset } from '../server/config/bigquery.js';

/**
 * Check what columns are available in the ppu_results table
 */
async function checkPPUColumns() {
  try {
    console.log('🔍 Checking PPU table columns...');

    // Query to get column names from the table
    const sql = `
      SELECT column_name
      FROM \`vald-ref-data-copy.${dataset}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'ppu_results'
      ORDER BY ordinal_position
    `;

    console.log('📊 Querying table schema...');
    const results = await query(sql);

    console.log(`\n✅ Found ${results.length} columns in ppu_results table:\n`);
    results.forEach(row => {
      console.log(`  - ${row.column_name}`);
    });

    // Also get a sample row to see what data looks like
    console.log('\n🔍 Fetching sample row from ppu_results...');
    const sampleSql = `
      SELECT *
      FROM \`vald-ref-data-copy.${dataset}.ppu_results\`
      WHERE group_name_1 IN ('MLB/ MiLB', 'Pro')
      LIMIT 1
    `;

    const sampleResults = await query(sampleSql);
    if (sampleResults.length > 0) {
      console.log('\n📊 Sample row columns:');
      Object.keys(sampleResults[0]).forEach(key => {
        console.log(`  - ${key}: ${sampleResults[0][key]}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking PPU columns:', error);
  }

  process.exit(0);
}

checkPPUColumns();
