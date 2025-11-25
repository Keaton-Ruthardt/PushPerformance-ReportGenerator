import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const VALD_API_URL = process.env.VALD_API_URL;
const VALD_API_KEY = process.env.VALD_API_KEY;
const VALD_API_SECRET = process.env.VALD_API_SECRET;

// Create axios instance with VALD API configuration
const valdApi = axios.create({
  baseURL: VALD_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${VALD_API_KEY}`,
  },
});

/**
 * Fetch all professional athletes from VALD
 * @returns {Promise<Array>} Array of professional athletes
 */
export const fetchProfessionalAthletes = async () => {
  try {
    // Adjust endpoint based on actual VALD API documentation
    const response = await valdApi.get('/athletes', {
      params: {
        tags: 'professional', // Filter by professional tag
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching professional athletes:', error.message);
    throw new Error('Failed to fetch professional athletes from VALD');
  }
};

/**
 * Fetch athlete details by ID
 * @param {string} athleteId - The athlete ID
 * @returns {Promise<Object>} Athlete details
 */
export const fetchAthleteById = async (athleteId) => {
  try {
    const response = await valdApi.get(`/athletes/${athleteId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching athlete ${athleteId}:`, error.message);
    throw new Error(`Failed to fetch athlete ${athleteId}`);
  }
};

/**
 * Fetch all force plate tests for an athlete
 * @param {string} athleteId - The athlete ID
 * @returns {Promise<Object>} Object containing all test results
 */
export const fetchAthleteTests = async (athleteId) => {
  try {
    const [cmj, sj, ht, slCmj, imtp, ppu] = await Promise.all([
      fetchCMJTest(athleteId),
      fetchSJTest(athleteId),
      fetchHTTest(athleteId),
      fetchSLCMJTest(athleteId),
      fetchIMTPTest(athleteId),
      fetchPPUTest(athleteId),
    ]);

    return {
      cmj,
      sj,
      ht,
      slCmj,
      imtp,
      ppu,
    };
  } catch (error) {
    console.error(`Error fetching tests for athlete ${athleteId}:`, error.message);
    throw new Error(`Failed to fetch tests for athlete ${athleteId}`);
  }
};

/**
 * Fetch Countermovement Jump (CMJ) test results
 */
export const fetchCMJTest = async (athleteId) => {
  try {
    const response = await valdApi.get(`/athletes/${athleteId}/tests/cmj/latest`);
    return {
      jumpHeight: response.data.jumpHeight,
      eccentricBrakingRFD: response.data.eccentricBrakingRFD,
      forceAtZeroVelocity: response.data.forceAtZeroVelocity,
      eccentricPeakForce: response.data.eccentricPeakForce,
      concentricImpulse100ms: response.data.concentricImpulse100ms,
      eccentricPeakVelocity: response.data.eccentricPeakVelocity,
      concentricPeakVelocity: response.data.concentricPeakVelocity,
      eccentricPeakPower: response.data.eccentricPeakPower,
      eccentricPeakPowerPerBM: response.data.eccentricPeakPowerPerBM,
      peakPower: response.data.peakPower,
      peakPowerPerBM: response.data.peakPowerPerBM,
      rsiMod: response.data.rsiMod,
    };
  } catch (error) {
    console.error('Error fetching CMJ test:', error.message);
    return null;
  }
};

/**
 * Fetch Squat Jump (SJ) test results
 */
export const fetchSJTest = async (athleteId) => {
  try {
    const response = await valdApi.get(`/athletes/${athleteId}/tests/sj/latest`);
    return {
      jumpHeight: response.data.jumpHeight,
      forceAtPeakPower: response.data.forceAtPeakPower,
      concentricPeakVelocity: response.data.concentricPeakVelocity,
      peakPower: response.data.peakPower,
      peakPowerPerBM: response.data.peakPowerPerBM,
    };
  } catch (error) {
    console.error('Error fetching SJ test:', error.message);
    return null;
  }
};

/**
 * Fetch Hop Test (HT) test results
 */
export const fetchHTTest = async (athleteId) => {
  try {
    const response = await valdApi.get(`/athletes/${athleteId}/tests/ht/latest`);
    return {
      rsi: response.data.rsi,
      jumpHeight: response.data.jumpHeight,
      groundContactTime: response.data.groundContactTime,
    };
  } catch (error) {
    console.error('Error fetching HT test:', error.message);
    return null;
  }
};

/**
 * Fetch Single Leg Countermovement Jump (SL CMJ) test results
 */
export const fetchSLCMJTest = async (athleteId) => {
  try {
    const response = await valdApi.get(`/athletes/${athleteId}/tests/slcmj/latest`);
    return {
      left: {
        jumpHeight: response.data.left.jumpHeight,
        eccentricPeakForce: response.data.left.eccentricPeakForce,
        eccentricBrakingRFD: response.data.left.eccentricBrakingRFD,
        concentricPeakForce: response.data.left.concentricPeakForce,
        eccentricPeakVelocity: response.data.left.eccentricPeakVelocity,
        concentricPeakVelocity: response.data.left.concentricPeakVelocity,
        peakPower: response.data.left.peakPower,
        peakPowerPerBM: response.data.left.peakPowerPerBM,
        rsiMod: response.data.left.rsiMod,
      },
      right: {
        jumpHeight: response.data.right.jumpHeight,
        eccentricPeakForce: response.data.right.eccentricPeakForce,
        eccentricBrakingRFD: response.data.right.eccentricBrakingRFD,
        concentricPeakForce: response.data.right.concentricPeakForce,
        eccentricPeakVelocity: response.data.right.eccentricPeakVelocity,
        concentricPeakVelocity: response.data.right.concentricPeakVelocity,
        peakPower: response.data.right.peakPower,
        peakPowerPerBM: response.data.right.peakPowerPerBM,
        rsiMod: response.data.right.rsiMod,
      },
    };
  } catch (error) {
    console.error('Error fetching SL CMJ test:', error.message);
    return null;
  }
};

/**
 * Fetch Isometric Mid-Thigh Pull (IMTP) test results
 */
export const fetchIMTPTest = async (athleteId) => {
  try {
    const response = await valdApi.get(`/athletes/${athleteId}/tests/imtp/latest`);
    return {
      peakVerticalForce: response.data.peakVerticalForce,
      peakVerticalForcePerBM: response.data.peakVerticalForcePerBM,
      forceAt100ms: response.data.forceAt100ms,
      timeToPeakForce: response.data.timeToPeakForce,
    };
  } catch (error) {
    console.error('Error fetching IMTP test:', error.message);
    return null;
  }
};

/**
 * Fetch Plyometric Push-Up (PPU) test results
 */
export const fetchPPUTest = async (athleteId) => {
  try {
    const response = await valdApi.get(`/athletes/${athleteId}/tests/ppu/latest`);
    return {
      pushUpHeight: response.data.pushUpHeight,
      eccentricPeakForce: response.data.eccentricPeakForce,
      concentricPeakForce: response.data.concentricPeakForce,
      concentricRFDLeft: response.data.concentricRFDLeft,
      concentricRFDRight: response.data.concentricRFDRight,
      eccentricBrakingRFD: response.data.eccentricBrakingRFD,
    };
  } catch (error) {
    console.error('Error fetching PPU test:', error.message);
    return null;
  }
};

/**
 * Fetch all professional athletes' test data for percentile calculation
 * @param {string} testType - Type of test (cmj, sj, ht, slcmj, imtp, ppu)
 * @returns {Promise<Array>} Array of test results for all pro athletes
 */
export const fetchAllProTestData = async (testType) => {
  try {
    const athletes = await fetchProfessionalAthletes();
    const testData = [];

    for (const athlete of athletes) {
      let data;
      switch (testType) {
        case 'cmj':
          data = await fetchCMJTest(athlete.id);
          break;
        case 'sj':
          data = await fetchSJTest(athlete.id);
          break;
        case 'ht':
          data = await fetchHTTest(athlete.id);
          break;
        case 'slcmj':
          data = await fetchSLCMJTest(athlete.id);
          break;
        case 'imtp':
          data = await fetchIMTPTest(athlete.id);
          break;
        case 'ppu':
          data = await fetchPPUTest(athlete.id);
          break;
        default:
          continue;
      }

      if (data) {
        testData.push(data);
      }
    }

    return testData;
  } catch (error) {
    console.error(`Error fetching all pro test data for ${testType}:`, error.message);
    throw error;
  }
};

export default {
  fetchProfessionalAthletes,
  fetchAthleteById,
  fetchAthleteTests,
  fetchCMJTest,
  fetchSJTest,
  fetchHTTest,
  fetchSLCMJTest,
  fetchIMTPTest,
  fetchPPUTest,
  fetchAllProTestData,
};
