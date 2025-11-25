import { getValdApiClient } from './valdAuthService.js';
import dotenv from 'dotenv';

dotenv.config();

const TENANT_URL = process.env.TENANT_URL;
const PROFILE_URL = process.env.PROFILE_URL;
const FORCEDECKS_URL = process.env.FORCEDECKS_URL;
const TENANT_ID = process.env.TENANT_ID;

/**
 * Fetch all tenants you have access to
 * Uses External Tenants API
 */
export const fetchTenants = async () => {
  try {
    const valdApi = await getValdApiClient();
    // Override base URL for tenants API
    valdApi.defaults.baseURL = TENANT_URL;
    const response = await valdApi.get('/tenants');

    console.log('✅ Tenants fetched:', response.data?.length || 0);
    return response.data;
  } catch (error) {
    console.error('Error fetching tenants:', error.response?.data || error.message);
    throw new Error('Failed to fetch tenants from VALD');
  }
};

/**
 * Fetch all profiles (athletes) for a specific tenant
 * Uses External Profiles API
 * @param {string} tenantId - The tenant ID (optional, uses env default if not provided)
 */
export const fetchProfiles = async (tenantId = TENANT_ID) => {
  try {
    const valdApi = await getValdApiClient();
    // Override base URL for profiles API
    valdApi.defaults.baseURL = PROFILE_URL;
    const response = await valdApi.get('/profiles', {
      params: { tenantId },
    });

    console.log(`✅ Profiles fetched for tenant ${tenantId}:`, response.data?.length || 0);
    return response.data;
  } catch (error) {
    console.error('Error fetching profiles:', error.response?.data || error.message);
    throw new Error(`Failed to fetch profiles for tenant ${tenantId}`);
  }
};

/**
 * Fetch profile details by ID
 * Uses External Profiles API
 * @param {string} profileId - The profile (athlete) ID
 * @param {string} tenantId - The tenant ID (optional, uses env default)
 */
export const fetchProfileById = async (profileId, tenantId = TENANT_ID) => {
  try {
    const valdApi = await getValdApiClient();
    // Override base URL for profiles API
    valdApi.defaults.baseURL = PROFILE_URL;
    const response = await valdApi.get(`/profiles/${profileId}`, {
      params: { tenantId },
    });

    console.log(`✅ Profile details fetched for ${profileId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching profile ${profileId}:`, error.response?.data || error.message);
    throw new Error(`Failed to fetch profile ${profileId}`);
  }
};

/**
 * Fetch tests for a specific profile
 * Uses External ForceDecks API
 * @param {string} profileId - The profile (athlete) ID (optional)
 * @param {string} tenantId - The tenant ID (optional, uses env default)
 * @param {string} modifiedFromUtc - Filter tests modified since this date (required: YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export const fetchProfileTests = async (profileId = null, tenantId = TENANT_ID, modifiedFromUtc = '2024-01-01T00:00:00.000Z') => {
  try {
    const valdApi = await getValdApiClient();
    // Override base URL for ForceDecks API
    valdApi.defaults.baseURL = FORCEDECKS_URL;

    const params = {
      tenantId,
      modifiedFromUtc,
    };

    // Add profileId if provided (optional filter)
    if (profileId) {
      params.profileId = profileId;
    }

    const response = await valdApi.get('/tests', { params });

    console.log(`✅ Tests fetched${profileId ? ` for profile ${profileId}` : ''}:`, response.data?.length || 0);
    return response.data;
  } catch (error) {
    console.error(`Error fetching tests:`, error.response?.data || error.message);
    throw new Error(`Failed to fetch tests from ForceDecks API`);
  }
};

/**
 * Fetch specific test types (CMJ, SJ, etc.) for a profile
 * @param {string} profileId - The profile ID
 * @param {string} tenantId - The tenant ID
 * @param {string} testType - Test type (e.g., 'CMJ', 'SJ', 'IMTP')
 */
export const fetchTestsByType = async (profileId, tenantId, testType) => {
  try {
    const valdApi = await getValdApiClient();
    const response = await valdApi.get(`/profiles/${profileId}/tests`, {
      params: {
        tenantId,
        testType,
      },
    });

    console.log(`✅ ${testType} tests fetched for ${profileId}:`, response.data?.length || 0);
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${testType} tests:`, error.response?.data || error.message);
    throw new Error(`Failed to fetch ${testType} tests`);
  }
};

/**
 * Fetch all force deck tests for an athlete (all 6 types)
 * @param {string} profileId - The profile ID
 * @param {string} tenantId - The tenant ID
 */
export const fetchAllForceDeckTests = async (profileId, tenantId) => {
  try {
    const testTypes = ['CMJ', 'SJ', 'HT', 'SLCMJ', 'IMTP', 'PPU'];

    const results = await Promise.allSettled(
      testTypes.map(type => fetchTestsByType(profileId, tenantId, type))
    );

    const allTests = {};
    results.forEach((result, index) => {
      const testType = testTypes[index];
      if (result.status === 'fulfilled') {
        allTests[testType.toLowerCase()] = result.value;
      } else {
        console.warn(`⚠️  Failed to fetch ${testType}:`, result.reason);
        allTests[testType.toLowerCase()] = [];
      }
    });

    return allTests;
  } catch (error) {
    console.error('Error fetching all force deck tests:', error.message);
    throw new Error('Failed to fetch all force deck tests');
  }
};

/**
 * Search profiles by name
 * Uses External Profiles API
 * @param {string} searchTerm - Name to search for
 * @param {string} tenantId - The tenant ID (optional, uses env default)
 */
export const searchProfiles = async (searchTerm, tenantId = TENANT_ID) => {
  try {
    const valdApi = await getValdApiClient();
    // Override base URL for profiles API
    valdApi.defaults.baseURL = PROFILE_URL;

    const response = await valdApi.get('/profiles', {
      params: {
        tenantId,
        search: searchTerm,
      },
    });

    console.log(`✅ Search results for "${searchTerm}":`, response.data?.length || 0);
    return response.data;
  } catch (error) {
    console.error('Error searching profiles:', error.response?.data || error.message);
    throw new Error('Failed to search profiles');
  }
};

export default {
  fetchTenants,
  fetchProfiles,
  fetchProfileById,
  fetchProfileTests,
  fetchTestsByType,
  fetchAllForceDeckTests,
  searchProfiles,
};
