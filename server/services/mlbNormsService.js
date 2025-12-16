import { BigQuery } from '@google-cloud/bigquery';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize BigQuery client with same logic as bigquery.js
let bigQueryConfig = {
  projectId: process.env.BIGQUERY_PROJECT_ID || 'vald-ref-data-copy'
};

if (process.env.BIGQUERY_CREDENTIALS_BASE64) {
  // Production: Decode base64-encoded credentials
  try {
    const decoded = Buffer.from(process.env.BIGQUERY_CREDENTIALS_BASE64, 'base64').toString('utf8');
    bigQueryConfig.credentials = JSON.parse(decoded);
    console.log('✅ MLB Norms: Using BigQuery credentials from BIGQUERY_CREDENTIALS_BASE64');
  } catch (error) {
    console.error('❌ MLB Norms: Failed to decode BIGQUERY_CREDENTIALS_BASE64:', error.message);
  }
} else if (process.env.BIGQUERY_CREDENTIALS) {
  // Production: Parse credentials from environment variable (JSON string)
  try {
    bigQueryConfig.credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS);
    console.log('✅ MLB Norms: Using BigQuery credentials from BIGQUERY_CREDENTIALS');
  } catch (error) {
    console.error('❌ MLB Norms: Failed to parse BIGQUERY_CREDENTIALS:', error.message);
  }
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // Production: Use credentials file path
  bigQueryConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  console.log('✅ MLB Norms: Using BigQuery credentials from file:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
} else {
  // Development: Use credentials file from BIGQUERY_KEYFILE or default
  bigQueryConfig.keyFilename = join(__dirname, '..', '..', process.env.BIGQUERY_KEYFILE || 'vald-ref-data-copy-0c0792ad4944.json');
  console.log('ℹ️  MLB Norms: Using BigQuery credentials from file (development mode)');
}

const bigquery = new BigQuery(bigQueryConfig);
const dataset = process.env.BIGQUERY_DATASET || 'VALDrefDataCOPY';

/**
 * MLB Norms Comparison Service
 * Provides percentile rankings and comparisons against professional baseball players
 */
class MLBNormsService {
  /**
   * Get MLB norms for CMJ test metrics
   */
  async getCMJNorms(position = null) {
    try {
      let query = `
        SELECT
          APPROX_QUANTILES(JUMP_HEIGHT_IMP_MOM_Trial_cm, 100) as percentiles_height,
          APPROX_QUANTILES(PEAK_TAKEOFF_POWER_Trial_W, 100) as percentiles_power,
          APPROX_QUANTILES(BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg, 100) as percentiles_power_bm,
          APPROX_QUANTILES(RSI_MODIFIED_IMP_MOM_Trial_RSI_mod, 100) as percentiles_rsi,
          AVG(JUMP_HEIGHT_IMP_MOM_Trial_cm) as avg_height,
          AVG(PEAK_TAKEOFF_POWER_Trial_W) as avg_power,
          AVG(BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg) as avg_power_bm,
          AVG(RSI_MODIFIED_IMP_MOM_Trial_RSI_mod) as avg_rsi,
          COUNT(*) as sample_size
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.cmj_results\`
        WHERE JUMP_HEIGHT_IMP_MOM_Trial_cm IS NOT NULL
          AND JUMP_HEIGHT_IMP_MOM_Trial_cm > 0
          AND JUMP_HEIGHT_IMP_MOM_Trial_cm < 100
          AND (UPPER(group_name_1) LIKE '%MLB%' OR UPPER(group_name_1) LIKE '%MILB%' OR UPPER(group_name_1) LIKE '%PRO%')
      `;

      if (position) {
        query += ` AND LOWER(group_name_2) LIKE LOWER('%${position}%')`;
      }

      const [rows] = await bigquery.query(query);

      if (rows.length > 0) {
        const result = rows[0];
        return {
          percentiles: {
            jumpHeight: this.extractPercentileValues(result.percentiles_height),
            peakPower: this.extractPercentileValues(result.percentiles_power),
            peakPowerBM: this.extractPercentileValues(result.percentiles_power_bm),
            rsiModified: this.extractPercentileValues(result.percentiles_rsi)
          },
          averages: {
            jumpHeight: result.avg_height,
            peakPower: result.avg_power,
            peakPowerBM: result.avg_power_bm,
            rsiModified: result.avg_rsi
          },
          sampleSize: result.sample_size
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching CMJ norms:', error);
      throw error;
    }
  }

  /**
   * Get MLB norms for Hop RSI test (from hj_results table)
   */
  async getHopRSINorms(position = null) {
    try {
      let query = `
        SELECT
          APPROX_QUANTILES(hop_rsi_avg_best_5, 100) as percentiles_rsi,
          AVG(hop_rsi_avg_best_5) as avg_rsi,
          MIN(hop_rsi_avg_best_5) as min_rsi,
          MAX(hop_rsi_avg_best_5) as max_rsi,
          COUNT(*) as sample_size
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.hj_results\`
        WHERE hop_rsi_avg_best_5 IS NOT NULL
          AND hop_rsi_avg_best_5 > 0
          AND (UPPER(group_name_1) LIKE '%MLB%' OR UPPER(group_name_1) LIKE '%MILB%' OR UPPER(group_name_1) LIKE '%PRO%')
      `;

      if (position) {
        query += ` AND LOWER(group_name_2) LIKE LOWER('%${position}%')`;
      }

      const [rows] = await bigquery.query(query);

      if (rows.length > 0) {
        const result = rows[0];
        return {
          percentiles: {
            hopRSI: this.extractPercentileValues(result.percentiles_rsi)
          },
          averages: {
            hopRSI: result.avg_rsi
          },
          min: result.min_rsi,
          max: result.max_rsi,
          sampleSize: result.sample_size
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching HJ norms:', error);
      throw error;
    }
  }

  /**
   * Get MLB norms for Plyometric Push-Up test
   */
  async getPPUNorms(position = null) {
    try {
      let query = `
        SELECT
          APPROX_QUANTILES(PUSHUP_HEIGHT_Trial_cm, 100) as percentiles_height,
          APPROX_QUANTILES(RELATIVE_PEAK_TAKEOFF_FORCE_Trial_N_per_kg, 100) as percentiles_force,
          APPROX_QUANTILES(PUSHUP_DEPTH_Trial_cm, 100) as percentiles_depth,
          AVG(PUSHUP_HEIGHT_Trial_cm) as avg_height,
          AVG(RELATIVE_PEAK_TAKEOFF_FORCE_Trial_N_per_kg) as avg_force,
          AVG(PUSHUP_DEPTH_Trial_cm) as avg_depth,
          COUNT(*) as sample_size
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.ppu_results\`
        WHERE PUSHUP_HEIGHT_Trial_cm IS NOT NULL
          AND PUSHUP_HEIGHT_Trial_cm > 0
          AND (UPPER(group_name_1) LIKE '%MLB%' OR UPPER(group_name_1) LIKE '%MILB%' OR UPPER(group_name_1) LIKE '%PRO%')
      `;

      if (position) {
        query += ` AND LOWER(group_name_2) LIKE LOWER('%${position}%')`;
      }

      const [rows] = await bigquery.query(query);

      if (rows.length > 0) {
        const result = rows[0];
        return {
          percentiles: {
            pushUpHeight: this.extractPercentileValues(result.percentiles_height),
            relativePeakForce: this.extractPercentileValues(result.percentiles_force),
            pushUpDepth: this.extractPercentileValues(result.percentiles_depth)
          },
          averages: {
            pushUpHeight: result.avg_height,
            relativePeakForce: result.avg_force,
            pushUpDepth: result.avg_depth
          },
          sampleSize: result.sample_size
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching PPU norms:', error);
      throw error;
    }
  }

  /**
   * Get MLB norms for IMTP test
   */
  async getIMTPNorms(position = null) {
    try {
      let query = `
        SELECT
          APPROX_QUANTILES(BW_NET_FORCE_PEAK_Trial_N, 100) as percentiles_peak_force,
          APPROX_QUANTILES(BW_NET_FORCE_AT_200MS_Trial_N, 100) as percentiles_force_200ms,
          APPROX_QUANTILES(BW_NET_FORCE_AT_100MS_Trial_N, 100) as percentiles_force_100ms,
          AVG(BW_NET_FORCE_PEAK_Trial_N) as avg_peak_force,
          AVG(BW_NET_FORCE_AT_200MS_Trial_N) as avg_force_200ms,
          AVG(BW_NET_FORCE_AT_100MS_Trial_N) as avg_force_100ms,
          COUNT(*) as sample_size
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.imtp_results\`
        WHERE BW_NET_FORCE_PEAK_Trial_N IS NOT NULL
          AND BW_NET_FORCE_PEAK_Trial_N > 0
          AND (UPPER(group_name_1) LIKE '%MLB%' OR UPPER(group_name_1) LIKE '%MILB%' OR UPPER(group_name_1) LIKE '%PRO%')
      `;

      if (position) {
        query += ` AND LOWER(group_name_2) LIKE LOWER('%${position}%')`;
      }

      const [rows] = await bigquery.query(query);

      if (rows.length > 0) {
        const result = rows[0];
        return {
          percentiles: {
            peakForce: this.extractPercentileValues(result.percentiles_peak_force),
            force200ms: this.extractPercentileValues(result.percentiles_force_200ms),
            force100ms: this.extractPercentileValues(result.percentiles_force_100ms)
          },
          averages: {
            peakForce: result.avg_peak_force,
            force200ms: result.avg_force_200ms,
            force100ms: result.avg_force_100ms
          },
          sampleSize: result.sample_size
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching IMTP norms:', error);
      throw error;
    }
  }

  /**
   * Calculate percentile rank for a specific athlete's metric
   */
  async getAthletePercentileRank(testType, metricName, athleteValue, position = null) {
    try {
      const tableMap = {
        'cmj': 'cmj_results',
        'sj': 'sj_results',
        'imtp': 'imtp_results',
        'hj': 'hj_results',
        'ppu': 'ppu_results'
      };

      const tableName = tableMap[testType.toLowerCase()];
      if (!tableName) {
        throw new Error(`Invalid test type: ${testType}`);
      }

      let query = `
        SELECT
          PERCENT_RANK() OVER (ORDER BY ${metricName}) as percentile_rank
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.${tableName}\`
        WHERE ${metricName} IS NOT NULL
      `;

      if (position) {
        query += ` AND LOWER(group_name_2) LIKE LOWER('%${position}%')`;
      }

      query = `
        WITH ranked_data AS (${query})
        SELECT
          (SELECT percentile_rank FROM ranked_data
           WHERE ${metricName} <= ${athleteValue}
           ORDER BY percentile_rank DESC
           LIMIT 1) as athlete_percentile,
          COUNT(*) as total_athletes
        FROM ranked_data
      `;

      const [rows] = await bigquery.query(query);

      if (rows.length > 0) {
        return {
          percentile: Math.round(rows[0].athlete_percentile * 100),
          totalAthletes: rows[0].total_athletes,
          comparison: this.getPercentileDescription(rows[0].athlete_percentile * 100)
        };
      }

      return null;
    } catch (error) {
      console.error('Error calculating percentile rank:', error);
      throw error;
    }
  }

  /**
   * Get comparison data for all jump tests
   */
  async getFullJumpComparison(athleteData, position = null) {
    try {
      const comparisons = {};

      // CMJ Comparison
      if (athleteData.cmj) {
        const cmjNorms = await this.getCMJNorms(position);
        comparisons.cmj = {
          norms: cmjNorms,
          athletePercentiles: {}
        };

        if (athleteData.cmj.jumpHeight) {
          comparisons.cmj.athletePercentiles.jumpHeight = await this.getAthletePercentileRank(
            'cmj', 'JUMP_HEIGHT_IMP_MOM_Trial_cm', athleteData.cmj.jumpHeight, position
          );
        }

        if (athleteData.cmj.peakPowerBM) {
          comparisons.cmj.athletePercentiles.peakPower = await this.getAthletePercentileRank(
            'cmj', 'BODYMASS_RELATIVE_TAKEOFF_POWER_Trial_W_per_kg', athleteData.cmj.peakPowerBM, position
          );
        }
      }

      // Horizontal Jump Comparison
      if (athleteData.hj) {
        const hjNorms = await this.getHJNorms(position);
        comparisons.hj = {
          norms: hjNorms,
          athletePercentiles: {}
        };

        if (athleteData.hj.maxDistance) {
          comparisons.hj.athletePercentiles.maxDistance = await this.getAthletePercentileRank(
            'hj', 'HJ_max_cm', athleteData.hj.maxDistance, position
          );
        }
      }

      // PPU Comparison
      if (athleteData.ppu) {
        const ppuNorms = await this.getPPUNorms(position);
        comparisons.ppu = {
          norms: ppuNorms,
          athletePercentiles: {}
        };

        if (athleteData.ppu.peakForceBM) {
          comparisons.ppu.athletePercentiles.peakForce = await this.getAthletePercentileRank(
            'ppu', 'PPU_peak_force_bm', athleteData.ppu.peakForceBM, position
          );
        }
      }

      // IMTP Comparison
      if (athleteData.imtp) {
        const imtpNorms = await this.getIMTPNorms(position);
        comparisons.imtp = {
          norms: imtpNorms,
          athletePercentiles: {}
        };

        if (athleteData.imtp.peakForceBM) {
          comparisons.imtp.athletePercentiles.peakForce = await this.getAthletePercentileRank(
            'imtp', 'peak_force_bm', athleteData.imtp.peakForceBM, position
          );
        }
      }

      return comparisons;
    } catch (error) {
      console.error('Error getting full jump comparison:', error);
      throw error;
    }
  }

  /**
   * Extract key percentile values (25th, 50th, 75th, 95th)
   */
  extractPercentileValues(percentileArray) {
    if (!percentileArray || percentileArray.length !== 101) return null;

    return {
      p5: percentileArray[5],
      p25: percentileArray[25],
      p50: percentileArray[50],  // Median
      p75: percentileArray[75],
      p95: percentileArray[95]
    };
  }

  /**
   * Get descriptive text for percentile ranking
   */
  getPercentileDescription(percentile) {
    if (percentile >= 95) return 'Elite';
    if (percentile >= 75) return 'Above Average';
    if (percentile >= 50) return 'Average';
    if (percentile >= 25) return 'Below Average';
    return 'Needs Improvement';
  }

  /**
   * Get position-specific rankings
   */
  async getPositionRankings() {
    try {
      const query = `
        SELECT DISTINCT
          group_name_2 as position,
          COUNT(*) as athlete_count
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.profile_metadata\`
        WHERE group_name_2 IS NOT NULL
        GROUP BY group_name_2
        ORDER BY athlete_count DESC
      `;

      const [rows] = await bigquery.query(query);
      return rows;
    } catch (error) {
      console.error('Error fetching position rankings:', error);
      throw error;
    }
  }
}

// Export singleton instance
const mlbNormsService = new MLBNormsService();
export default mlbNormsService;