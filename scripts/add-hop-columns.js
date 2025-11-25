import 'dotenv/config';
import { getTable } from '../server/config/bigquery.js';

async function addHopColumns() {
  try {
    console.log('🔧 Adding new columns to hj_results table...\n');

    const table = getTable('hj_results');

    // Get current schema
    const [metadata] = await table.getMetadata();
    const currentFields = metadata.schema.fields;

    console.log('📋 Current columns:');
    currentFields.forEach(field => {
      console.log(`  - ${field.name} (${field.type})`);
    });

    // Check if columns already exist
    const hasJumpHeight = currentFields.some(f => f.name === 'hop_jump_height_avg_best_5');
    const hasGCT = currentFields.some(f => f.name === 'hop_gct_avg_best_5');
    const hasRSI = currentFields.some(f => f.name === 'hop_rsi_avg_best_5');

    if (hasJumpHeight && hasGCT && hasRSI) {
      console.log('\n✅ All hop columns already exist!');
      process.exit(0);
    }

    // Add new fields to schema
    const newFields = [...currentFields];

    if (!hasRSI) {
      newFields.push({
        name: 'hop_rsi_avg_best_5',
        type: 'FLOAT',
        mode: 'NULLABLE',
        description: 'Average of best 5 RSI values (flight time / ground contact time ratio)'
      });
      console.log('\n➕ Adding hop_rsi_avg_best_5 column');
    }

    if (!hasJumpHeight) {
      newFields.push({
        name: 'hop_jump_height_avg_best_5',
        type: 'FLOAT',
        mode: 'NULLABLE',
        description: 'Average of best 5 jump heights in centimeters'
      });
      console.log('➕ Adding hop_jump_height_avg_best_5 column');
    }

    if (!hasGCT) {
      newFields.push({
        name: 'hop_gct_avg_best_5',
        type: 'FLOAT',
        mode: 'NULLABLE',
        description: 'Average of best 5 ground contact times in seconds (lowest values)'
      });
      console.log('➕ Adding hop_gct_avg_best_5 column');
    }

    // Update schema
    metadata.schema.fields = newFields;
    await table.setMetadata(metadata);

    console.log('\n✅ Columns added successfully!');

    // Verify
    const [newMetadata] = await table.getMetadata();
    console.log('\n📋 Updated columns:');
    newMetadata.schema.fields.forEach(field => {
      console.log(`  - ${field.name} (${field.type})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addHopColumns();
