import { query, dataset } from '../server/config/bigquery.js';

async function checkHopStats() {
  try {
    console.log('📊 Checking Hop Test statistics in BigQuery...\n');

    const sql = `
      SELECT
        COUNT(*) as total_count,
        AVG(hop_rsi_avg_best_5) as avg_rsi,
        MIN(hop_rsi_avg_best_5) as min_rsi,
        MAX(hop_rsi_avg_best_5) as max_rsi,
        AVG(hop_jump_height_avg_best_5) as avg_jh,
        MIN(hop_jump_height_avg_best_5) as min_jh,
        MAX(hop_jump_height_avg_best_5) as max_jh,
        AVG(hop_gct_avg_best_5) as avg_gct,
        MIN(hop_gct_avg_best_5) as min_gct,
        MAX(hop_gct_avg_best_5) as max_gct
      FROM \`vald-ref-data-copy.${dataset}.HJ_result_updated\`
      WHERE (group_name_1 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball') OR
             group_name_2 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball') OR
             group_name_3 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball'))
        AND hop_rsi_avg_best_5 IS NOT NULL
        AND hop_jump_height_avg_best_5 IS NOT NULL
        AND hop_gct_avg_best_5 IS NOT NULL
    `;

    const results = await query(sql);
    const stats = results[0];

    console.log(`Total professional hop tests: ${stats.total_count}`);
    console.log('\n📊 RSI Stats:');
    console.log(`   Min: ${stats.min_rsi}`);
    console.log(`   Max: ${stats.max_rsi}`);
    console.log(`   Avg: ${stats.avg_rsi}`);

    console.log('\n📊 Jump Height Stats (cm):');
    console.log(`   Min: ${stats.min_jh}`);
    console.log(`   Max: ${stats.max_jh}`);
    console.log(`   Avg: ${stats.avg_jh}`);

    console.log('\n📊 GCT Stats (seconds):');
    console.log(`   Min: ${stats.min_gct}`);
    console.log(`   Max: ${stats.max_gct}`);
    console.log(`   Avg: ${stats.avg_gct}`);

    // Also check one specific test
    console.log('\n📊 Sample test from BigQuery:');
    const sampleSql = `
      SELECT
        test_id,
        hop_rsi_avg_best_5,
        hop_jump_height_avg_best_5,
        hop_gct_avg_best_5
      FROM \`vald-ref-data-copy.${dataset}.HJ_result_updated\`
      WHERE (group_name_1 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball') OR
             group_name_2 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball') OR
             group_name_3 IN ('Pro', 'MiLB', 'MLB', 'Pro Baseball'))
        AND hop_rsi_avg_best_5 IS NOT NULL
      LIMIT 5
    `;

    const samples = await query(sampleSql);
    samples.forEach((sample, i) => {
      console.log(`\n   Sample ${i + 1}:`);
      console.log(`      RSI: ${sample.hop_rsi_avg_best_5}`);
      console.log(`      JH: ${sample.hop_jump_height_avg_best_5} cm`);
      console.log(`      GCT: ${sample.hop_gct_avg_best_5} s`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkHopStats();
