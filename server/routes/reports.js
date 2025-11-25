import express from 'express';
import pool from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/reports
 * Create or update an assessment report
 */
router.post('/', verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      athleteId,
      athleteName,
      age,
      sport,
      position,
      schoolTeam,
      assessmentDate,
      height,
      bodyMass,
      currentInjuries,
      injuryHistory,
      posturePresentation,
      movementAnalysisSummary,
      trainingGoals,
      actionPlan,
      testResults,
    } = req.body;

    await client.query('BEGIN');

    // Check if report already exists for this athlete
    const existingReport = await client.query(
      'SELECT id FROM assessment_reports WHERE athlete_id = $1',
      [athleteId]
    );

    let reportId;

    if (existingReport.rows.length > 0) {
      // Update existing report
      reportId = existingReport.rows[0].id;

      await client.query(
        `UPDATE assessment_reports SET
          athlete_name = $1,
          age = $2,
          sport = $3,
          position = $4,
          school_team = $5,
          assessment_date = $6,
          height = $7,
          body_mass = $8,
          current_injuries = $9,
          injury_history = $10,
          posture_presentation = $11,
          movement_analysis_summary = $12,
          training_goals = $13,
          action_plan = $14,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $15`,
        [
          athleteName,
          age,
          sport,
          position,
          schoolTeam,
          assessmentDate,
          height,
          bodyMass,
          currentInjuries,
          injuryHistory,
          posturePresentation,
          movementAnalysisSummary,
          trainingGoals,
          actionPlan,
          reportId,
        ]
      );

      // Delete existing test results
      await client.query('DELETE FROM test_results WHERE report_id = $1', [reportId]);
    } else {
      // Insert new report
      const insertResult = await client.query(
        `INSERT INTO assessment_reports (
          athlete_id,
          athlete_name,
          age,
          sport,
          position,
          school_team,
          assessment_date,
          height,
          body_mass,
          current_injuries,
          injury_history,
          posture_presentation,
          movement_analysis_summary,
          training_goals,
          action_plan
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id`,
        [
          athleteId,
          athleteName,
          age,
          sport,
          position,
          schoolTeam,
          assessmentDate,
          height,
          bodyMass,
          currentInjuries,
          injuryHistory,
          posturePresentation,
          movementAnalysisSummary,
          trainingGoals,
          actionPlan,
        ]
      );

      reportId = insertResult.rows[0].id;
    }

    // Insert test results with key takeaways
    if (testResults && testResults.length > 0) {
      for (const test of testResults) {
        await client.query(
          `INSERT INTO test_results (report_id, test_type, test_data, key_takeaways)
          VALUES ($1, $2, $3, $4)`,
          [reportId, test.testType, JSON.stringify(test.data), test.keyTakeaways]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: { reportId },
      message: 'Report saved successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving report:', error);
    res.status(500).json({ error: 'Failed to save report' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/reports/:athleteId
 * Get assessment report for an athlete
 */
router.get('/:athleteId', verifyToken, async (req, res) => {
  try {
    const { athleteId } = req.params;

    const reportResult = await pool.query(
      'SELECT * FROM assessment_reports WHERE athlete_id = $1',
      [athleteId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];

    const testResultsQuery = await pool.query(
      'SELECT test_type, test_data, key_takeaways FROM test_results WHERE report_id = $1',
      [report.id]
    );

    const testResults = testResultsQuery.rows.map(row => ({
      testType: row.test_type,
      data: row.test_data,
      keyTakeaways: row.key_takeaways,
    }));

    res.json({
      success: true,
      data: {
        ...report,
        testResults,
      },
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

/**
 * DELETE /api/reports/:athleteId
 * Delete assessment report for an athlete
 */
router.delete('/:athleteId', verifyToken, async (req, res) => {
  try {
    const { athleteId } = req.params;

    const result = await pool.query(
      'DELETE FROM assessment_reports WHERE athlete_id = $1 RETURNING id',
      [athleteId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

export default router;
