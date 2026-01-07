import { query, dataset } from '../config/bigquery.js';

/**
 * Service for fetching and processing athlete performance data from BigQuery
 */

// Get athlete profile metadata
export async function getAthleteProfile(athleteId) {
  const sql = `
    SELECT *
    FROM \`vald-ref-data-copy.${dataset}.profile_metadata\`
    WHERE profile_id = @athleteId
    LIMIT 1
  `;

  const rows = await query(sql, [athleteId]);
  return rows[0] || null;
}

// Get athlete profiles by various filters
export async function searchAthletes(filters = {}) {
  let sql = `
    SELECT DISTINCT
      profile_id,
      full_name,
      given_name,
      family_name,
      date_of_birth,
      sex,
      group_name_1 as sport,
      group_name_2 as team
    FROM \`vald-ref-data-copy.${dataset}.profile_metadata\`
    WHERE 1=1
  `;

  if (filters.name) {
    sql += ` AND (LOWER(given_name) LIKE LOWER('%${filters.name}%') OR LOWER(family_name) LIKE LOWER('%${filters.name}%') OR LOWER(full_name) LIKE LOWER('%${filters.name}%'))`;
  }

  if (filters.sport) {
    sql += ` AND LOWER(group_name_1) LIKE LOWER('%${filters.sport}%')`;
  }

  if (filters.team) {
    sql += ` AND LOWER(group_name_2) LIKE LOWER('%${filters.team}%')`;
  }

  sql += ` ORDER BY family_name, given_name LIMIT 100`;

  return await query(sql);
}

// Get CMJ (Counter Movement Jump) results for an athlete
export async function getCMJResults(profileId) {
  const sql = `
    SELECT *
    FROM \`vald-ref-data-copy.${dataset}.cmj_results\`
    WHERE profile_id = @profileId
    ORDER BY test_date DESC
  `;

  return await query(sql, [profileId]);
}

// Get sprint results for an athlete
export async function getSprintResults(profileId) {
  const sql = `
    SELECT *
    FROM \`vald-ref-data-copy.${dataset}.10yd_sprint_results\`
    WHERE profile_id = @profileId
    ORDER BY test_date DESC
  `;

  return await query(sql, [profileId]);
}

// Get horizontal jump results
export async function getHJResults(profileId) {
  const sql = `
    SELECT *
    FROM \`vald-ref-data-copy.${dataset}.HJ_result_updated\`
    WHERE profile_id = @profileId
    ORDER BY test_date DESC
  `;

  return await query(sql, [profileId]);
}

// Get hand grip strength results
export async function getHandGripResults(profileId) {
  const sql = `
    SELECT *
    FROM \`vald-ref-data-copy.${dataset}.hand_grip_results\`
    WHERE profile_id = @profileId
    ORDER BY test_date DESC
  `;

  return await query(sql, [profileId]);
}

// Get IMTP (Isometric Mid-Thigh Pull) results
export async function getIMTPResults(profileId) {
  const sql = `
    SELECT *
    FROM \`vald-ref-data-copy.${dataset}.imtp_results\`
    WHERE profile_id = @profileId
    ORDER BY test_date DESC
  `;

  return await query(sql, [profileId]);
}

// Get push-up results
export async function getPushUpResults(profileId) {
  const sql = `
    SELECT *
    FROM \`vald-ref-data-copy.${dataset}.ppu_results\`
    WHERE profile_id = @profileId
    ORDER BY test_date DESC
  `;

  return await query(sql, [profileId]);
}

// Get shoulder external rotation results
export async function getShoulderERResults(profileId) {
  const sql = `
    SELECT *
    FROM \`vald-ref-data-copy.${dataset}.shoulder_er_results\`
    WHERE profile_id = @profileId
    ORDER BY test_date DESC
  `;

  return await query(sql, [profileId]);
}

// Get shoulder internal rotation results
export async function getShoulderIRResults(profileId) {
  const sql = `
    SELECT *
    FROM \`vald-ref-data-copy.${dataset}.shoulder_ir_results\`
    WHERE profile_id = @profileId
    ORDER BY test_date DESC
  `;

  return await query(sql, [profileId]);
}

// Get all performance data for an athlete
export async function getAllAthleteData(profileId) {
  const [
    profile,
    cmj,
    sprint,
    hj,
    handGrip,
    imtp,
    pushUp,
    shoulderER,
    shoulderIR
  ] = await Promise.all([
    getAthleteProfile(profileId),
    getCMJResults(profileId),
    getSprintResults(profileId),
    getHJResults(profileId),
    getHandGripResults(profileId),
    getIMTPResults(profileId),
    getPushUpResults(profileId),
    getShoulderERResults(profileId),
    getShoulderIRResults(profileId)
  ]);

  return {
    profile,
    performance: {
      cmj,
      sprint,
      horizontalJump: hj,
      handGrip,
      imtp,
      pushUp,
      shoulderER,
      shoulderIR
    }
  };
}

// Calculate percentiles for a metric
export async function getPercentileRank(tableName, metricColumn, value, filters = {}) {
  let sql = `
    SELECT
      PERCENTILE_CONT(${value}, 0.5) OVER() AS percentile_rank,
      COUNT(*) as total_count,
      AVG(${metricColumn}) as average,
      MIN(${metricColumn}) as min_value,
      MAX(${metricColumn}) as max_value
    FROM \`vald-ref-data-copy.${dataset}.${tableName}\`
    WHERE ${metricColumn} IS NOT NULL
  `;

  const params = [];

  if (filters.gender) {
    sql += ` AND gender = @gender`;
    params.push({ name: 'gender', value: filters.gender });
  }

  if (filters.ageMin && filters.ageMax) {
    sql += ` AND age BETWEEN @ageMin AND @ageMax`;
    params.push({ name: 'ageMin', value: filters.ageMin });
    params.push({ name: 'ageMax', value: filters.ageMax });
  }

  if (filters.sport) {
    sql += ` AND sport = @sport`;
    params.push({ name: 'sport', value: filters.sport });
  }

  const rows = await query(sql, params);
  return rows[0];
}

// Get comparative statistics for reporting
export async function getComparativeStats(profileId, testType) {
  const profile = await getAthleteProfile(profileId);

  if (!profile) {
    throw new Error('Athlete profile not found');
  }

  // Map test types to table names
  const tableMap = {
    'cmj': 'cmj_results',
    'sprint': '10yd_sprint_results',
    'hj': 'HJ_result_updated',
    'handgrip': 'hand_grip_results',
    'imtp': 'imtp_results',
    'pushup': 'ppu_results',
    'shoulder_er': 'shoulder_er_results',
    'shoulder_ir': 'shoulder_ir_results'
  };

  const tableName = tableMap[testType.toLowerCase()];

  if (!tableName) {
    throw new Error('Invalid test type');
  }

  // Get athlete's latest test results
  const sql = `
    SELECT *
    FROM \`vald-ref-data-copy.${dataset}.${tableName}\`
    WHERE profile_id = @profileId
    ORDER BY test_date DESC
    LIMIT 1
  `;

  const [latestResult] = await query(sql, [profileId]);

  if (!latestResult) {
    return null;
  }

  // Get comparative statistics
  const compareSql = `
    WITH athlete_age AS (
      SELECT
        DATE_DIFF(CURRENT_DATE(), DATE(date_of_birth), YEAR) as age
      FROM \`vald-ref-data-copy.${dataset}.profile_metadata\`
      WHERE profile_id = @profileId
    ),
    comparison_group AS (
      SELECT
        t.*,
        p.gender,
        p.sport,
        DATE_DIFF(CURRENT_DATE(), DATE(p.date_of_birth), YEAR) as age
      FROM \`vald-ref-data-copy.${dataset}.${tableName}\` t
      JOIN \`vald-ref-data-copy.${dataset}.profile_metadata\` p
        ON t.profile_id = p.profile_id
      WHERE p.gender = (
        SELECT gender FROM \`vald-ref-data-copy.${dataset}.profile_metadata\`
        WHERE profile_id = @profileId
      )
    )
    SELECT
      AVG(jump_height_cm) as avg_jump_height,
      STDDEV(jump_height_cm) as stddev_jump_height,
      PERCENTILE_CONT(jump_height_cm, 0.25) OVER() as percentile_25,
      PERCENTILE_CONT(jump_height_cm, 0.50) OVER() as percentile_50,
      PERCENTILE_CONT(jump_height_cm, 0.75) OVER() as percentile_75,
      COUNT(*) as sample_size
    FROM comparison_group
  `;

  const [stats] = await query(compareSql, [profileId]);

  return {
    athlete: profile,
    latestTest: latestResult,
    comparativeStats: stats
  };
}

export default {
  getAthleteProfile,
  searchAthletes,
  getCMJResults,
  getSprintResults,
  getHJResults,
  getHandGripResults,
  getIMTPResults,
  getPushUpResults,
  getShoulderERResults,
  getShoulderIRResults,
  getAllAthleteData,
  getPercentileRank,
  getComparativeStats
};