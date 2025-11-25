import VALDApiService from '../server/services/valdApiService.js';
import { query, dataset } from '../server/config/bigquery.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const valdApiService = new VALDApiService();

const DELAY_BETWEEN_CALLS = 300;
const testTypesFound = new Set();

async function getProfileIdsFromCMJ() {
  console.log('🔍 Querying profile IDs from CMJ results table...');

  const sql = `
    SELECT DISTINCT profile_id
    FROM \`vald-ref-data-copy.${dataset}.cmj_results\`
    WHERE profile_id IS NOT NULL
    LIMIT 100
  `;

  const results = await query(sql);
  console.log(`   Found ${results.length} profiles to sample\n`);
  return results;
}

async function collectTestTypes(profileId) {
  await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS));

  try {
    const tests = await valdApiService.getForceDecksTests(profileId, 'SJ');

    if (tests && tests.data && tests.data.length > 0) {
      tests.data.forEach(test => {
        if (test.testType) {
          testTypesFound.add(test.testType);
        }
      });
    }
  } catch (error) {
    console.error(`   Error fetching tests for ${profileId}: ${error.message}`);
  }
}

async function main() {
  console.log('\\n🔍 COLLECTING ALL TEST TYPES FROM VALD API');
  console.log('============================================================\\n');

  try {
    const profiles = await getProfileIdsFromCMJ();

    console.log('📊 Sampling profiles to find all test types...');
    console.log('   (This will take a few minutes)\\n');

    let count = 0;
    for (const profile of profiles) {
      count++;
      process.stdout.write(`\\r   Progress: ${count}/${profiles.length} profiles`);
      await collectTestTypes(profile.profile_id);
    }

    console.log('\\n\\n✅ COMPLETE - Found Test Types:');
    console.log('============================================================');

    const sortedTestTypes = Array.from(testTypesFound).sort();
    sortedTestTypes.forEach(testType => {
      console.log(`   - ${testType}`);
    });

    console.log(`\\n   Total unique test types: ${testTypesFound.size}`);
    console.log('============================================================\\n');

  } catch (error) {
    console.error('\\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
