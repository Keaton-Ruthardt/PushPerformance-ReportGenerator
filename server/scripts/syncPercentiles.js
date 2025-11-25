import { fetchAllProTestData } from '../services/valdService.js';
import { calculateStats, storePercentileRange } from '../services/percentileService.js';

/**
 * Sync percentile ranges from VALD professional athletes data
 */
const syncPercentiles = async () => {
  console.log('Starting percentile sync...');

  try {
    // Define test types and their metrics
    const testConfigs = {
      cmj: [
        'jumpHeight',
        'eccentricBrakingRFD',
        'forceAtZeroVelocity',
        'eccentricPeakForce',
        'concentricImpulse100ms',
        'eccentricPeakVelocity',
        'concentricPeakVelocity',
        'eccentricPeakPower',
        'eccentricPeakPowerPerBM',
        'peakPower',
        'peakPowerPerBM',
        'rsiMod',
      ],
      sj: [
        'jumpHeight',
        'forceAtPeakPower',
        'concentricPeakVelocity',
        'peakPower',
        'peakPowerPerBM',
      ],
      ht: ['rsi', 'jumpHeight', 'groundContactTime'],
      slcmj: [
        'left.jumpHeight',
        'left.eccentricPeakForce',
        'left.eccentricBrakingRFD',
        'left.concentricPeakForce',
        'left.eccentricPeakVelocity',
        'left.concentricPeakVelocity',
        'left.peakPower',
        'left.peakPowerPerBM',
        'left.rsiMod',
        'right.jumpHeight',
        'right.eccentricPeakForce',
        'right.eccentricBrakingRFD',
        'right.concentricPeakForce',
        'right.eccentricPeakVelocity',
        'right.concentricPeakVelocity',
        'right.peakPower',
        'right.peakPowerPerBM',
        'right.rsiMod',
      ],
      imtp: [
        'peakVerticalForce',
        'peakVerticalForcePerBM',
        'forceAt100ms',
        'timeToPeakForce',
      ],
      ppu: [
        'pushUpHeight',
        'eccentricPeakForce',
        'concentricPeakForce',
        'concentricRFDLeft',
        'concentricRFDRight',
        'eccentricBrakingRFD',
      ],
    };

    // Process each test type
    for (const [testType, metrics] of Object.entries(testConfigs)) {
      console.log(`\nProcessing ${testType.toUpperCase()} test...`);

      try {
        // Fetch all pro athlete data for this test type
        const allTestData = await fetchAllProTestData(testType);

        if (!allTestData || allTestData.length === 0) {
          console.log(`No data found for ${testType}`);
          continue;
        }

        console.log(`Found ${allTestData.length} pro athletes with ${testType} data`);

        // Calculate and store percentiles for each metric
        for (const metricPath of metrics) {
          const metricValues = allTestData.map(data => {
            // Handle nested metrics (e.g., 'left.jumpHeight')
            const keys = metricPath.split('.');
            let value = data;
            for (const key of keys) {
              value = value?.[key];
            }
            return value;
          }).filter(v => v !== null && v !== undefined);

          if (metricValues.length > 0) {
            const stats = calculateStats(metricValues);
            await storePercentileRange(testType, metricPath, stats);
            console.log(`  ✓ ${metricPath}: ${stats.sampleSize} samples`);
          }
        }
      } catch (error) {
        console.error(`Error processing ${testType}:`, error.message);
      }
    }

    console.log('\n✅ Percentile sync completed successfully!');
  } catch (error) {
    console.error('❌ Error during percentile sync:', error.message);
    throw error;
  }
};

// Run the sync if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncPercentiles()
    .then(() => {
      console.log('Sync finished. Exiting...');
      process.exit(0);
    })
    .catch(error => {
      console.error('Sync failed:', error);
      process.exit(1);
    });
}

export default syncPercentiles;
