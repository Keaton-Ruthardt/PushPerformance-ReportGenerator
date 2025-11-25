import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const VALD_API_URL = process.env.VALD_API_URL;
const CLIENT_ID = process.env.VALD_API_KEY; // This is your clientId
const CLIENT_SECRET = process.env.VALD_API_SECRET;

// Token cache
let cachedToken = null;
let tokenExpiry = null;

/**
 * Request a new Bearer token from VALD API
 * Tokens are valid for 2 hours
 * Auth endpoint is on security.valdperformance.com (different from API URL)
 */
const requestNewToken = async () => {
  try {
    console.log('🔑 Requesting new VALD API token...');

    const response = await axios.post(
      'https://security.valdperformance.com/connect/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in } = response.data;

    // Cache the token and calculate expiry time (2 hours from now)
    cachedToken = access_token;
    tokenExpiry = Date.now() + (expires_in * 1000); // expires_in is in seconds

    console.log('✅ VALD API token obtained successfully');
    console.log(`   Expires in: ${expires_in / 3600} hours`);

    return access_token;
  } catch (error) {
    console.error('❌ Error requesting VALD token:', error.response?.data || error.message);
    throw new Error('Failed to obtain VALD API token');
  }
};

/**
 * Get a valid Bearer token (from cache or request new one)
 * Automatically refreshes if token is expired or about to expire
 */
export const getValidToken = async () => {
  const now = Date.now();
  const bufferTime = 5 * 60 * 1000; // Refresh 5 minutes before expiry

  // Check if we have a cached token and it's still valid
  if (cachedToken && tokenExpiry && (tokenExpiry - now) > bufferTime) {
    console.log('✅ Using cached VALD token');
    return cachedToken;
  }

  // Token is expired or about to expire, request a new one
  console.log('🔄 Token expired or missing, requesting new token...');
  return await requestNewToken();
};

/**
 * Create an authenticated axios instance for VALD API
 */
export const getValdApiClient = async () => {
  const token = await getValidToken();

  return axios.create({
    baseURL: VALD_API_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 second timeout
  });
};

/**
 * Force token refresh (useful for testing)
 */
export const refreshToken = async () => {
  console.log('🔄 Forcing token refresh...');
  cachedToken = null;
  tokenExpiry = null;
  return await getValidToken();
};

export default {
  getValidToken,
  getValdApiClient,
  refreshToken,
};
