import express from 'express';
import { fetchProfessionalAthletes, fetchAthleteById, fetchAthleteTests } from '../services/valdService.js';
import { getAthletePercentile } from '../services/percentileService.js';
import { verifyToken } from '../middleware/auth.js';
import valdApiService from '../services/valdApiServiceInstance.js';
import { query, dataset } from '../config/bigquery.js';

const router = express.Router();

/**
 * GET /api/athletes/search
 * Search for athletes by name or ID
 * Query params: term (search term), mode (name or id)
 * NOTE: No authentication required for search
 */
router.get('/search', async (req, res) => {
  // Disable caching for search results
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  try {
    const { term, mode = 'name' } = req.query;

    // If no search term, return recent athletes
    if (!term || term.trim() === '') {
      console.log('📊 Fetching recent athletes');

      try {
        // Get some recent test data from VALD
        const recentTests = await valdApiService.getForceDecksTests(null);
        const uniqueProfiles = new Set();
        const recentAthletes = [];

        // Extract unique athletes from recent tests
        if (recentTests && recentTests.data) {
          for (const test of recentTests.data) {
            if (!uniqueProfiles.has(test.profileId) && recentAthletes.length < 10) {
              uniqueProfiles.add(test.profileId);
              recentAthletes.push({
                id: test.profileId,
                profileIds: [test.profileId], // Include profileIds array for consistency
                name: test.profileName || 'Unknown Athlete',
                position: test.position || 'N/A',
                team: test.organization || 'N/A'
              });
            }
          }
        }

        return res.json({
          success: true,
          count: recentAthletes.length,
          athletes: recentAthletes
        });
      } catch (error) {
        console.log('Could not fetch recent athletes from VALD');
        return res.json({
          success: true,
          count: 0,
          athletes: []
        });
      }
    }

    console.log(`🔍 Searching for athletes: ${term} (mode: ${mode})`);

    // Search athletes through VALD API
    const athletesResponse = await valdApiService.searchAthletes(term);

    // Handle the response based on VALD API structure
    let formattedAthletes = [];

    if (athletesResponse) {
      // Check if response is an array or has a data property
      const athletesList = Array.isArray(athletesResponse) ? athletesResponse :
                          (athletesResponse.data ? athletesResponse.data : [athletesResponse]);

      formattedAthletes = athletesList.map(athlete => ({
        id: athlete.id || athlete.profileId || athlete.profile_id,
        profileIds: athlete.profileIds || [athlete.id || athlete.profileId || athlete.profile_id], // Include profileIds array for multi-API athletes
        name: athlete.fullName || athlete.full_name || athlete.name ||
              `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim() || 'Unknown',
        position: athlete.position || athlete.sport || 'N/A',
        team: athlete.team || athlete.organization || athlete.club || 'N/A'
      }));
    }

    res.json({
      success: true,
      count: formattedAthletes.length,
      athletes: formattedAthletes
    });

  } catch (error) {
    console.error('❌ Error searching athletes:', error);
    res.status(500).json({
      error: 'Failed to search athletes',
      message: error.message,
      success: false,
      athletes: []
    });
  }
});

/**
 * GET /api/athletes
 * Get list of all professional athletes
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const athletes = await fetchProfessionalAthletes();
    res.json({ success: true, data: athletes });
  } catch (error) {
    console.error('Error fetching athletes:', error);
    res.status(500).json({ error: 'Failed to fetch athletes' });
  }
});

/**
 * GET /api/athletes/:id
 * Get athlete details by ID
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const athlete = await fetchAthleteById(id);
    res.json({ success: true, data: athlete });
  } catch (error) {
    console.error('Error fetching athlete:', error);
    res.status(404).json({ error: 'Athlete not found' });
  }
});

/**
 * GET /api/athletes/:id/tests/all
 * Get ALL tests for an athlete (grouped by type) - NO auth required for test selection
 * Supports profileIds query param for athletes with multiple profile IDs (comma-separated)
 */
router.get('/:id/tests/all', async (req, res) => {
  try {
    const { id } = req.params;
    const { profileIds } = req.query; // Get profileIds from query params

    // Parse profileIds if provided (comma-separated string to array)
    const idsToFetch = profileIds ? profileIds.split(',') : [id];

    console.log(`📊 Fetching ALL tests for athlete ID(s):`, idsToFetch);

    // Authenticate with VALD API
    await valdApiService.authenticate();

    // Get ALL tests for this athlete (not just latest) - pass array of IDs
    const allTests = await valdApiService.getForceDecksTests(idsToFetch);

    // Group tests by type
    const testsByType = {
      cmj: [],
      squatJump: [],
      imtp: [],
      singleLegCMJ: [],  // Combined left and right - will add limb info to each test
      hopTest: [],
      plyoPushUp: []
    };

    // Track generic SLJ tests that need trial data to determine left/right
    const genericSLJTests = [];
    const testTypeCounts = {};

    if (allTests && allTests.data) {
      allTests.data.forEach((test, index) => {
        // Track test type counts for debugging
        testTypeCounts[test.testType] = (testTypeCounts[test.testType] || 0) + 1;

        // Generate a unique ID for each test
        const testId = test.id || test.testId || `${test.testType}-${test.recordedDateUtc}-${index}`;
        const testWithId = { ...test, testId, id: testId };

        switch(test.testType) {
          case 'CMJ':
          case 'CMJ (Arms)':
          case 'Countermovement Jump':
            testsByType.cmj.push(testWithId);
            break;
          case 'SJ':
          case 'Squat Jump':
            testsByType.squatJump.push(testWithId);
            break;
          case 'IMTP':
          case 'Isometric Mid-Thigh Pull':
            testsByType.imtp.push(testWithId);
            break;
          case 'Single Leg CMJ - Left':
          case 'SL CMJ - Left':
          case 'SLJ - Left':
            testsByType.singleLegCMJ.push({ ...testWithId, limbsAvailable: 'Left' });
            break;
          case 'Single Leg CMJ - Right':
          case 'SL CMJ - Right':
          case 'SLJ - Right':
            testsByType.singleLegCMJ.push({ ...testWithId, limbsAvailable: 'Right' });
            break;
          case 'Single Leg Jump':
          case 'SLJ':
            // Generic SLJ - need to check trial data for left/right
            genericSLJTests.push(testWithId);
            break;
          case 'HJ':
          case 'Hop Test':
          case 'Single Leg Hop':
            testsByType.hopTest.push(testWithId);
            break;
          case 'Plyometric Push-Up':
          case 'PPU':
            testsByType.plyoPushUp.push(testWithId);
            break;
        }
      });

      // Log test type breakdown for debugging
      console.log(`📋 Test type breakdown from VALD:`, testTypeCounts);
      console.log(`📦 Collected into genericSLJTests:`, genericSLJTests.length);

      // Sort each test type by date (newest first)
      Object.keys(testsByType).forEach(testType => {
        testsByType[testType].sort((a, b) =>
          new Date(b.recordedDateUtc || b.testDate) - new Date(a.recordedDateUtc || a.testDate)
        );
      });

      // Process generic SLJ tests - fetch trial data to determine which limbs are present
      // Each SLJ test typically contains trials for BOTH legs in the same test
      console.log(`🔍 Processing ${genericSLJTests.length} generic Single Leg Jump tests...`);
      for (const test of genericSLJTests) {
        try {
          const testDetails = await valdApiService.getTestDetails(test);
          console.log(`  📝 Test ${test.testId.substring(0, 8)}... - testType: "${test.testType}"`);
          console.log(`     Trial data:`, testDetails?.trials ? `${testDetails.trials.length} trials` : 'null');

          if (testDetails && testDetails.trials && testDetails.trials.length > 0) {
            // Check ALL trials to find which limbs are present
            const limbsFound = new Set();
            testDetails.trials.forEach(trial => {
              if (trial.limb === 'Left' || trial.limb === 'Right') {
                limbsFound.add(trial.limb);
              }
            });

            console.log(`     Limbs found in trials:`, Array.from(limbsFound));

            // Build limbsAvailable string
            let limbsAvailable = 'Unknown';
            if (limbsFound.has('Left') && limbsFound.has('Right')) {
              limbsAvailable = 'Left & Right';
            } else if (limbsFound.has('Left')) {
              limbsAvailable = 'Left';
            } else if (limbsFound.has('Right')) {
              limbsAvailable = 'Right';
            }

            testsByType.singleLegCMJ.push({
              ...test,
              limbsAvailable,
              trials: testDetails.trials // Include trials for later processing
            });
            console.log(`  ✅ Added SLJ test with limbs: ${limbsAvailable}`);
          } else {
            // No trial data - add anyway so user can see it
            testsByType.singleLegCMJ.push({ ...test, limbsAvailable: 'Unknown' });
            console.log(`  ⚠️  Added SLJ test without trial data`);
          }
        } catch (error) {
          console.error(`  ❌ Error processing SLJ test ${test.testId}:`, error.message);
          // Still add the test so user can see it
          testsByType.singleLegCMJ.push({ ...test, limbsAvailable: 'Unknown' });
        }
      }
    }

    console.log(`✅ Found tests:`, Object.entries(testsByType).map(([type, tests]) => `${type}: ${tests.length}`).join(', '));

    res.json({
      success: true,
      tests: testsByType,
      totalTests: allTests?.data?.length || 0
    });

  } catch (error) {
    console.error('❌ Error fetching athlete tests:', error);
    res.status(500).json({
      error: 'Failed to fetch athlete tests',
      message: error.message
    });
  }
});

/**
 * GET /api/athletes/:id/tests
 * Get all force plate test results for an athlete with percentiles
 */
router.get('/:id/tests', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const tests = await fetchAthleteTests(id);

    // Add percentile calculations to each test metric
    const testsWithPercentiles = {};

    // CMJ
    if (tests.cmj) {
      testsWithPercentiles.cmj = {};
      for (const [metric, value] of Object.entries(tests.cmj)) {
        const percentileData = await getAthletePercentile('cmj', metric, value);
        testsWithPercentiles.cmj[metric] = {
          value,
          ...percentileData,
        };
      }
    }

    // SJ
    if (tests.sj) {
      testsWithPercentiles.sj = {};
      for (const [metric, value] of Object.entries(tests.sj)) {
        const percentileData = await getAthletePercentile('sj', metric, value);
        testsWithPercentiles.sj[metric] = {
          value,
          ...percentileData,
        };
      }
    }

    // HT
    if (tests.ht) {
      testsWithPercentiles.ht = {};
      for (const [metric, value] of Object.entries(tests.ht)) {
        const percentileData = await getAthletePercentile('ht', metric, value);
        testsWithPercentiles.ht[metric] = {
          value,
          ...percentileData,
        };
      }
    }

    // SL CMJ
    if (tests.slCmj) {
      testsWithPercentiles.slCmj = { left: {}, right: {} };

      for (const [metric, value] of Object.entries(tests.slCmj.left)) {
        const percentileData = await getAthletePercentile('slcmj', `left.${metric}`, value);
        testsWithPercentiles.slCmj.left[metric] = {
          value,
          ...percentileData,
        };
      }

      for (const [metric, value] of Object.entries(tests.slCmj.right)) {
        const percentileData = await getAthletePercentile('slcmj', `right.${metric}`, value);
        testsWithPercentiles.slCmj.right[metric] = {
          value,
          ...percentileData,
        };
      }
    }

    // IMTP
    if (tests.imtp) {
      testsWithPercentiles.imtp = {};
      for (const [metric, value] of Object.entries(tests.imtp)) {
        const percentileData = await getAthletePercentile('imtp', metric, value);
        testsWithPercentiles.imtp[metric] = {
          value,
          ...percentileData,
        };
      }
    }

    // PPU
    if (tests.ppu) {
      testsWithPercentiles.ppu = {};
      for (const [metric, value] of Object.entries(tests.ppu)) {
        const percentileData = await getAthletePercentile('ppu', metric, value);
        testsWithPercentiles.ppu[metric] = {
          value,
          ...percentileData,
        };
      }
    }

    res.json({ success: true, data: testsWithPercentiles });
  } catch (error) {
    console.error('Error fetching athlete tests:', error);
    res.status(500).json({ error: 'Failed to fetch athlete tests' });
  }
});

export default router;
