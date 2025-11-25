import express from 'express';
import {
  getProAthleteStats,
  getComparativeAnalysis,
  getPercentileLabel,
  getAthleteHistory
} from '../services/cmjComparativeService.js';

const router = express.Router();

/**
 * GET /api/cmj/pro-stats
 * Get professional athlete statistics for all CMJ metrics
 */
router.get('/pro-stats', async (req, res) => {
  try {
    console.log('📊 Request: Get pro athlete CMJ stats');

    const stats = await getProAthleteStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching pro stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cmj/compare
 * Compare athlete's CMJ metrics against pro athlete population
 * Body: { athleteMetrics: { jumpHeight: 45.2, eccentricBrakingRFD: 5234, ... } }
 */
router.post('/compare', async (req, res) => {
  try {
    const { athleteMetrics } = req.body;

    if (!athleteMetrics) {
      return res.status(400).json({
        success: false,
        error: 'athleteMetrics required in request body'
      });
    }

    console.log('📊 Request: Compare athlete CMJ metrics');

    const comparison = await getComparativeAnalysis(athleteMetrics);

    // Add labels to percentiles
    Object.keys(comparison.metrics).forEach(key => {
      const metric = comparison.metrics[key];
      metric.label = getPercentileLabel(metric.percentile);
    });

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error in comparative analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cmj/athlete/:profileId/history
 * Get CMJ test history for a specific athlete
 */
router.get('/athlete/:profileId/history', async (req, res) => {
  try {
    const { profileId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    console.log(`📊 Request: Get CMJ history for athlete ${profileId}`);

    const history = await getAthleteHistory(profileId, limit);

    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error fetching athlete history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
