import express from 'express';
import valdApiService from '../services/valdApiServiceInstance.js';

const router = express.Router();

/**
 * Search for athletes
 * GET /api/athletes/search?term=searchTerm&mode=name|id
 */
router.get('/search', async (req, res) => {
  try {
    const { term, mode = 'name' } = req.query;

    if (!term) {
      return res.status(400).json({
        error: 'Search term is required'
      });
    }

    console.log(`🔍 Searching for athletes: ${term} (mode: ${mode})`);

    // Authenticate with VALD API
    await valdApiService.authenticate();

    // Search for athletes
    const athletes = await valdApiService.searchAthletes(term, mode);

    res.json({
      success: true,
      count: athletes.length,
      athletes: athletes
    });

  } catch (error) {
    console.error('❌ Error searching athletes:', error);
    res.status(500).json({
      error: 'Failed to search athletes',
      message: error.message
    });
  }
});

/**
 * Get ALL tests for an athlete (grouped by type)
 * GET /api/athletes/:id/tests/all
 */
router.get('/:id/tests/all', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📊 Fetching ALL tests for athlete ID: ${id}`);

    // Authenticate with VALD API
    await valdApiService.authenticate();

    // Get ALL tests for this athlete (not just latest)
    const allTests = await valdApiService.getForceDecksTests(id);

    // Group tests by type
    const testsByType = {
      cmj: [],
      squatJump: [],
      imtp: [],
      singleLegCMJ: [],  // Combined left and right - will add limb info to each test
      hopTest: [],
      plyoPushUp: [],
      dropJump: []
    };

    // Track generic SLJ tests that need trial data to determine left/right
    const genericSLJTests = [];

    if (allTests && allTests.data) {
      allTests.data.forEach((test, index) => {
        // Generate a unique ID for each test
        // Use VALD's test ID if available, otherwise create unique ID with index
        const testId = test.id || test.testId || `${test.testType}-${test.testDate}-${index}`;
        const testWithId = { ...test, testId, id: testId };

        // Debug log for SLJ tests
        if (test.testType === 'Single Leg Jump' || test.testType === 'SLJ') {
          console.log(`  SLJ Test: ID=${testId}, Date=${test.testDate}, OriginalID=${test.id || test.testId}`);
        }

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
            testsByType.singleLegCMJ.push({ ...testWithId, limb: 'Left' });
            break;
          case 'Single Leg CMJ - Right':
          case 'SL CMJ - Right':
          case 'SLJ - Right':
            testsByType.singleLegCMJ.push({ ...testWithId, limb: 'Right' });
            break;
          case 'Single Leg Jump':
          case 'SLJ':
            // For generic "Single Leg Jump" without left/right designation,
            // we need to check trial data to determine which leg
            genericSLJTests.push(testWithId);
            break;
          case 'Drop Jump':
          case 'DJ':
            testsByType.dropJump.push(testWithId);
            break;
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

      // Process generic SLJ tests - fetch trial data to determine left/right
      console.log(`🔍 Processing ${genericSLJTests.length} generic Single Leg Jump tests...`);
      for (const test of genericSLJTests) {
        try {
          const testDetails = await valdApiService.getTestDetails(test);
          let limb = null;

          // Check if we got test details with trials
          if (testDetails && testDetails.trials && testDetails.trials.length > 0) {
            const trial = testDetails.trials[0];
            limb = trial.limb;

            // Log trial data for debugging
            console.log(`  🔍 Trial data for ${test.testId}: limb=${trial.limb}, side=${trial.side}`);

            // Try multiple ways to detect limb
            if (!limb || (limb !== 'Left' && limb !== 'Right')) {
              // Check trial.side
              if (trial.side === 'Left' || trial.side === 'L') {
                limb = 'Left';
              } else if (trial.side === 'Right' || trial.side === 'R') {
                limb = 'Right';
              }
              // Check trial name
              else if (trial.name && trial.name.toLowerCase().includes('left')) {
                limb = 'Left';
              } else if (trial.name && trial.name.toLowerCase().includes('right')) {
                limb = 'Right';
              }
            }
          }

          // Fallback: detect from test type name if limb not in trial
          if (!limb || (limb !== 'Left' && limb !== 'Right')) {
            if (test.testType && test.testType.toLowerCase().includes('left')) {
              limb = 'Left';
            } else if (test.testType && test.testType.toLowerCase().includes('right')) {
              limb = 'Right';
            }
          }

          if (limb === 'Left' || limb === 'Right') {
            testsByType.singleLegCMJ.push({ ...test, limb });
            console.log(`  ✅ Categorized test ${test.testId} as ${limb}`);
          } else {
            // Still add it but without limb info - let user see it
            testsByType.singleLegCMJ.push({ ...test, limb: 'Unknown' });
            console.log(`  ⚠️  Could not determine limb for test ${test.testId} (limb: ${limb})`);
          }
        } catch (error) {
          console.error(`  ❌ Error processing SLJ test ${test.testId}:`, error.message);
          // Still add the test so user can see it
          testsByType.singleLegCMJ.push({ ...test, limb: 'Unknown' });
        }
      }

      // Sort each test type by date (newest first)
      Object.keys(testsByType).forEach(testType => {
        testsByType[testType].sort((a, b) =>
          new Date(b.testDate || b.recordedDateUtc) - new Date(a.testDate || a.recordedDateUtc)
        );
      });

      // Group Single Leg CMJ tests by session date (so user sees one option per session, not per leg)
      if (testsByType.singleLegCMJ.length > 0) {
        const sessionMap = {};
        testsByType.singleLegCMJ.forEach(test => {
          const dateStr = (test.testDate || test.recordedDateUtc || '').split('T')[0];
          if (!sessionMap[dateStr]) {
            sessionMap[dateStr] = {
              testId: test.testId, // Use first test's ID as the session ID
              testDate: test.testDate || test.recordedDateUtc,
              recordedDateUtc: test.recordedDateUtc,
              limbs: [],
              tests: []
            };
          }
          sessionMap[dateStr].limbs.push(test.limb);
          sessionMap[dateStr].tests.push(test);
        });

        // Convert to array with limb info
        testsByType.singleLegCMJ = Object.values(sessionMap).map(session => ({
          ...session,
          limbsAvailable: session.limbs.filter(l => l && l !== 'Unknown').join(' & ') || 'Unknown',
          testCount: session.tests.length
        }));

        console.log(`📊 Grouped SLJ into ${testsByType.singleLegCMJ.length} session(s)`);
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
 * Get athlete details by ID
 * GET /api/athletes/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📋 Fetching athlete details for ID: ${id}`);

    // Authenticate with VALD API
    await valdApiService.authenticate();

    // Get athlete details
    const athlete = await valdApiService.getAthleteById(id);

    if (!athlete) {
      return res.status(404).json({
        error: 'Athlete not found'
      });
    }

    res.json({
      success: true,
      athlete: athlete
    });

  } catch (error) {
    console.error('❌ Error fetching athlete:', error);
    res.status(500).json({
      error: 'Failed to fetch athlete details',
      message: error.message
    });
  }
});

/**
 * Get recent athletes (for quick access)
 * GET /api/athletes/recent
 */
router.get('/recent', async (req, res) => {
  try {
    console.log('📊 Fetching recent athletes');

    // Authenticate with VALD API
    await valdApiService.authenticate();

    // Get recent athletes (last 10)
    const athletes = await valdApiService.getRecentAthletes();

    res.json({
      success: true,
      count: athletes.length,
      athletes: athletes
    });

  } catch (error) {
    console.error('❌ Error fetching recent athletes:', error);
    res.status(500).json({
      error: 'Failed to fetch recent athletes',
      message: error.message
    });
  }
});

export default router;