import mlbNormsService from './server/services/mlbNormsService.js';

async function testMLBNorms() {
  console.log('🧪 Testing MLB Norms Service\n');

  try {
    // Test 1: Get CMJ norms for all players
    console.log('1️⃣  Fetching CMJ norms for all MLB players...');
    const cmjNorms = await mlbNormsService.getCMJNorms();

    if (cmjNorms) {
      console.log('✅ CMJ Norms retrieved successfully');
      console.log(`   Sample size: ${cmjNorms.sampleSize} athletes`);
      console.log(`   Average jump height: ${cmjNorms.averages.jumpHeight?.toFixed(1)} cm`);
      console.log(`   Percentiles (Jump Height):`);
      if (cmjNorms.percentiles.jumpHeight) {
        console.log(`   - 25th: ${cmjNorms.percentiles.jumpHeight.p25?.toFixed(1)} cm`);
        console.log(`   - 50th: ${cmjNorms.percentiles.jumpHeight.p50?.toFixed(1)} cm`);
        console.log(`   - 75th: ${cmjNorms.percentiles.jumpHeight.p75?.toFixed(1)} cm`);
        console.log(`   - 95th: ${cmjNorms.percentiles.jumpHeight.p95?.toFixed(1)} cm`);
      }
    }

    // Test 2: Get Hop RSI norms
    console.log('\n2️⃣  Fetching Hop RSI norms...');
    const hopNorms = await mlbNormsService.getHopRSINorms();

    if (hopNorms) {
      console.log('✅ Hop RSI Norms retrieved successfully');
      console.log(`   Sample size: ${hopNorms.sampleSize} athletes`);
      console.log(`   Average RSI: ${hopNorms.averages.hopRSI?.toFixed(2)}`);
    }

    // Test 3: Get IMTP norms
    console.log('\n3️⃣  Fetching IMTP norms...');
    const imtpNorms = await mlbNormsService.getIMTPNorms();

    if (imtpNorms) {
      console.log('✅ IMTP Norms retrieved successfully');
      console.log(`   Sample size: ${imtpNorms.sampleSize} athletes`);
      console.log(`   Average peak force: ${imtpNorms.averages.peakForce?.toFixed(1)} N`);
    }

    // Test 4: Get PPU norms
    console.log('\n4️⃣  Fetching PPU norms...');
    const ppuNorms = await mlbNormsService.getPPUNorms();

    if (ppuNorms) {
      console.log('✅ PPU Norms retrieved successfully');
      console.log(`   Sample size: ${ppuNorms.sampleSize} athletes`);
      console.log(`   Average push-up height: ${ppuNorms.averages.pushUpHeight?.toFixed(1)} cm`);
    }

    // Test 4: Get position rankings
    console.log('\n4️⃣  Fetching position rankings...');
    const positions = await mlbNormsService.getPositionRankings();

    if (positions && positions.length > 0) {
      console.log('✅ Position rankings retrieved');
      console.log('   Top 5 positions by athlete count:');
      positions.slice(0, 5).forEach(pos => {
        console.log(`   - ${pos.position || 'Unknown'}: ${pos.athlete_count} athletes`);
      });
    }

    // Test 5: Test percentile ranking for a sample athlete
    console.log('\n5️⃣  Testing percentile ranking calculation...');
    const testAthleteValue = 40.0; // 40 cm jump height
    const percentileRank = await mlbNormsService.getAthletePercentileRank('cmj', 'jump_height_in_cm', testAthleteValue);

    if (percentileRank) {
      console.log(`✅ Percentile rank calculated`);
      console.log(`   Athlete with ${testAthleteValue} cm jump height:`);
      console.log(`   - Percentile: ${percentileRank.percentile}th`);
      console.log(`   - Classification: ${percentileRank.comparison}`);
      console.log(`   - Compared against: ${percentileRank.totalAthletes} athletes`);
    }

    // Test 6: Full comparison for sample athlete data
    console.log('\n6️⃣  Testing full jump comparison...');
    const sampleAthleteData = {
      cmj: {
        jumpHeight: 42.5,
        peakPowerBM: 65.2
      },
      squatJump: {
        jumpHeight: 38.0
      },
      imtp: {
        peakForceBM: 45.0
      }
    };

    const fullComparison = await mlbNormsService.getFullJumpComparison(sampleAthleteData);

    if (fullComparison) {
      console.log('✅ Full comparison completed');

      if (fullComparison.cmj) {
        console.log('\n   CMJ Comparison:');
        if (fullComparison.cmj.athletePercentiles.jumpHeight) {
          console.log(`   - Jump Height Percentile: ${fullComparison.cmj.athletePercentiles.jumpHeight.percentile}th`);
        }
        if (fullComparison.cmj.athletePercentiles.peakPower) {
          console.log(`   - Peak Power Percentile: ${fullComparison.cmj.athletePercentiles.peakPower.percentile}th`);
        }
      }
    }

    console.log('\n✅ MLB Norms Service test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

// Run the test
testMLBNorms();