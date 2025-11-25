import express from 'express';
import athleteService from '../services/athletePerformanceService.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Search athletes
router.get('/search', verifyToken, async (req, res) => {
  try {
    const { name, sport, club } = req.query;
    const athletes = await athleteService.searchAthletes({ name, sport, club });
    res.json(athletes);
  } catch (error) {
    console.error('Error searching athletes:', error);
    res.status(500).json({ error: 'Failed to search athletes' });
  }
});

// Get athlete profile
router.get('/profile/:profileId', verifyToken, async (req, res) => {
  try {
    const profile = await athleteService.getAthleteProfile(req.params.profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Athlete not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Error fetching athlete profile:', error);
    res.status(500).json({ error: 'Failed to fetch athlete profile' });
  }
});

// Get all athlete data
router.get('/athlete/:profileId/all', verifyToken, async (req, res) => {
  try {
    const data = await athleteService.getAllAthleteData(req.params.profileId);
    if (!data.profile) {
      return res.status(404).json({ error: 'Athlete not found' });
    }
    res.json(data);
  } catch (error) {
    console.error('Error fetching athlete data:', error);
    res.status(500).json({ error: 'Failed to fetch athlete data' });
  }
});

// Get specific test results
router.get('/athlete/:profileId/cmj', verifyToken, async (req, res) => {
  try {
    const results = await athleteService.getCMJResults(req.params.profileId);
    res.json(results);
  } catch (error) {
    console.error('Error fetching CMJ results:', error);
    res.status(500).json({ error: 'Failed to fetch CMJ results' });
  }
});

router.get('/athlete/:profileId/sprint', verifyToken, async (req, res) => {
  try {
    const results = await athleteService.getSprintResults(req.params.profileId);
    res.json(results);
  } catch (error) {
    console.error('Error fetching sprint results:', error);
    res.status(500).json({ error: 'Failed to fetch sprint results' });
  }
});

router.get('/athlete/:profileId/hj', verifyToken, async (req, res) => {
  try {
    const results = await athleteService.getHJResults(req.params.profileId);
    res.json(results);
  } catch (error) {
    console.error('Error fetching HJ results:', error);
    res.status(500).json({ error: 'Failed to fetch HJ results' });
  }
});

router.get('/athlete/:profileId/handgrip', verifyToken, async (req, res) => {
  try {
    const results = await athleteService.getHandGripResults(req.params.profileId);
    res.json(results);
  } catch (error) {
    console.error('Error fetching hand grip results:', error);
    res.status(500).json({ error: 'Failed to fetch hand grip results' });
  }
});

router.get('/athlete/:profileId/imtp', verifyToken, async (req, res) => {
  try {
    const results = await athleteService.getIMTPResults(req.params.profileId);
    res.json(results);
  } catch (error) {
    console.error('Error fetching IMTP results:', error);
    res.status(500).json({ error: 'Failed to fetch IMTP results' });
  }
});

router.get('/athlete/:profileId/pushup', verifyToken, async (req, res) => {
  try {
    const results = await athleteService.getPushUpResults(req.params.profileId);
    res.json(results);
  } catch (error) {
    console.error('Error fetching push-up results:', error);
    res.status(500).json({ error: 'Failed to fetch push-up results' });
  }
});

router.get('/athlete/:profileId/shoulder-er', verifyToken, async (req, res) => {
  try {
    const results = await athleteService.getShoulderERResults(req.params.profileId);
    res.json(results);
  } catch (error) {
    console.error('Error fetching shoulder ER results:', error);
    res.status(500).json({ error: 'Failed to fetch shoulder ER results' });
  }
});

router.get('/athlete/:profileId/shoulder-ir', verifyToken, async (req, res) => {
  try {
    const results = await athleteService.getShoulderIRResults(req.params.profileId);
    res.json(results);
  } catch (error) {
    console.error('Error fetching shoulder IR results:', error);
    res.status(500).json({ error: 'Failed to fetch shoulder IR results' });
  }
});

// Get comparative statistics for reporting
router.get('/athlete/:profileId/compare/:testType', verifyToken, async (req, res) => {
  try {
    const { profileId, testType } = req.params;
    const stats = await athleteService.getComparativeStats(profileId, testType);

    if (!stats) {
      return res.status(404).json({ error: 'No test data found for this athlete' });
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching comparative stats:', error);
    res.status(500).json({ error: 'Failed to fetch comparative statistics' });
  }
});

// Generate performance report
router.post('/athlete/:profileId/report', verifyToken, async (req, res) => {
  try {
    const { profileId } = req.params;
    const { testTypes = ['cmj', 'sprint', 'hj'] } = req.body;

    // Get all athlete data
    const athleteData = await athleteService.getAllAthleteData(profileId);

    if (!athleteData.profile) {
      return res.status(404).json({ error: 'Athlete not found' });
    }

    // Get comparative stats for each test type
    const comparisons = {};
    for (const testType of testTypes) {
      try {
        comparisons[testType] = await athleteService.getComparativeStats(profileId, testType);
      } catch (error) {
        console.log(`No data for ${testType}`);
      }
    }

    const reportData = {
      athlete: athleteData.profile,
      performance: athleteData.performance,
      comparisons,
      generatedAt: new Date().toISOString()
    };

    res.json(reportData);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;