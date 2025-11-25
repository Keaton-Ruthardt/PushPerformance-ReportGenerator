import valdApiService from '../server/services/valdApiServiceInstance.js';

/**
 * Test searching for Blake Weiman through valdApiService
 */

async function testBlakeSearch() {
  try {
    console.log('🔍 Testing athlete search for "Blake Weiman"...\n');

    // Test exact name search
    console.log('Test 1: Searching for "Blake"...');
    const blakeResults = await valdApiService.searchAthletes('Blake');

    console.log(`\n📊 Found ${blakeResults.length} athletes matching "Blake":`);
    blakeResults.forEach(athlete => {
      console.log(`   - ${athlete.name} (${athlete.id})`);
      console.log(`     Source: ${athlete.source}`);
      console.log(`     Profile IDs: ${JSON.stringify(athlete.profileIds)}`);
      console.log(`     Groups: ${athlete.group_name_1}, ${athlete.group_name_2}, ${athlete.group_name_3}`);
    });

    // Check if Blake Weiman specifically is in the results
    const blakeWeiman = blakeResults.find(a =>
      a.name.toLowerCase().includes('blake') && a.name.toLowerCase().includes('weiman')
    );

    if (blakeWeiman) {
      console.log('\n✅ ✅ ✅ Blake Weiman FOUND in search results!');
      console.log(JSON.stringify(blakeWeiman, null, 2));
    } else {
      console.log('\n❌ Blake Weiman NOT found in search results');
      console.log('This explains why he doesn\'t show up in the UI search');
    }

    // Test empty search (should return all athletes)
    console.log('\n\nTest 2: Empty search (should return all athletes)...');
    const allAthletes = await valdApiService.searchAthletes('');
    console.log(`📊 Total athletes returned: ${allAthletes.length}`);

    const blakeInAll = allAthletes.find(a =>
      a.name.toLowerCase().includes('blake') && a.name.toLowerCase().includes('weiman')
    );

    if (blakeInAll) {
      console.log('✅ Blake Weiman found in full athlete list');
    } else {
      console.log('❌ Blake Weiman NOT in full athlete list');
    }

  } catch (error) {
    console.error('❌ Error testing search:', error);
  }
}

testBlakeSearch();
