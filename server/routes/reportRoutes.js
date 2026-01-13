import express from 'express';
import valdApiService from '../services/valdApiServiceInstance.js';
import mlbNormsService from '../services/mlbNormsService.js';
import reportGeneratorService from '../services/reportGeneratorService.js';
import { getComparativeAnalysis } from '../services/cmjComparativeService.js';
import { getSJComparativeAnalysis } from '../services/sjComparativeService.js';
import { getIMTPComparativeAnalysis } from '../services/imtpComparativeService.js';
import { getPPUComparativeAnalysis } from '../services/ppuComparativeService.js';
import { getComparativeAnalysis as getHopComparativeAnalysis } from '../services/hopComparativeService.js';
import { generatePDF } from '../services/pdfServiceWithComparative.js';
import { generatePdfFromHtml } from '../services/puppeteerPdfService.js';
import { query as bqQuery, dataset as datasetName } from '../config/bigquery.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Convert centimeters to inches
 * @param {number} cm - Value in centimeters
 * @returns {number|null} Value in inches or null if input is null/undefined
 */
function cmToInches(cm) {
  if (cm === null || cm === undefined) return null;
  return cm / 2.54;
}

const router = express.Router();

/**
 * Calculate hop test metrics from trial data
 * Calculates the average of the best 5 jumps for RSI, Jump Height, and GCT
 */
function calculateHopMetricsFromTrials(hopTest) {
  if (!hopTest || !hopTest.trials || !Array.isArray(hopTest.trials) || hopTest.trials.length === 0) {
    console.log('⚠️  No trials data available for hop test');
    return null;
  }

  const trial = hopTest.trials[0]; // Hop tests typically have one trial with multiple jumps
  if (!trial.results || !Array.isArray(trial.results)) {
    console.log('⚠️  No results in hop test trial');
    return null;
  }

  // Extract all individual jump values for each metric
  const rsiValues = [];
  const jumpHeightValues = [];
  const gctValues = [];

  for (const result of trial.results) {
    if (!result.definition || !result.definition.result) continue;

    const fieldName = result.definition.result;
    const value = result.value;

    // Collect individual jump values (not the summary metrics like BEST or MEAN)
    // Using regular HOP_RSI (flight time / ground contact time ratio)
    if (fieldName === 'HOP_RSI' && result.limb === 'Trial') {
      rsiValues.push(value);
    } else if (fieldName === 'HOP_JUMP_HEIGHT' && result.limb === 'Trial') {
      jumpHeightValues.push(value);
    } else if (fieldName === 'HOP_CONTACT_TIME' && result.limb === 'Trial') {
      gctValues.push(value);
    }
  }

  console.log(`📊 Hop test raw values - RSI: ${rsiValues.length}, JH: ${jumpHeightValues.length}, GCT: ${gctValues.length}`);

  // Calculate average of best 5 for each metric
  const avgBest5 = (values) => {
    if (values.length === 0) return null;
    // Sort descending and take top 5 (or all if less than 5)
    const sorted = [...values].sort((a, b) => b - a);
    const best5 = sorted.slice(0, Math.min(5, sorted.length));
    const avg = best5.reduce((sum, val) => sum + val, 0) / best5.length;
    return avg;
  };

  // For GCT, lower is better, so sort ascending
  const avgBest5GCT = (values) => {
    if (values.length === 0) return null;
    // Sort ascending and take top 5 (lowest values)
    const sorted = [...values].sort((a, b) => a - b);
    const best5 = sorted.slice(0, Math.min(5, sorted.length));
    const avg = best5.reduce((sum, val) => sum + val, 0) / best5.length;
    return avg;
  };

  const metrics = {
    rsi: avgBest5(rsiValues),
    jumpHeight: avgBest5(jumpHeightValues),
    gct: avgBest5GCT(gctValues)  // Values are already in seconds from VALD API
  };

  console.log(`📊 Calculated hop metrics (avg of best 5):`, metrics);
  console.log(`   GCT raw values (first 5):`, gctValues.slice(0, 5));

  return metrics;
}

/**
 * Helper function to generate Single Leg CMJ recommendations
 */
function generateSingleLegCMJRecommendations(leftData, rightData) {
  if (!leftData || !rightData) {
    return null;
  }

  const recommendations = [];

  // Calculate asymmetries for key metrics
  const metrics = [
    { name: 'Jump Height', left: leftData.jumpHeight, right: rightData.jumpHeight },
    { name: 'Eccentric Peak Force', left: leftData.eccentricPeakForce, right: rightData.eccentricPeakForce },
    { name: 'Eccentric Braking RFD', left: leftData.eccentricBrakingRFD, right: rightData.eccentricBrakingRFD },
    { name: 'Concentric Peak Force', left: leftData.concentricPeakForce, right: rightData.concentricPeakForce },
    { name: 'Peak Power', left: leftData.peakPower, right: rightData.peakPower },
    { name: 'Peak Power / BM', left: leftData.peakPowerPerBM, right: rightData.peakPowerPerBM },
    { name: 'RSI', left: leftData.rsi, right: rightData.rsi }  // Standard RSI (changed from RSI-mod)
  ];

  let highestAsymmetry = 0;
  let highestAsymmetryMetric = null;
  let dominantSide = null;

  metrics.forEach(metric => {
    if (metric.left && metric.right) {
      const asymmetryPercent = Math.abs(((metric.left - metric.right) / Math.max(metric.left, metric.right)) * 100);
      if (asymmetryPercent > highestAsymmetry) {
        highestAsymmetry = asymmetryPercent;
        highestAsymmetryMetric = metric.name;
        dominantSide = metric.left > metric.right ? 'Left' : 'Right';
      }
    }
  });

  // Generate recommendations based on asymmetry levels
  if (highestAsymmetry > 15) {
    recommendations.push(`CRITICAL: Significant ${highestAsymmetry.toFixed(1)}% asymmetry detected in ${highestAsymmetryMetric} (${dominantSide} side dominant). Prioritize unilateral training to address this imbalance and reduce injury risk.`);
    recommendations.push(`Focus on strengthening the weaker leg through single-leg exercises: Bulgarian split squats, single-leg RDLs, and step-ups.`);
  } else if (highestAsymmetry > 10) {
    recommendations.push(`MODERATE: ${highestAsymmetry.toFixed(1)}% asymmetry in ${highestAsymmetryMetric} (${dominantSide} side dominant). Incorporate more unilateral exercises to reduce this imbalance.`);
    recommendations.push(`Add single-leg plyometric work and tempo training on the weaker side.`);
  } else if (highestAsymmetry > 5) {
    recommendations.push(`MINOR: ${highestAsymmetry.toFixed(1)}% asymmetry in ${highestAsymmetryMetric}. This is within acceptable range but monitor during training.`);
    recommendations.push(`Continue bilateral and unilateral training with balanced volume.`);
  } else {
    recommendations.push(`EXCELLENT: Asymmetries are all below 5%, indicating good bilateral balance.`);
    recommendations.push(`Maintain current training approach with continued monitoring of single-leg performance.`);
  }

  // Check for overall power output
  const avgPowerBM = ((leftData.peakPowerPerBM || 0) + (rightData.peakPowerPerBM || 0)) / 2;
  if (avgPowerBM < 40) {
    recommendations.push(`Focus on developing overall lower body power through Olympic lifts and plyometric training.`);
  }

  return recommendations.join(' ');
}

/**
 * Generate performance report for an athlete
 * POST /api/reports/generate
 * Body: { athleteId: string, name: string, position?: string }
 */
router.post('/generate', async (req, res) => {
  try {
    const { athleteId, name, position, selectedTests, profileIds } = req.body;

    console.log(`\n🎯 REPORT GENERATION REQUEST RECEIVED`);
    console.log(`   Athlete ID: ${athleteId}`);
    console.log(`   Profile IDs: ${profileIds ? JSON.stringify(profileIds) : 'Not provided'}`);
    console.log(`   Name: ${name}`);
    console.log(`   Position: ${position}`);
    console.log(`   Selected Tests:`, selectedTests);

    if (!athleteId || !name) {
      console.log('❌ Missing required fields!');
      return res.status(400).json({
        error: 'Missing required fields: athleteId and name'
      });
    }

    console.log(`📊 Generating report for ${name} (ID: ${athleteId})`);

    // Step 1: Fetch athlete data from VALD API
    console.log('1️⃣  Fetching athlete data from VALD...');
    let valdData;

    if (selectedTests && Object.keys(selectedTests).length > 0) {
      // User has selected specific tests - fetch those specific tests
      console.log('   Using user-selected tests');
      // Pass profileIds array if available, otherwise default to single athleteId
      const idsToFetch = profileIds && profileIds.length > 0 ? profileIds : [athleteId];
      valdData = await fetchSelectedTests(idsToFetch, selectedTests);
    } else {
      // No specific tests selected - use latest tests (default behavior)
      console.log('   Using latest tests (no selection provided)');
      valdData = await valdApiService.getAthleteTestData(athleteId);
    }

    if (!valdData) {
      return res.status(404).json({
        error: 'No test data found for this athlete'
      });
    }

    // Step 2: Get MLB norms for comparison
    console.log('2️⃣  Fetching MLB professional norms...');
    const norms = {
      cmj: null,
      hopRSI: null,
      imtp: null,
      ppu: null
    };

    // Fetch norms for available tests
    if (valdData.forceDecks?.cmj) {
      norms.cmj = await mlbNormsService.getCMJNorms(position);
    }

    norms.hopRSI = await mlbNormsService.getHopRSINorms(position);
    norms.imtp = await mlbNormsService.getIMTPNorms(position);
    norms.ppu = await mlbNormsService.getPPUNorms(position);

    // Step 3: Calculate percentile rankings
    console.log('3️⃣  Calculating percentile rankings...');
    const comparisons = {};

    // Get comprehensive CMJ comparative analysis
    let cmjComparison = null;
    console.log('🔍 Checking for CMJ data...');
    console.log('   Has forceDecks:', !!valdData.forceDecks);
    console.log('   Has CMJ:', !!valdData.forceDecks?.cmj);

    if (valdData.forceDecks?.cmj) {
      try {
        const cmjTest = valdData.forceDecks.cmj;
        console.log('📊 CMJ Test Data - ALL Keys:', Object.keys(cmjTest));
        console.log('📊 CMJ Test Data - Sample values:', {
          testId: cmjTest.testId,
          id: cmjTest.id,
          recordedDateUtc: cmjTest.recordedDateUtc,
          hasMetrics: Object.keys(cmjTest).some(k => k.includes('JUMP') || k.includes('FORCE') || k.includes('POWER'))
        });

        // Check what's in extendedParameters and attributes
        console.log('📊 extendedParameters type:', typeof cmjTest.extendedParameters);
        console.log('📊 extendedParameters:', JSON.stringify(cmjTest.extendedParameters).substring(0, 500));
        console.log('📊 attributes type:', typeof cmjTest.attributes);
        console.log('📊 attributes:', JSON.stringify(cmjTest.attributes).substring(0, 500));

        // Log metrics we're looking for and what we find
        const expectedMetrics = {
          'JUMP_HEIGHT_Trial_cm': cmjTest.JUMP_HEIGHT_Trial_cm,
          'ECCENTRIC_BRAKING_RFD_Trial_N_per_s': cmjTest.ECCENTRIC_BRAKING_RFD_Trial_N_per_s,
          'FORCE_AT_ZERO_VELOCITY_Trial_N': cmjTest.FORCE_AT_ZERO_VELOCITY_Trial_N,
          'PEAK_ECCENTRIC_FORCE_Trial_N': cmjTest.PEAK_ECCENTRIC_FORCE_Trial_N,
          'CONCENTRIC_IMPULSE_Trial_Ns': cmjTest.CONCENTRIC_IMPULSE_Trial_Ns
        };
        console.log('📊 Expected vs Actual metrics:');
        for (const [key, value] of Object.entries(expectedMetrics)) {
          console.log(`   ${key}: ${value !== undefined ? '✅ ' + value : '❌ MISSING'}`);
        }

        // Find similar metric names that might be what we're looking for
        const allKeys = Object.keys(cmjTest);
        console.log('📊 Searching for ECCENTRIC and RFD metrics:');
        const eccentricKeys = allKeys.filter(k => k.includes('ECCENTRIC') && k.includes('RFD'));
        console.log('   ECCENTRIC + RFD keys:', eccentricKeys);

        console.log('📊 Searching for IMPULSE metrics:');
        const impulseKeys = allKeys.filter(k => k.includes('IMPULSE'));
        console.log('   IMPULSE keys:', impulseKeys);

        console.log('📊 Searching for RSI metrics:');
        const rsiKeys = allKeys.filter(k => k.includes('RSI'));
        console.log('   RSI keys:', rsiKeys);

        // Log RSI values specifically
        console.log('📊 RSI VALUES:');
        console.log('   RSI_MODIFIED_Trial_RSIModified:', cmjTest.RSI_MODIFIED_Trial_RSIModified);
        console.log('   RSI_MODIFIED_IMP_MOM_Trial_RSIModified:', cmjTest.RSI_MODIFIED_IMP_MOM_Trial_RSIModified);
        console.log('   RSI_MODIFIED_Trial_RSI_mod:', cmjTest.RSI_MODIFIED_Trial_RSI_mod);

        const cmjMetrics = {
          jumpHeight: cmjTest.JUMP_HEIGHT_INCHES_Trial_in || cmjTest.JUMP_HEIGHT_Trial_cm / 2.54, // Use native inches field from API
          eccentricBrakingRFD: cmjTest.ECCENTRIC_BRAKING_RFD_Trial_N_per_s,
          forceAtZeroVelocity: cmjTest.FORCE_AT_ZERO_VELOCITY_Trial_N,
          eccentricPeakForce: cmjTest.PEAK_ECCENTRIC_FORCE_Trial_N,
          concentricImpulse: cmjTest.CONCENTRIC_IMPULSE_Trial_Ns,
          eccentricPeakVelocity: cmjTest.ECCENTRIC_PEAK_VELOCITY_Trial_m_per_s,
          concentricPeakVelocity: cmjTest.PEAK_TAKEOFF_VELOCITY_Trial_m_per_s,
          eccentricPeakPower: cmjTest.ECCENTRIC_PEAK_POWER_Trial_W,
          eccentricPeakPowerBM: cmjTest.BODYMASS_RELATIVE_ECCENTRIC_PEAK_POWER_Trial_W_per_kg,
          peakPower: cmjTest.PEAK_TAKEOFF_POWER_Trial_W,
          peakPowerBM: cmjTest.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg,
          rsi: cmjTest.FLIGHT_CONTRACTION_TIME_RATIO_Trial_,  // Standard RSI (changed from RSI-modified)
          countermovementDepth: cmjTest.COUNTERMOVEMENT_DEPTH_Trial_cm // Extract as cm, will be converted by comparative service
        };

        console.log('📊 Extracted CMJ Metrics (first 3):', {
          jumpHeight: cmjMetrics.jumpHeight,
          eccentricBrakingRFD: cmjMetrics.eccentricBrakingRFD,
          forceAtZeroVelocity: cmjMetrics.forceAtZeroVelocity
        });
        console.log('📊 Standard RSI EXTRACTION:', {
          rsi: cmjMetrics.rsi,
          rawValue: cmjTest.FLIGHT_CONTRACTION_TIME_RATIO_Trial_
        });

        cmjComparison = await getComparativeAnalysis(cmjMetrics);
        console.log(`✅ CMJ comparison complete - analyzed against ${cmjComparison.totalProTests} professional athletes`);
      } catch (error) {
        console.error('❌ Error getting CMJ comparison:', error);
      }
    } else {
      console.log('⚠️  No CMJ data available for this athlete');
    }

    // Step 3.5: Squat Jump Comparative Analysis
    console.log('3️⃣.5️⃣  Running SJ comparative analysis...');
    let sjComparison = null;
    if (valdData.forceDecks?.squatJump) {
      try {
        const sjTest = valdData.forceDecks.squatJump;
        const sjMetrics = {
          jumpHeight: sjTest.JUMP_HEIGHT_Trial_cm || sjTest.JUMP_HEIGHT_IMP_MOM_Trial_cm, // Convert from cm (no native inches field)
          forceAtPeakPower: sjTest.FORCE_AT_PEAK_POWER_Trial_N || sjTest.CONCENTRIC_PEAK_FORCE_Trial_N,
          concentricPeakVelocity: sjTest.VELOCITY_AT_PEAK_POWER_Trial_m_per_s || sjTest.PEAK_TAKEOFF_VELOCITY_Trial_m_per_s,
          peakPower: sjTest.PEAK_TAKEOFF_POWER_Trial_W || sjTest.CONCENTRIC_PEAK_POWER_Trial_W,
          peakPowerBM: sjTest.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg || sjTest.BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg
        };

        console.log('📊 SJ METRICS:', sjMetrics);

        sjComparison = await getSJComparativeAnalysis(sjMetrics);
        if (sjComparison) {
          console.log(`✅ SJ comparison complete - analyzed against ${sjComparison.summary.totalTests} professional athletes`);
        } else {
          console.log('⚠️  No SJ comparative data available');
        }
      } catch (error) {
        console.error('❌ Error getting SJ comparison:', error);
      }
    } else {
      console.log('⚠️  No SJ data available for this athlete');
    }

    // Step 3.6: IMTP Comparative Analysis
    console.log('3️⃣.6️⃣  Running IMTP comparative analysis...');
    let imtpComparison = null;
    if (valdData.forceDecks?.imtp) {
      try {
        const imtpTest = valdData.forceDecks.imtp;
        const imtpMetrics = {
          peakVerticalForce: imtpTest.PEAK_VERTICAL_FORCE_Trial_N,
          peakForceBM: imtpTest.ISO_BM_REL_FORCE_PEAK_Trial_N_per_kg,
          forceAt100ms: imtpTest.FORCE_AT_100MS_Trial_N,
          timeToPeakForce: imtpTest.START_TO_PEAK_FORCE_Trial_s
        };

        console.log('📊 IMTP METRICS:', imtpMetrics);

        imtpComparison = await getIMTPComparativeAnalysis(imtpMetrics);
        if (imtpComparison) {
          console.log(`✅ IMTP comparison complete - analyzed against ${imtpComparison.summary.totalTests} professional athletes`);
        } else {
          console.log('⚠️  No IMTP comparative data available');
        }
      } catch (error) {
        console.error('❌ Error getting IMTP comparison:', error);
      }
    } else {
      console.log('⚠️  No IMTP data available for this athlete');
    }

    // Step 3.7: PPU Comparative Analysis
    console.log('3️⃣.7️⃣  Running PPU comparative analysis...');
    let ppuComparison = null;
    if (valdData.forceDecks?.plyoPushUp) {
      try {
        const ppuTest = valdData.forceDecks.plyoPushUp;
        const ppuMetrics = {
          pushupHeight: ppuTest.PUSHUP_HEIGHT_INCHES_Trial_in || ppuTest.PUSHUP_HEIGHT_Trial_cm / 2.54, // Use native inches field
          eccentricPeakForce: ppuTest.PEAK_ECCENTRIC_FORCE_Trial_N,
          concentricPeakForce: ppuTest.PEAK_CONCENTRIC_FORCE_Trial_N,
          concentricRFD_L: ppuTest.CONCENTRIC_RFD_Left_N_per_s,
          concentricRFD_R: ppuTest.CONCENTRIC_RFD_Right_N_per_s,
          eccentricBrakingRFD: ppuTest.ECCENTRIC_BRAKING_RFD_Trial_N_per_s
        };

        console.log('📊 PPU METRICS:', ppuMetrics);

        ppuComparison = await getPPUComparativeAnalysis(ppuMetrics);
        if (ppuComparison) {
          console.log(`✅ PPU comparison complete - analyzed against ${ppuComparison.summary.totalTests} professional athletes`);
        } else {
          console.log('⚠️  No PPU comparative data available');
        }
      } catch (error) {
        console.error('❌ Error getting PPU comparison:', error);
      }
    } else {
      console.log('⚠️  No PPU data available for this athlete');
    }

    // Step 3.8: Hop Test Comparative Analysis
    console.log('3️⃣.8️⃣  Running Hop Test comparative analysis...');
    let hopComparison = null;
    if (valdData.forceDecks?.hopTest) {
      try {
        const hopTest = valdData.forceDecks.hopTest;
        console.log('📊 HOP TEST Data - Sample Keys:', Object.keys(hopTest).slice(0, 20).join(', '));

        // Calculate hop test metrics from trial data (average of best 5 jumps)
        const hopMetrics = calculateHopMetricsFromTrials(hopTest);

        if (!hopMetrics) {
          console.log('⚠️  Could not calculate hop test metrics from trials');
        } else {
          console.log('📊 HOP TEST METRICS (avg of best 5):', hopMetrics);

          // Only run comparison if we have all three metrics
          if (hopMetrics.rsi !== null && hopMetrics.jumpHeight !== null && hopMetrics.gct !== null) {
            // Convert jump height from cm to inches for comparison (BigQuery table stores in inches)
            const hopMetricsForComparison = {
              ...hopMetrics,
              jumpHeight: hopMetrics.jumpHeight / 2.54  // Convert cm to inches
            };
            hopComparison = await getHopComparativeAnalysis(hopMetricsForComparison);
            console.log(`✅ Hop Test comparison complete - analyzed against ${hopComparison.totalProTests} professional athletes`);
          } else {
            console.log('⚠️  Hop test metrics not fully populated');
            console.log('   Missing:', Object.entries(hopMetrics).filter(([k, v]) => v === null).map(([k]) => k).join(', '));
          }
        }
      } catch (error) {
        console.error('❌ Error getting Hop Test comparison:', error);
      }
    } else {
      console.log('⚠️  No Hop Test data available for this athlete');
    }

    if (valdData.forceDecks?.cmj && norms.cmj) {
      comparisons.cmj = {
        percentile: calculatePercentileRank(
          valdData.forceDecks.cmj.JUMP_HEIGHT_IMP_MOM_Trial_cm,
          norms.cmj.percentiles.jumpHeight
        ),
        value: valdData.forceDecks.cmj.JUMP_HEIGHT_IMP_MOM_Trial_cm,
        norm: norms.cmj.averages.jumpHeight
      };

      if (valdData.forceDecks.cmj.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg) {
        comparisons.cmjPower = {
          percentile: calculatePercentileRank(
            valdData.forceDecks.cmj.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg,
            norms.cmj.percentiles.peakPowerBM
          ),
          value: valdData.forceDecks.cmj.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg,
          norm: norms.cmj.averages.peakPowerBM
        };
      }
    }

    // Generate Single Leg CMJ recommendations if data is available
    let slCmjRecommendations = null;
    if (valdData.forceDecks?.singleLegCMJ_Left && valdData.forceDecks?.singleLegCMJ_Right) {
      const leftData = {
        jumpHeight: valdData.forceDecks.singleLegCMJ_Left.JUMP_HEIGHT_IMP_MOM_Trial_cm || valdData.forceDecks.singleLegCMJ_Left.JUMP_HEIGHT_Trial_cm,
        eccentricPeakForce: valdData.forceDecks.singleLegCMJ_Left.PEAK_ECCENTRIC_FORCE_Trial_N,
        eccentricBrakingRFD: valdData.forceDecks.singleLegCMJ_Left.ECCENTRIC_BRAKING_RFD_Trial_N_per_s,
        concentricPeakForce: valdData.forceDecks.singleLegCMJ_Left.CONCENTRIC_PEAK_FORCE_Trial_N || valdData.forceDecks.singleLegCMJ_Left.PEAK_TAKEOFF_FORCE_Trial_N,
        peakPower: valdData.forceDecks.singleLegCMJ_Left.PEAK_TAKEOFF_POWER_Trial_W || valdData.forceDecks.singleLegCMJ_Left.PEAK_POWER_Trial_W,
        peakPowerPerBM: valdData.forceDecks.singleLegCMJ_Left.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg || valdData.forceDecks.singleLegCMJ_Left.BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg,
        // Try multiple field name variations for RSI
        rsi: valdData.forceDecks.singleLegCMJ_Left.FLIGHT_CONTRACTION_TIME_RATIO_Left_No_Unit ||
             valdData.forceDecks.singleLegCMJ_Left.FLIGHT_CONTRACTION_TIME_RATIO_Trial_No_Unit ||
             valdData.forceDecks.singleLegCMJ_Left.FLIGHT_CONTRACTION_TIME_RATIO_Left_ ||
             valdData.forceDecks.singleLegCMJ_Left.FLIGHT_CONTRACTION_TIME_RATIO_Trial_ ||
             valdData.forceDecks.singleLegCMJ_Left.RSI_Left_ ||
             valdData.forceDecks.singleLegCMJ_Left.RSI_Trial_
      };

      const rightData = {
        jumpHeight: valdData.forceDecks.singleLegCMJ_Right.JUMP_HEIGHT_IMP_MOM_Trial_cm || valdData.forceDecks.singleLegCMJ_Right.JUMP_HEIGHT_Trial_cm,
        eccentricPeakForce: valdData.forceDecks.singleLegCMJ_Right.PEAK_ECCENTRIC_FORCE_Trial_N,
        eccentricBrakingRFD: valdData.forceDecks.singleLegCMJ_Right.ECCENTRIC_BRAKING_RFD_Trial_N_per_s,
        concentricPeakForce: valdData.forceDecks.singleLegCMJ_Right.CONCENTRIC_PEAK_FORCE_Trial_N || valdData.forceDecks.singleLegCMJ_Right.PEAK_TAKEOFF_FORCE_Trial_N,
        peakPower: valdData.forceDecks.singleLegCMJ_Right.PEAK_TAKEOFF_POWER_Trial_W || valdData.forceDecks.singleLegCMJ_Right.PEAK_POWER_Trial_W,
        peakPowerPerBM: valdData.forceDecks.singleLegCMJ_Right.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg || valdData.forceDecks.singleLegCMJ_Right.BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg,
        // Try multiple field name variations for RSI
        rsi: valdData.forceDecks.singleLegCMJ_Right.FLIGHT_CONTRACTION_TIME_RATIO_Right_No_Unit ||
             valdData.forceDecks.singleLegCMJ_Right.FLIGHT_CONTRACTION_TIME_RATIO_Trial_No_Unit ||
             valdData.forceDecks.singleLegCMJ_Right.FLIGHT_CONTRACTION_TIME_RATIO_Right_ ||
             valdData.forceDecks.singleLegCMJ_Right.FLIGHT_CONTRACTION_TIME_RATIO_Trial_ ||
             valdData.forceDecks.singleLegCMJ_Right.RSI_Right_ ||
             valdData.forceDecks.singleLegCMJ_Right.RSI_Trial_
      };

      slCmjRecommendations = generateSingleLegCMJRecommendations(leftData, rightData);
      console.log('✅ Generated Single Leg CMJ recommendations:', slCmjRecommendations);
    } else {
      console.log('⚠️  No Single Leg CMJ data available for recommendations');
    }

    // Step 4: Prepare report data
    console.log('4️⃣  Preparing report data...');
    const reportData = {
      name: name,
      athleteId: athleteId,
      dateOfBirth: valdData.profile?.dateOfBirth,
      height: valdData.profile?.height,
      weight: valdData.profile?.weight,
      position: position || valdData.profile?.position,
      team: valdData.profile?.team,
      testDate: new Date().toISOString(),
      cmjComparison: cmjComparison, // Add CMJ comparative analysis
      sjComparison: sjComparison, // Add SJ comparative analysis
      imtpComparison: imtpComparison, // Add IMTP comparative analysis
      ppuComparison: ppuComparison, // Add PPU comparative analysis
      hopComparison: hopComparison, // Add Hop Test comparative analysis
      slCmjRecommendations: slCmjRecommendations, // Add Single Leg CMJ recommendations
      slCmjWarning: valdData.slCmjWarning || null, // Add warning if only one leg found
      tests: {
        cmj: valdData.forceDecks?.cmj ? {
          jumpHeight: valdData.forceDecks.cmj.JUMP_HEIGHT_INCHES_Trial_in,
          peakPower: valdData.forceDecks.cmj.PEAK_TAKEOFF_POWER_Trial_W,
          peakPowerBM: valdData.forceDecks.cmj.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg,
          rsi: valdData.forceDecks.cmj.FLIGHT_CONTRACTION_TIME_RATIO_Trial_,  // Standard RSI (changed from RSI-modified)
          // Add all 13 metrics for detailed display
          eccentricBrakingRFD: valdData.forceDecks.cmj.ECCENTRIC_BRAKING_RFD_Trial_N_per_s,
          forceAtZeroVelocity: valdData.forceDecks.cmj.FORCE_AT_ZERO_VELOCITY_Trial_N,
          eccentricPeakForce: valdData.forceDecks.cmj.PEAK_ECCENTRIC_FORCE_Trial_N,
          concentricImpulse: valdData.forceDecks.cmj.CONCENTRIC_IMPULSE_Trial_Ns,
          eccentricPeakVelocity: valdData.forceDecks.cmj.ECCENTRIC_PEAK_VELOCITY_Trial_m_per_s,
          concentricPeakVelocity: valdData.forceDecks.cmj.PEAK_TAKEOFF_VELOCITY_Trial_m_per_s,
          eccentricPeakPower: valdData.forceDecks.cmj.ECCENTRIC_PEAK_POWER_Trial_W,
          eccentricPeakPowerBM: valdData.forceDecks.cmj.BODYMASS_RELATIVE_ECCENTRIC_PEAK_POWER_Trial_W_per_kg,
          countermovementDepth: cmToInches(valdData.forceDecks.cmj.COUNTERMOVEMENT_DEPTH_Trial_cm)
        } : null,
        squatJump: valdData.forceDecks?.squatJump ? {
          jumpHeight: cmToInches(valdData.forceDecks.squatJump.JUMP_HEIGHT_Trial_cm || valdData.forceDecks.squatJump.JUMP_HEIGHT_IMP_MOM_Trial_cm),
          forceAtPeakPower: valdData.forceDecks.squatJump.FORCE_AT_PEAK_POWER_Trial_N || valdData.forceDecks.squatJump.CONCENTRIC_PEAK_FORCE_Trial_N,
          concentricPeakVelocity: valdData.forceDecks.squatJump.CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s || valdData.forceDecks.squatJump.PEAK_TAKEOFF_VELOCITY_Trial_m_per_s,
          peakPower: valdData.forceDecks.squatJump.PEAK_POWER_Trial_W || valdData.forceDecks.squatJump.CONCENTRIC_PEAK_POWER_Trial_W || valdData.forceDecks.squatJump.PEAK_TAKEOFF_POWER_Trial_W,
          peakPowerBM: valdData.forceDecks.squatJump.BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg || valdData.forceDecks.squatJump.BODYMASS_RELATIVE_CONCENTRIC_PEAK_POWER_Trial_W_per_kg || valdData.forceDecks.squatJump.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg,
          weight: valdData.forceDecks.squatJump.weight || valdData.forceDecks.squatJump.bodyWeight
        } : null,
        hopTest: valdData.forceDecks?.hopTest ? (() => {
          const metrics = calculateHopMetricsFromTrials(valdData.forceDecks.hopTest);
          return metrics ? {
            rsi: metrics.rsi,
            jumpHeight: cmToInches(metrics.jumpHeight),
            gct: metrics.gct,
            groundContactTime: metrics.gct,  // Kept for PDF compatibility
            testDate: valdData.forceDecks.hopTest.recordedDateUtc || valdData.forceDecks.hopTest.testDate
          } : null;
        })() : null,
        imtp: valdData.forceDecks?.imtp ? {
          peakVerticalForce: valdData.forceDecks.imtp.PEAK_VERTICAL_FORCE_Trial_N,
          peakForceBM: valdData.forceDecks.imtp.ISO_BM_REL_FORCE_PEAK_Trial_N_per_kg,
          forceAt100ms: valdData.forceDecks.imtp.FORCE_AT_100MS_Trial_N,
          timeToPeakForce: valdData.forceDecks.imtp.START_TO_PEAK_FORCE_Trial_s,
          weight: valdData.forceDecks.imtp.weight || valdData.forceDecks.imtp.bodyWeight
        } : null,
        ppu: valdData.forceDecks?.plyoPushUp ? {
          pushupHeight: valdData.forceDecks.plyoPushUp.PUSHUP_HEIGHT_Trial_cm,
          eccentricPeakForce: valdData.forceDecks.plyoPushUp.PEAK_ECCENTRIC_FORCE_Trial_N,
          concentricPeakForce: valdData.forceDecks.plyoPushUp.PEAK_CONCENTRIC_FORCE_Trial_N,
          concentricRFD_L: valdData.forceDecks.plyoPushUp.CONCENTRIC_RFD_Left_N_per_s,
          concentricRFD_R: valdData.forceDecks.plyoPushUp.CONCENTRIC_RFD_Right_N_per_s,
          eccentricBrakingRFD: valdData.forceDecks.plyoPushUp.ECCENTRIC_BRAKING_RFD_Trial_N_per_s,
          weight: valdData.forceDecks.plyoPushUp.weight || valdData.forceDecks.plyoPushUp.bodyWeight
        } : null,
        singleLegCMJ_Left: valdData.forceDecks?.singleLegCMJ_Left ? {
          jumpHeight: cmToInches(valdData.forceDecks.singleLegCMJ_Left.JUMP_HEIGHT_IMP_MOM_Trial_cm || valdData.forceDecks.singleLegCMJ_Left.JUMP_HEIGHT_Trial_cm),
          eccentricPeakForce: valdData.forceDecks.singleLegCMJ_Left.PEAK_ECCENTRIC_FORCE_Trial_N,
          eccentricBrakingRFD: valdData.forceDecks.singleLegCMJ_Left.ECCENTRIC_BRAKING_RFD_Trial_N_Per_s || valdData.forceDecks.singleLegCMJ_Left.ECCENTRIC_BRAKING_RFD_Trial_N_per_s,
          concentricPeakForce: valdData.forceDecks.singleLegCMJ_Left.PEAK_CONCENTRIC_FORCE_Trial_N || valdData.forceDecks.singleLegCMJ_Left.CONCENTRIC_PEAK_FORCE_Trial_N || valdData.forceDecks.singleLegCMJ_Left.PEAK_TAKEOFF_FORCE_Trial_N,
          eccentricPeakVelocity: valdData.forceDecks.singleLegCMJ_Left.ECCENTRIC_PEAK_VELOCITY_Trial_m_Per_s || valdData.forceDecks.singleLegCMJ_Left.ECCENTRIC_PEAK_VELOCITY_Trial_m_per_s,
          concentricPeakVelocity: valdData.forceDecks.singleLegCMJ_Left.PEAK_TAKEOFF_VELOCITY_Trial_m_Per_s || valdData.forceDecks.singleLegCMJ_Left.CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s || valdData.forceDecks.singleLegCMJ_Left.PEAK_TAKEOFF_VELOCITY_Trial_m_per_s,
          peakPowerBM: valdData.forceDecks.singleLegCMJ_Left.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_Per_kg || valdData.forceDecks.singleLegCMJ_Left.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg || valdData.forceDecks.singleLegCMJ_Left.BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg,
          // Try multiple field name variations for RSI
          rsi: valdData.forceDecks.singleLegCMJ_Left.FLIGHT_CONTRACTION_TIME_RATIO_Left_No_Unit ||
               valdData.forceDecks.singleLegCMJ_Left.FLIGHT_CONTRACTION_TIME_RATIO_Trial_No_Unit ||
               valdData.forceDecks.singleLegCMJ_Left.FLIGHT_CONTRACTION_TIME_RATIO_Left_ ||
               valdData.forceDecks.singleLegCMJ_Left.FLIGHT_CONTRACTION_TIME_RATIO_Trial_ ||
               valdData.forceDecks.singleLegCMJ_Left.RSI_Left_ ||
               valdData.forceDecks.singleLegCMJ_Left.RSI_Trial_,
          peakPower: valdData.forceDecks.singleLegCMJ_Left.PEAK_TAKEOFF_POWER_Trial_W || valdData.forceDecks.singleLegCMJ_Left.PEAK_POWER_Trial_W
        } : null,
        singleLegCMJ_Right: valdData.forceDecks?.singleLegCMJ_Right ? {
          jumpHeight: cmToInches(valdData.forceDecks.singleLegCMJ_Right.JUMP_HEIGHT_IMP_MOM_Trial_cm || valdData.forceDecks.singleLegCMJ_Right.JUMP_HEIGHT_Trial_cm),
          eccentricPeakForce: valdData.forceDecks.singleLegCMJ_Right.PEAK_ECCENTRIC_FORCE_Trial_N,
          eccentricBrakingRFD: valdData.forceDecks.singleLegCMJ_Right.ECCENTRIC_BRAKING_RFD_Trial_N_Per_s || valdData.forceDecks.singleLegCMJ_Right.ECCENTRIC_BRAKING_RFD_Trial_N_per_s,
          concentricPeakForce: valdData.forceDecks.singleLegCMJ_Right.PEAK_CONCENTRIC_FORCE_Trial_N || valdData.forceDecks.singleLegCMJ_Right.CONCENTRIC_PEAK_FORCE_Trial_N || valdData.forceDecks.singleLegCMJ_Right.PEAK_TAKEOFF_FORCE_Trial_N,
          eccentricPeakVelocity: valdData.forceDecks.singleLegCMJ_Right.ECCENTRIC_PEAK_VELOCITY_Trial_m_Per_s || valdData.forceDecks.singleLegCMJ_Right.ECCENTRIC_PEAK_VELOCITY_Trial_m_per_s,
          concentricPeakVelocity: valdData.forceDecks.singleLegCMJ_Right.PEAK_TAKEOFF_VELOCITY_Trial_m_Per_s || valdData.forceDecks.singleLegCMJ_Right.CONCENTRIC_PEAK_VELOCITY_Trial_m_per_s || valdData.forceDecks.singleLegCMJ_Right.PEAK_TAKEOFF_VELOCITY_Trial_m_per_s,
          peakPowerBM: valdData.forceDecks.singleLegCMJ_Right.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_Per_kg || valdData.forceDecks.singleLegCMJ_Right.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg || valdData.forceDecks.singleLegCMJ_Right.BODYMASS_RELATIVE_PEAK_POWER_Trial_W_per_kg,
          // Try multiple field name variations for RSI
          rsi: valdData.forceDecks.singleLegCMJ_Right.FLIGHT_CONTRACTION_TIME_RATIO_Right_No_Unit ||
               valdData.forceDecks.singleLegCMJ_Right.FLIGHT_CONTRACTION_TIME_RATIO_Trial_No_Unit ||
               valdData.forceDecks.singleLegCMJ_Right.FLIGHT_CONTRACTION_TIME_RATIO_Right_ ||
               valdData.forceDecks.singleLegCMJ_Right.FLIGHT_CONTRACTION_TIME_RATIO_Trial_ ||
               valdData.forceDecks.singleLegCMJ_Right.RSI_Right_ ||
               valdData.forceDecks.singleLegCMJ_Right.RSI_Trial_,
          peakPower: valdData.forceDecks.singleLegCMJ_Right.PEAK_TAKEOFF_POWER_Trial_W || valdData.forceDecks.singleLegCMJ_Right.PEAK_POWER_Trial_W
        } : null
      },
      asymmetries: valdData.asymmetries || {},
      comparisons: comparisons,
      norms: {
        cmj: norms.cmj ? {
          sampleSize: norms.cmj.sampleSize,
          averageJumpHeight: norms.cmj.averages.jumpHeight,
          percentiles: norms.cmj.percentiles
        } : null,
        imtp: norms.imtp ? {
          sampleSize: norms.imtp.sampleSize,
          averagePeakForce: norms.imtp.averages.peakForce,
          percentiles: norms.imtp.percentiles
        } : null
      }
    };

    console.log('📋 reportData.slCmjRecommendations:', reportData.slCmjRecommendations);

    // Step 5: Generate PDF report
    console.log('5️⃣  Generating PDF report...');
    const timestamp = Date.now();
    const filename = `report_${athleteId}_${timestamp}.pdf`;
    const outputPath = path.join(__dirname, '../../reports', filename);

    // Ensure reports directory exists
    const fs = await import('fs');
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    await reportGeneratorService.generateReport(reportData, outputPath);

    console.log('✅ Report generated successfully!');

    const responseData = {
      success: true,
      message: 'Report generated successfully',
      filename: filename,
      downloadUrl: `/api/reports/download/${filename}`,
      data: {
        athlete: name, // Frontend expects 'athlete' property
        testDate: reportData.testDate,
        tests: reportData.tests,
        comparisons: reportData.comparisons,
        asymmetries: reportData.asymmetries,
        norms: reportData.norms,
        cmjComparison: reportData.cmjComparison, // Include CMJ comparative data
        sjComparison: reportData.sjComparison, // Include SJ comparative data
        imtpComparison: reportData.imtpComparison, // Include IMTP comparative data
        ppuComparison: reportData.ppuComparison, // Include PPU comparative data
        hopComparison: reportData.hopComparison, // Include Hop Test comparative data
        // Also include summary counts for convenience
        testCount: Object.keys(reportData.tests).filter(t => reportData.tests[t] !== null).length,
        comparisonCount: Object.keys(comparisons).length,
        hasAsymmetries: Object.keys(reportData.asymmetries).length > 0
      }
    };

    console.log('📤 Response structure:');
    console.log('   Has data.tests.cmj:', !!responseData.data.tests?.cmj);
    console.log('   Has data.cmjComparison:', !!responseData.data.cmjComparison);
    if (responseData.data.tests?.cmj) {
      console.log('   CMJ jumpHeight:', responseData.data.tests.cmj.jumpHeight);
      console.log('   CMJ eccentricBrakingRFD:', responseData.data.tests.cmj.eccentricBrakingRFD);
    }

    res.json(responseData);

  } catch (error) {
    console.error('❌ Error generating report:', error);
    res.status(500).json({
      error: 'Failed to generate report',
      message: error.message
    });
  }
});

/**
 * Download a generated report
 * GET /api/reports/download/:filename
 */
router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filepath = path.join(__dirname, '../../reports', filename);

  // Security check - ensure filename doesn't contain path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  res.download(filepath, (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      res.status(404).json({ error: 'File not found' });
    }
  });
});

/**
 * Get MLB norms summary
 * GET /api/reports/norms
 */
router.get('/norms', async (req, res) => {
  try {
    const { position } = req.query;

    const [cmjNorms, hopNorms, imtpNorms, ppuNorms] = await Promise.all([
      mlbNormsService.getCMJNorms(position),
      mlbNormsService.getHopRSINorms(position),
      mlbNormsService.getIMTPNorms(position),
      mlbNormsService.getPPUNorms(position)
    ]);

    res.json({
      position: position || 'All',
      norms: {
        cmj: cmjNorms,
        hopRSI: hopNorms,
        imtp: imtpNorms,
        ppu: ppuNorms
      }
    });

  } catch (error) {
    console.error('Error fetching norms:', error);
    res.status(500).json({
      error: 'Failed to fetch norms',
      message: error.message
    });
  }
});

/**
 * Test VALD API connection
 * GET /api/reports/test-vald
 */
router.get('/test-vald', async (req, res) => {
  try {
    const token = await valdApiService.authenticate();
    res.json({
      success: true,
      message: 'VALD API connection successful',
      tokenReceived: !!token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'VALD API connection failed',
      message: error.message
    });
  }
});

/**
 * Helper function to calculate percentile rank
 */
function calculatePercentileRank(value, percentiles) {
  if (!value || !percentiles) return null;

  if (value <= percentiles.p5) return 5;
  if (value <= percentiles.p25) return Math.round(5 + (value - percentiles.p5) / (percentiles.p25 - percentiles.p5) * 20);
  if (value <= percentiles.p50) return Math.round(25 + (value - percentiles.p25) / (percentiles.p50 - percentiles.p25) * 25);
  if (value <= percentiles.p75) return Math.round(50 + (value - percentiles.p50) / (percentiles.p75 - percentiles.p50) * 25);
  if (value <= percentiles.p95) return Math.round(75 + (value - percentiles.p75) / (percentiles.p95 - percentiles.p75) * 20);
  return 95;
}

/**
 * Generate PDF with custom recommendations
 * POST /api/reports/generate-pdf
 */
router.post('/generate-pdf', async (req, res) => {
  try {
    const reportData = req.body;

    // Add custom recommendations to report data
    if (reportData.recommendations && Array.isArray(reportData.recommendations)) {
      reportData.customRecommendations = reportData.recommendations;
    }

    // Generate unique filename
    const timestamp = Date.now();
    const athleteName = reportData.athlete || reportData.name || 'athlete';
    const filename = `${athleteName.replace(/\s+/g, '_')}_report_${timestamp}.pdf`;
    const outputPath = path.join(__dirname, '../../reports', filename);

    // Ensure reports directory exists
    const fs = await import('fs');
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate PDF using Puppeteer (renders web UI as PDF)
    await generatePdfFromHtml(reportData, outputPath);

    // Send file as response
    res.download(outputPath, filename, (err) => {
      if (err) {
        console.error('Error sending PDF:', err);
        res.status(500).json({ error: 'Failed to send PDF' });
      }
      // Optionally delete the file after sending
      // fs.unlinkSync(outputPath);
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      error: 'Failed to generate PDF',
      message: error.message
    });
  }
});

/**
 * Generate CMJ Comparative PDF for an athlete from VALD data
 * POST /api/reports/generate-cmj-pdf
 * Body: { athleteId: string, name?: string }
 */
router.post('/generate-cmj-pdf', async (req, res) => {
  try {
    const { athleteId, name } = req.body;

    if (!athleteId) {
      return res.status(400).json({
        error: 'Missing required field: athleteId'
      });
    }

    console.log(`\n📊 Generating CMJ Comparative PDF for athlete ID: ${athleteId}`);

    // Step 1: Fetch athlete data from VALD
    console.log('1️⃣  Fetching athlete data from VALD...');
    const valdData = await valdApiService.getAthleteTestData(athleteId);

    if (!valdData || !valdData.profile) {
      return res.status(404).json({
        error: 'No athlete profile found'
      });
    }

    // Step 2: Get latest CMJ test
    console.log('2️⃣  Fetching CMJ test data...');
    const cmjTest = valdData.forceDecks?.cmj;

    if (!cmjTest) {
      return res.status(404).json({
        error: 'No CMJ test data found for this athlete',
        message: 'Athlete must have completed a CMJ test to generate this report'
      });
    }

    console.log('✅ Found CMJ test from', cmjTest.testDate);

    // Step 3: Map VALD CMJ fields to our 13 metrics
    console.log('3️⃣  Mapping CMJ metrics...');
    const cmjMetrics = {
      jumpHeight: cmjTest.JUMP_HEIGHT_Trial_cm || cmjTest.JUMP_HEIGHT_IMP_MOM_Trial_cm,
      eccentricBrakingRFD: cmjTest.ECCENTRIC_BRAKING_RFD_Trial_N_per_s,
      forceAtZeroVelocity: cmjTest.FORCE_AT_ZERO_VELOCITY_Trial_N,
      eccentricPeakForce: cmjTest.PEAK_ECCENTRIC_FORCE_Trial_N,
      concentricImpulse: cmjTest.CONCENTRIC_IMPULSE_Trial_Ns,
      eccentricPeakVelocity: cmjTest.ECCENTRIC_PEAK_VELOCITY_Trial_m_per_s,
      concentricPeakVelocity: cmjTest.PEAK_TAKEOFF_VELOCITY_Trial_m_per_s,
      eccentricPeakPower: cmjTest.ECCENTRIC_PEAK_POWER_Trial_W,
      eccentricPeakPowerBM: cmjTest.BODYMASS_RELATIVE_ECCENTRIC_PEAK_POWER_Trial_W_per_kg,
      peakPower: cmjTest.PEAK_TAKEOFF_POWER_Trial_W,
      peakPowerBM: cmjTest.BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg,
      rsi: cmjTest.FLIGHT_CONTRACTION_TIME_RATIO_Trial_,  // Standard RSI (changed from RSI-modified)
      countermovementDepth: cmjTest.COUNTERMOVEMENT_DEPTH_Trial_cm
    };

    console.log('Mapped metrics:', Object.keys(cmjMetrics).filter(k => cmjMetrics[k] !== null && cmjMetrics[k] !== undefined).length, 'of 13');

    // Step 4: Run comparative analysis
    console.log('4️⃣  Running comparative analysis vs 898 pro athletes...');
    const comparisonData = await getComparativeAnalysis(cmjMetrics);

    console.log(`✅ Comparison complete - ${comparisonData.totalProTests} professional tests analyzed`);

    // Step 5: Prepare report data for PDF
    console.log('5️⃣  Preparing PDF report data...');
    const athleteName = name || valdData.profile.fullName ||
                       `${valdData.profile.givenName || ''} ${valdData.profile.familyName || ''}`.trim() ||
                       'Unknown Athlete';

    const reportData = {
      athleteName: athleteName,
      age: valdData.profile.age || null,
      sport: valdData.profile.sport || 'Baseball',
      position: valdData.profile.position || 'N/A',
      schoolTeam: valdData.profile.organization || valdData.profile.team || 'N/A',
      assessmentDate: cmjTest.testDate || new Date().toISOString().split('T')[0],
      height: valdData.profile.height || null,
      bodyMass: valdData.profile.weight || valdData.profile.bodyMass || null,
      cmjMetrics: cmjMetrics
    };

    // Step 6: Generate PDF
    console.log('6️⃣  Generating PDF...');
    const pdfBuffer = await generatePDF(reportData);

    console.log('✅ PDF generated successfully!\n');

    // Step 7: Send PDF to client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${athleteName.replace(/\s+/g, '_')}_CMJ_Report_${Date.now()}.pdf"`
    );
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error generating CMJ PDF:', error);
    res.status(500).json({
      error: 'Failed to generate CMJ PDF',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Helper function to fetch specific tests selected by the user
 * @param {array|string} profileIds - Array of profile IDs or single athleteId
 * @param {object} selectedTests - Object with test type keys and test ID values
 * @returns {object} Test data in the same format as getAthleteTestData()
 */
async function fetchSelectedTests(profileIds, selectedTests) {
  try {
    // Ensure profileIds is an array
    const idsArray = Array.isArray(profileIds) ? profileIds : [profileIds];
    const primaryId = idsArray[0];

    console.log(`📋 Fetching tests for profile IDs:`, idsArray);

    // Get athlete profile using primary ID
    const profile = await valdApiService.getAthleteProfile(primaryId);

    // Get ALL tests for this athlete from all profile IDs
    const allTests = await valdApiService.getForceDecksTests(idsArray);

    console.log(`📋 Fetching selected tests from ${allTests.data?.length || 0} total tests`);

    // Create a map of all tests by their ID
    const testsById = new Map();
    if (allTests && allTests.data) {
      allTests.data.forEach((test, index) => {
        const testId = test.id || test.testId || `${test.testType}-${test.recordedDateUtc}-${index}`;
        testsById.set(testId, test);
      });
    }

    // Build the response structure matching getAthleteTestData format
    const valdData = {
      profile: profile,
      forceDecks: {
        cmj: null,
        squatJump: null,
        imtp: null,
        singleLegCMJ_Left: null,
        singleLegCMJ_Right: null,
        hopTest: null,
        plyoPushUp: null,
        dropJump: null
      },
      asymmetries: {}
    };

    // Map test type names from frontend to backend
    const testTypeMap = {
      cmj: 'cmj',
      squatJump: 'squatJump',
      imtp: 'imtp',
      singleLegCMJ: 'singleLegCMJ', // Will be remapped to Left/Right based on trial.limb
      singleLegCMJ_Left: 'singleLegCMJ_Left',
      singleLegCMJ_Right: 'singleLegCMJ_Right',
      hopTest: 'hopTest',
      plyoPushUp: 'plyoPushUp',
      dropJump: 'dropJump'
    };

    // Populate the selected tests
    for (const [testType, testId] of Object.entries(selectedTests)) {
      if (testsById.has(testId)) {
        const basicTest = testsById.get(testId);
        let mappedType = testTypeMap[testType];

        // Special handling for SLJ tests - trials contain BOTH legs in the same test
        if (testType === 'singleLegCMJ' && (basicTest.testType === 'SLJ' || basicTest.testType === 'Single Leg Jump')) {
          console.log(`   🦵 SLJ test detected - extracting both legs from trials`);

          const axios = (await import('axios')).default;

          try {
            const token = await valdApiService.getAccessToken();
            const config = basicTest.apiSource === 'Secondary' ? valdApiService.config2 : valdApiService.config;

            // Fetch trials for this test
            const response = await axios.get(`${config.forceDecksUrl}/v2019q3/teams/${config.tenantId}/tests/${testId}/trials`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (response.data && response.data.length > 0) {
              console.log(`   📊 Found ${response.data.length} trials in SLJ test`);

              // Group trials by limb
              const leftTrials = response.data.filter(t => t.limb === 'Left');
              const rightTrials = response.data.filter(t => t.limb === 'Right');

              console.log(`   🦵 Left leg trials: ${leftTrials.length}, Right leg trials: ${rightTrials.length}`);

              // Helper function to extract metrics from trials for a specific limb
              const extractMetricsFromTrials = (trials, limbName) => {
                if (!trials || trials.length === 0) return null;

                const metrics = { ...basicTest, limb: limbName };

                // Use the best trial (first one after sorting by jump height or just first)
                const trial = trials[0];

                if (trial.results && Array.isArray(trial.results)) {
                  for (const result of trial.results) {
                    if (!result.definition || !result.definition.result) continue;

                    const resultName = result.definition.result;
                    const resultLimb = result.limb || 'Trial';
                    const unit = result.definition.unit || '';

                    // Build field name in BigQuery format
                    let fieldName = `${resultName}_${resultLimb}`;
                    if (unit) {
                      // Normalize unit - replace spaces with underscores first, then abbreviate
                      const normalizedUnit = unit
                        .replace(/\s+/g, '_')
                        .replace(/Centimeter/g, 'cm')
                        .replace(/Millimeter/g, 'mm')
                        .replace(/Meter/g, 'm')
                        .replace(/Newton/g, 'N')
                        .replace(/Watt/g, 'W')
                        .replace(/Kilo/g, 'kg')
                        .replace(/Second/g, 's');
                      fieldName += `_${normalizedUnit}`;
                    }

                    metrics[fieldName] = result.value;
                  }

                  // Add BigQuery field name aliases
                  if (metrics['CONCENTRIC_IMPULSE_Trial_N_s']) {
                    metrics['CONCENTRIC_IMPULSE_Trial_Ns'] = metrics['CONCENTRIC_IMPULSE_Trial_N_s'];
                  }
                  if (metrics['RSI_MODIFIED_Trial_RSIModified']) {
                    metrics['RSI_MODIFIED_Trial_RSI_mod'] = metrics['RSI_MODIFIED_Trial_RSIModified'];
                  }
                }

                return metrics;
              };

              // Extract metrics for each leg
              if (leftTrials.length > 0) {
                valdData.forceDecks.singleLegCMJ_Left = extractMetricsFromTrials(leftTrials, 'Left');
                console.log(`   ✅ Extracted LEFT leg metrics`);
              }

              if (rightTrials.length > 0) {
                valdData.forceDecks.singleLegCMJ_Right = extractMetricsFromTrials(rightTrials, 'Right');
                console.log(`   ✅ Extracted RIGHT leg metrics`);
              }
            }
          } catch (error) {
            console.error(`   ❌ Error processing SLJ test ${testId}: ${error.message}`);
          }

          // Log summary of what was found
          console.log(`   📊 Single Leg CMJ Summary:`);
          console.log(`      Left: ${valdData.forceDecks.singleLegCMJ_Left ? '✅ Found' : '❌ Missing'}`);
          console.log(`      Right: ${valdData.forceDecks.singleLegCMJ_Right ? '✅ Found' : '❌ Missing'}`);

          // Add warning if only one leg found
          if (valdData.forceDecks.singleLegCMJ_Left && !valdData.forceDecks.singleLegCMJ_Right) {
            console.log(`   ⚠️ WARNING: Only LEFT leg found.`);
            valdData.slCmjWarning = 'Only left leg data found in this test.';
          } else if (!valdData.forceDecks.singleLegCMJ_Left && valdData.forceDecks.singleLegCMJ_Right) {
            console.log(`   ⚠️ WARNING: Only RIGHT leg found.`);
            valdData.slCmjWarning = 'Only right leg data found in this test.';
          } else if (!valdData.forceDecks.singleLegCMJ_Left && !valdData.forceDecks.singleLegCMJ_Right) {
            console.log(`   ❌ ERROR: No leg data found.`);
            valdData.slCmjWarning = 'Could not extract limb data from Single Leg CMJ test.';
          }

          // Skip normal processing for SLJ - we've handled both legs
          continue;
        }

        if (mappedType) {
          // Fetch detailed test data with all metrics
          console.log(`   🔍 Fetching detailed data for ${testType} test ID: ${testId}`);
          const detailedTest = await valdApiService.getTestDetails(basicTest);

          // Use detailed test if available, otherwise fall back to basic test
          valdData.forceDecks[mappedType] = detailedTest || basicTest;

          console.log(`   ✅ Found ${testType} test from ${basicTest.recordedDateUtc || basicTest.testDate}`);

          // Log if we got detailed metrics
          if (detailedTest) {
            const hasMetrics = Object.keys(detailedTest).some(k =>
              k.includes('JUMP') || k.includes('FORCE') || k.includes('POWER') || k.includes('RFD')
            );
            console.log(`   📊 Detailed metrics available: ${hasMetrics}`);
          }
        }
      } else {
        console.log(`   ⚠️  Could not find test ${testType} with ID ${testId}`);
      }
    }

    // Calculate asymmetries if we have bilateral tests
    if (valdData.forceDecks.cmj && valdData.forceDecks.cmj.leftPeakForce && valdData.forceDecks.cmj.rightPeakForce) {
      valdData.asymmetries.cmjPeakForce = valdApiService.calculateAsymmetry(
        valdData.forceDecks.cmj.leftPeakForce,
        valdData.forceDecks.cmj.rightPeakForce
      );
    }

    if (valdData.forceDecks.singleLegCMJ_Left && valdData.forceDecks.singleLegCMJ_Right) {
      valdData.asymmetries.singleLegJumpHeight = valdApiService.calculateAsymmetry(
        valdData.forceDecks.singleLegCMJ_Left.jumpHeight,
        valdData.forceDecks.singleLegCMJ_Right.jumpHeight
      );
    }

    return valdData;
  } catch (error) {
    console.error('❌ Error fetching selected tests:', error);
    throw error;
  }
}

export default router;
