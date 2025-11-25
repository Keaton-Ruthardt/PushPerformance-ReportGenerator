import express from 'express';
import { generatePDF } from '../services/pdfServiceWithComparative.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/pdf/generate
 * Generate PDF from report data with CMJ comparative analysis
 *
 * Request body:
 * {
 *   athleteName: string,
 *   age: number,
 *   sport: string,
 *   position: string,
 *   schoolTeam: string,
 *   assessmentDate: string,
 *   height: string,
 *   bodyMass: number,
 *   cmjMetrics: {
 *     jumpHeight: number,
 *     eccentricBrakingRFD: number,
 *     forceAtZeroVelocity: number,
 *     eccentricPeakForce: number,
 *     concentricImpulse: number,
 *     eccentricPeakVelocity: number,
 *     concentricPeakVelocity: number,
 *     eccentricPeakPower: number,
 *     eccentricPeakPowerBM: number,
 *     peakPower: number,
 *     peakPowerBM: number,
 *     rsiMod: number,
 *     countermovementDepth: number
 *   }
 * }
 */
router.post('/generate', async (req, res) => { // Auth temporarily disabled for testing
  try {
    const reportData = req.body;

    // DEBUG: Log what we're receiving
    console.log('=== PDF GENERATION DEBUG ===');
    console.log('Athlete Name:', reportData.athleteName);
    console.log('Has CMJ Metrics:', !!reportData.cmjMetrics);
    if (reportData.cmjMetrics) {
      console.log('CMJ Metrics Keys:', Object.keys(reportData.cmjMetrics));
    }
    console.log('============================');

    const pdfBuffer = await generatePDF(reportData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${reportData.athleteName || 'report'}_assessment.pdf"`
    );

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
  }
});

export default router;
