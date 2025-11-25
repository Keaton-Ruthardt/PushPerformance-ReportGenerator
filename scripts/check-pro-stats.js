import 'dotenv/config';
import { query, dataset } from '../server/config/bigquery.js';

async function checkProStats() {
  const sql = `
    SELECT
      COUNT(*) as total,
      MIN(JUMP_HEIGHT_Trial_cm) as min_jh,
      MAX(JUMP_HEIGHT_Trial_cm) as max_jh,
      AVG(JUMP_HEIGHT_Trial_cm) as avg_jh,
      APPROX_QUANTILES(JUMP_HEIGHT_Trial_cm, 100)[OFFSET(1)] as p1,
      APPROX_QUANTILES(JUMP_HEIGHT_Trial_cm, 100)[OFFSET(50)] as p50,
      APPROX_QUANTILES(JUMP_HEIGHT_Trial_cm, 100)[OFFSET(99)] as p99
    FROM \`vald-ref-data-copy.${dataset}.cmj_results\`
    WHERE (group_name_1 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB') OR
           group_name_2 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB') OR
           group_name_3 IN ('MLB/ MiLB', 'Pro', 'Pro Baseball', 'MLB', 'MiLB'))
      AND test_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 YEAR)
  `;

  console.log('Querying BigQuery for CMJ pro stats...\n');
  const results = await query(sql);
  const r = results[0];

  console.log('Total pro CMJ tests:', r.total);
  console.log('\nJump Height Stats (in cm):');
  console.log('  MIN:', r.min_jh?.toFixed(2), 'cm');
  console.log('  p1:', r.p1?.toFixed(2), 'cm');
  console.log('  p50 (median):', r.p50?.toFixed(2), 'cm');
  console.log('  p99:', r.p99?.toFixed(2), 'cm');
  console.log('  MAX:', r.max_jh?.toFixed(2), 'cm');
  console.log('  AVG:', r.avg_jh?.toFixed(2), 'cm');

  console.log('\nJump Height Stats (in inches):');
  console.log('  p1:', (r.p1 / 2.54).toFixed(2), 'in');
  console.log('  p50 (median):', (r.p50 / 2.54).toFixed(2), 'in');
  console.log('  p99:', (r.p99 / 2.54).toFixed(2), 'in');
  console.log('  AVG:', (r.avg_jh / 2.54).toFixed(2), 'in');

  process.exit(0);
}

checkProStats().catch(e => { console.error(e); process.exit(1); });
