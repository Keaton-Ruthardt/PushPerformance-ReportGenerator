import { bigquery, dataset } from './server/config/bigquery.js';

async function listTables() {
  try {
    console.log('🔍 Listing all tables in the dataset...\n');

    const [tables] = await bigquery.dataset(dataset).getTables();

    console.log(`📊 Found ${tables.length} tables in dataset '${dataset}':\n`);

    for (const table of tables) {
      console.log(`  - ${table.id}`);
    }

    console.log('\n🔍 Looking for squat jump related tables...\n');

    const sjTables = tables.filter(t =>
      t.id.toLowerCase().includes('squat') ||
      t.id.toLowerCase().includes('sj') ||
      t.id.toLowerCase().includes('jump')
    );

    if (sjTables.length > 0) {
      console.log('Found Squat Jump related tables:');
      sjTables.forEach(t => console.log(`  ✓ ${t.id}`));
    } else {
      console.log('❌ No squat jump related tables found');
    }

  } catch (error) {
    console.error('❌ Error listing tables:', error);
  }
}

listTables();
