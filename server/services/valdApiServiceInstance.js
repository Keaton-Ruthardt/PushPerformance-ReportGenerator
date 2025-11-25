import VALDApiService from './valdApiService.js';

/**
 * Singleton instance of VALDApiService for use in server routes
 * This instance is created when the server starts, after environment variables are loaded
 */
let instance = null;

export function getValdApiService() {
  if (!instance) {
    instance = new VALDApiService();
  }
  return instance;
}

// For backwards compatibility, export a default that creates instance on first access
export default getValdApiService();
