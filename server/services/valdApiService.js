import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (two levels up from server/services)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

/**
 * VALD Hub API Service
 * Handles authentication and data retrieval from VALD systems
 */
class VALDApiService {
  constructor() {
    this.config = {
      authUrl: process.env.AUTH_URL || 'https://security.valdperformance.com/connect/token',
      profileUrl: process.env.PROFILE_URL || 'https://prd-use-api-externalprofile.valdperformance.com',
      tenantUrl: process.env.TENANT_URL || 'https://prd-use-api-externaltenants.valdperformance.com',
      forceDecksUrl: process.env.FORCEDECKS_URL || 'https://prd-use-api-extforcedecks.valdperformance.com',
      tenantId: process.env.TENANT_ID,
      apiKey: process.env.VALD_API_KEY,
      apiSecret: process.env.VALD_API_SECRET,
      // MLB/MiLB Group ID from VALD tenants API
      mlbMilbGroupId: 'c29bf68e-d057-479b-b216-18ee05b8c913'
    };

    // Secondary credentials configuration (if provided)
    this.config2 = null;
    if (process.env.VALD_API_KEY_2 && process.env.VALD_API_SECRET_2 && process.env.TENANT_ID_2) {
      this.config2 = {
        authUrl: process.env.AUTH_URL || 'https://security.valdperformance.com/connect/token',
        profileUrl: process.env.PROFILE_URL || 'https://prd-use-api-externalprofile.valdperformance.com',
        tenantUrl: process.env.TENANT_URL || 'https://prd-use-api-externaltenants.valdperformance.com',
        forceDecksUrl: process.env.FORCEDECKS_URL || 'https://prd-use-api-extforcedecks.valdperformance.com',
        tenantId: process.env.TENANT_ID_2,
        apiKey: process.env.VALD_API_KEY_2,
        apiSecret: process.env.VALD_API_SECRET_2
      };
      console.log('✅ Secondary VALD API credentials configured');
    }

    this.accessToken = null;
    this.tokenExpiry = null;
    this.accessToken2 = null;
    this.tokenExpiry2 = null;
  }

  /**
   * Get OAuth2 access token from VALD (Primary Account)
   */
  async authenticate() {
    try {
      // Safety check for undefined credentials
      if (!this.config.apiKey || !this.config.apiSecret) {
        throw new Error('API Key or Secret is undefined. Check environment variables.');
      }

      const response = await axios.post(this.config.authUrl, {
        grant_type: 'client_credentials',
        client_id: this.config.apiKey.replace(/"/g, ''),  // Remove quotes if present
        client_secret: this.config.apiSecret.replace(/"/g, '')
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      console.log('✅ VALD Primary authentication successful');
      return this.accessToken;
    } catch (error) {
      console.error('❌ VALD Primary authentication failed:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with VALD API (Primary)');
    }
  }

  /**
   * Get OAuth2 access token from VALD (Secondary Account)
   */
  async authenticate2() {
    if (!this.config2) {
      return null;
    }

    try {
      // Safety check for undefined credentials
      if (!this.config2.apiKey || !this.config2.apiSecret) {
        console.warn('⚠️  Secondary API Key or Secret is undefined');
        return null;
      }

      const response = await axios.post(this.config2.authUrl, {
        grant_type: 'client_credentials',
        client_id: this.config2.apiKey.replace(/"/g, ''),
        client_secret: this.config2.apiSecret.replace(/"/g, '')
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken2 = response.data.access_token;
      this.tokenExpiry2 = Date.now() + (response.data.expires_in * 1000);

      console.log('✅ VALD Secondary authentication successful');
      return this.accessToken2;
    } catch (error) {
      console.error('❌ VALD Secondary authentication failed:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get valid access token (refreshes if expired) - Primary
   */
  async getAccessToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
    return this.accessToken;
  }

  /**
   * Get valid access token (refreshes if expired) - Secondary
   */
  async getAccessToken2() {
    if (!this.config2) {
      return null;
    }
    if (!this.accessToken2 || Date.now() >= this.tokenExpiry2) {
      await this.authenticate2();
    }
    return this.accessToken2;
  }

  /**
   * Get all athletes from both Primary and Secondary VALD APIs
   */
  async getAllAthletes() {
    return this.searchAthletes('');
  }

  /**
   * Search for athletes in VALD system (searches both primary and secondary APIs)
   */
  async searchAthletes(searchTerm) {
    const athletes = new Map(); // Use Map to deduplicate by name

    // Helper function to process profiles
    const processProfiles = (profiles, source, groupContext = null) => {
      const allAthletes = profiles.map(profile => {
        // Build groups array from context if provided
        const groups = [];
        if (groupContext) {
          groups.push({ id: groupContext.id, name: groupContext.name });
        } else if (profile.groups && Array.isArray(profile.groups)) {
          groups.push(...profile.groups);
        }

        return {
          id: profile.profileId,
          profileIds: [profile.profileId], // Array to store profile IDs from multiple APIs
          name: `${profile.givenName || ''} ${profile.familyName || ''}`.trim() || 'Unknown',
          firstName: profile.givenName || '',
          lastName: profile.familyName || '',
          fullName: `${profile.givenName || ''} ${profile.familyName || ''}`.trim() || 'Unknown',
          full_name: `${profile.givenName || ''} ${profile.familyName || ''}`.trim() || 'Unknown',
          organization: profile.organization || profile.team || '',
          sport: profile.sport || '',
          position: profile.position || '',
          email: profile.email || '',
          dateOfBirth: profile.dateOfBirth || '',
          externalId: profile.externalId || '',
          // Attach group information
          groups: groups,
          group_name_1: groups[0]?.name || profile.group_name_1 || '',
          group_name_2: groups[1]?.name || profile.group_name_2 || '',
          group_name_3: groups[2]?.name || profile.group_name_3 || '',
          groupId: groupContext?.id || profile.groupId || '',
          group: groupContext?.name || profile.group || '',
          groupName: groupContext?.name || profile.groupName || '',
          groupName1: groupContext?.name || profile.groupName1 || '',
          tags: profile.tags || [],
          source: source // Track which API returned this athlete
        };
      });

      // We'll filter by groups - keep this for now
      return allAthletes;
    };

    // Search Primary API - Get groups first, then profiles for pro groups
    try {
      const token = await this.getAccessToken();

      // Step 1: Get all groups for this tenant
      let groupsData = [];
      try {
        const groupsUrl = `${this.config.tenantUrl}/groups`;
        console.log('🔍 Calling groups API:', groupsUrl, 'with TenantId:', this.config.tenantId);
        const groupsResponse = await axios.get(
          groupsUrl,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            params: {
              TenantId: this.config.tenantId  // Capital T!
            }
          }
        );
        groupsData = groupsResponse.data.groups || groupsResponse.data || [];
        console.log('✅ Primary: Found groups:', JSON.stringify(groupsData).substring(0, 1000));
      } catch (e) {
        console.log('❌ Primary /groups failed:', e.response?.status, e.message);
        console.log('   Full error:', e.response?.data || e.toString());
        console.log('   Request URL:', e.config?.url);
        console.log('   Request params:', e.config?.params);
      }

      // Step 2: Filter to only professional groups
      const proGroupNames = ['MiLB/MLB', 'Pro', 'MLB', 'MiLB', 'Professional', 'Major', 'MLB/ MiLB', 'Pro Baseball'];
      const allGroups = groupsData.filter(group => {
        return proGroupNames.some(proName =>
          group.name && group.name.toLowerCase().includes(proName.toLowerCase())
        );
      });

      console.log(`🎯 Primary: Filtered to ${allGroups.length} professional groups (from ${groupsData.length} total):`, allGroups.map(g => g.name));

      // Step 3: Get profiles for each group
      for (const group of allGroups) {
        try {
          const response = await axios.get(
            `${this.config.profileUrl}/profiles`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              params: {
                tenantId: this.config.tenantId,
                groupId: group.id,  // Filter by group ID
                limit: 500
              }
            }
          );

          if (response.data && response.data.profiles) {
            const groupAthletes = processProfiles(response.data.profiles, 'Primary', group);
            console.log(`📊 Primary API [${group.name}]: Found ${groupAthletes.length} athletes`);

            groupAthletes.forEach(athlete => {
              // Use normalized name as key for deduplication
              const nameKey = athlete.name.toLowerCase().trim();

              if (!athletes.has(nameKey)) {
                athletes.set(nameKey, athlete);
                console.log(`   ➕ Primary [${group.name}]: Added "${athlete.name}" (${athlete.id})`);
              } else {
                // Merge with existing athlete (found in both APIs or multiple groups)
                const existing = athletes.get(nameKey);

                // Add profile ID if it's not already there
                if (!existing.profileIds.includes(athlete.id)) {
                  existing.profileIds.push(athlete.id);
                }

                // Merge groups - add new groups that don't already exist
                athlete.groups.forEach(newGroup => {
                  const groupExists = existing.groups.some(g => g.id === newGroup.id);
                  if (!groupExists) {
                    existing.groups.push(newGroup);
                  }
                });

                // Update group_name_1, group_name_2, group_name_3 from merged groups
                existing.group_name_1 = existing.groups[0]?.name || existing.group_name_1;
                existing.group_name_2 = existing.groups[1]?.name || existing.group_name_2;
                existing.group_name_3 = existing.groups[2]?.name || existing.group_name_3;

                existing.source = 'Both';
                athletes.set(nameKey, existing);
                console.log(`   🔗 Primary [${group.name}]: Merged "${athlete.name}" (${athlete.id}) - now has ${existing.profileIds.length} IDs, ${existing.groups.length} groups`);
              }
            });
          }
        } catch (error) {
          console.error(`Error fetching profiles for group ${group.name}:`, error.response?.data || error.message);
        }
      }
    } catch (error) {
      console.error('Error searching Primary API:', error.response?.data || error.message);
    }

    // Search Secondary API (if configured) - Get groups first, then profiles
    if (this.config2) {
      try {
        const token2 = await this.getAccessToken2();
        if (token2) {
          // Step 1: Get all groups for this tenant
          let groupsData2 = [];
          try {
            const groupsResponse2 = await axios.get(
              `${this.config2.tenantUrl}/groups`,
              {
                headers: {
                  'Authorization': `Bearer ${token2}`,
                  'Content-Type': 'application/json'
                },
                params: {
                  TenantId: this.config2.tenantId  // Capital T!
                }
              }
            );
            groupsData2 = groupsResponse2.data.groups || groupsResponse2.data || [];
            console.log('✅ Secondary: Found groups:', JSON.stringify(groupsData2).substring(0, 1000));
          } catch (e) {
            console.log('❌ Secondary /groups failed:', e.response?.status, e.message);
          }

          // Step 2: Filter to only professional groups
          const proGroupNames = ['MiLB/MLB', 'Pro', 'MLB', 'MiLB', 'Professional', 'Major', 'MLB/ MiLB', 'Pro Baseball'];
          const allGroups2 = groupsData2.filter(group => {
            return proGroupNames.some(proName =>
              group.name && group.name.toLowerCase().includes(proName.toLowerCase())
            );
          });

          console.log(`🎯 Secondary: Filtered to ${allGroups2.length} professional groups (from ${groupsData2.length} total):`, allGroups2.map(g => g.name));

          // Step 3: Get profiles for each group
          for (const group of allGroups2) {
            try {
              const response2 = await axios.get(
                `${this.config2.profileUrl}/profiles`,
                {
                  headers: {
                    'Authorization': `Bearer ${token2}`,
                    'Content-Type': 'application/json'
                  },
                  params: {
                    tenantId: this.config2.tenantId,
                    groupId: group.id,  // Filter by group ID
                    limit: 500
                  }
                }
              );

              if (response2.data && response2.data.profiles) {
                const groupAthletes2 = processProfiles(response2.data.profiles, 'Secondary', group);
                console.log(`📊 Secondary API [${group.name}]: Found ${groupAthletes2.length} athletes`);

                groupAthletes2.forEach(athlete => {
                  // Use normalized name as key for deduplication
                  const nameKey = athlete.name.toLowerCase().trim();

                  if (!athletes.has(nameKey)) {
                    athletes.set(nameKey, athlete);
                    console.log(`   ➕ Secondary [${group.name}]: Added "${athlete.name}" (${athlete.id})`);
                  } else {
                    // Merge with existing athlete (found in both APIs or multiple groups)
                    const existing = athletes.get(nameKey);

                    // Add profile ID if it's not already there
                    if (!existing.profileIds.includes(athlete.id)) {
                      existing.profileIds.push(athlete.id);
                    }

                    // Merge groups - add new groups that don't already exist
                    athlete.groups.forEach(newGroup => {
                      const groupExists = existing.groups.some(g => g.id === newGroup.id);
                      if (!groupExists) {
                        existing.groups.push(newGroup);
                      }
                    });

                    // Update group_name_1, group_name_2, group_name_3 from merged groups
                    existing.group_name_1 = existing.groups[0]?.name || existing.group_name_1;
                    existing.group_name_2 = existing.groups[1]?.name || existing.group_name_2;
                    existing.group_name_3 = existing.groups[2]?.name || existing.group_name_3;

                    existing.source = 'Both';
                    athletes.set(nameKey, existing);
                    console.log(`   🔗 Secondary [${group.name}]: Merged "${athlete.name}" (${athlete.id}) - now has ${existing.profileIds.length} IDs, ${existing.groups.length} groups`);
                  }
                });
              }
            } catch (error) {
              console.error(`Error fetching profiles for group ${group.name}:`, error.response?.data || error.message);
            }
          }
        }
      } catch (error) {
        console.error('Error searching Secondary API:', error.response?.data || error.message);
      }
    }

    // Convert Map to Array
    let allProAthletes = Array.from(athletes.values());

    // Filter by search term
    let filteredAthletes = allProAthletes;
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      filteredAthletes = allProAthletes.filter(athlete => {
        // Normalize spaces in name for comparison (replace multiple spaces with single space)
        const normalizedName = athlete.name.toLowerCase().replace(/\s+/g, ' ');
        const normalizedFirstName = athlete.firstName.toLowerCase().trim();
        const normalizedLastName = athlete.lastName.toLowerCase().trim();

        return normalizedName.includes(term) ||
               normalizedFirstName.includes(term) ||
               normalizedLastName.includes(term);
      });
    }

    console.log(`🎯 Total: Found ${filteredAthletes.length} pro athletes matching "${searchTerm}" across ${this.config2 ? 'both' : 'primary'} API(s)`);

    // Log athletes with multiple profile IDs
    const multiApiAthletes = filteredAthletes.filter(a => a.profileIds && a.profileIds.length > 1);
    if (multiApiAthletes.length > 0) {
      console.log(`🔗 Athletes found in BOTH APIs (${multiApiAthletes.length}):`);
      multiApiAthletes.forEach(a => {
        console.log(`   - ${a.name}: ${a.profileIds.length} IDs = ${JSON.stringify(a.profileIds)}`);
      });
    }

    return filteredAthletes;
  }

  // Legacy error handling fallback
  async searchAthletesLegacy(searchTerm) {
    const token = await this.getAccessToken();

    try {
      const response = await axios.get(
        `${this.config.profileUrl}/profiles`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          params: {
            tenantId: this.config.tenantId,
            limit: 500
          }
        }
      );

      if (response.data && response.data.profiles) {
        return response.data.profiles;
      }

      return [];

    } catch (error) {
      console.error('Error searching athletes from profiles:', error.response?.data || error.message);

      // If profiles endpoint fails, try getting recent tests and extract athletes
      try {
        const modifiedFromUtc = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago

        const response = await axios.get(
          `${this.config.forceDecksUrl}/tests`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            params: {
              TenantId: this.config.tenantId,
              ModifiedFromUtc: modifiedFromUtc,
              limit: 200
            }
          }
        );

        // Extract unique athletes from test data
        const athleteMap = new Map();

        if (response.data && response.data.tests) {
          response.data.tests.forEach(test => {
            const athleteName = test.athleteName || test.profileName || '';
            const athleteId = test.profileId || test.athleteId || test.id;

            if (searchTerm && athleteName.toLowerCase().includes(searchTerm.toLowerCase())) {
              if (!athleteMap.has(athleteId)) {
                athleteMap.set(athleteId, {
                  id: athleteId,
                  name: athleteName,
                  firstName: test.firstName || '',
                  lastName: test.lastName || '',
                  fullName: athleteName,
                  organization: test.organization || test.team || '',
                  sport: test.sport || '',
                  position: test.position || '',
                  lastTestDate: test.testDate
                });
              }
            }
          });
        }

        const athletes = Array.from(athleteMap.values());
        console.log(`Found ${athletes.length} athletes from tests matching "${searchTerm}"`);
        return athletes;

      } catch (testError) {
        console.error('Alternative ForceDecks endpoint also failed:', testError.response?.data || testError.message);
        return [];
      }
    }
  }

  /**
   * Get athlete profile by ID
   */
  async getAthleteProfile(profileId) {
    const token = await this.getAccessToken();

    try {
      // Try the profiles endpoint with the profile ID
      const response = await axios.get(
        `${this.config.profileUrl}/profiles/${profileId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          params: {
            tenantId: this.config.tenantId
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Error fetching athlete profile ${profileId}:`, error.response?.data || error.message);

      // If that fails, try getting the profile from test data
      try {
        const tests = await this.getForceDecksTests(profileId);
        if (tests.data && tests.data.length > 0) {
          // Extract profile info from the first test
          const test = tests.data[0];
          return {
            id: profileId,
            firstName: test.firstName || '',
            lastName: test.lastName || '',
            fullName: test.athleteName || test.profileName || '',
            organization: test.organization || '',
            sport: test.sport || '',
            position: test.position || ''
          };
        }
      } catch (testError) {
        console.error('Could not get profile from tests either:', testError.message);
      }

      throw error;
    }
  }

  /**
   * Get ForceDecks test data for an athlete or recent tests (searches both APIs)
   */
  async getForceDecksTests(profileId = null, testType = null) {
    const allTests = [];
    const modifiedFromUtc = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();

    // Convert single profileId to array, or use the array if provided
    const profileIds = Array.isArray(profileId) ? profileId : (profileId ? [profileId] : []);

    // Helper function to fetch from a specific config
    const fetchFromApi = async (config, token, source, specificProfileId = null) => {
      try {
        const endpoint = `${config.forceDecksUrl}/tests`;
        const params = {
          TenantId: config.tenantId,
          ModifiedFromUtc: modifiedFromUtc,
          limit: 100,
          IncludeExtendedParameters: true,
          IncludeAttributes: true
        };

        if (specificProfileId) {
          params.ProfileId = specificProfileId;
        }

        if (testType) {
          params.TestType = testType;
        }

        const response = await axios.get(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          params
        });

        if (response.data) {
          const tests = response.data.tests || response.data.data || [];

          // Add source to each test
          const testsWithSource = tests.map(test => ({
            ...test,
            apiSource: source
          }));

          console.log(`📊 ${source} API: Found ${testsWithSource.length} tests${testType ? ` (${testType})` : ''}${specificProfileId ? ` for profile ${specificProfileId}` : ''}`);
          return testsWithSource;
        }

        return [];
      } catch (error) {
        console.error(`Error fetching tests from ${source} API:`, error.response?.data || error.message);
        return [];
      }
    };

    // If profileIds provided, fetch tests for each profile ID from both APIs
    if (profileIds.length > 0) {
      console.log(`🔍 Fetching tests for ${profileIds.length} profile ID(s):`, profileIds);

      for (const pid of profileIds) {
        // Try Primary API
        const token = await this.getAccessToken();
        const primaryTests = await fetchFromApi(this.config, token, 'Primary', pid);
        allTests.push(...primaryTests);

        // Try Secondary API (if configured)
        if (this.config2) {
          const token2 = await this.getAccessToken2();
          if (token2) {
            const secondaryTests = await fetchFromApi(this.config2, token2, 'Secondary', pid);
            allTests.push(...secondaryTests);
          }
        }
      }
    } else {
      // No specific profileIds - fetch all recent tests from both APIs
      const token = await this.getAccessToken();
      const primaryTests = await fetchFromApi(this.config, token, 'Primary', null);
      allTests.push(...primaryTests);

      if (this.config2) {
        const token2 = await this.getAccessToken2();
        if (token2) {
          const secondaryTests = await fetchFromApi(this.config2, token2, 'Secondary', null);
          allTests.push(...secondaryTests);
        }
      }
    }

    // Log the full structure of the first test (if any)
    if (allTests.length > 0 && profileIds.length > 0) {
      console.log(`🔍 VALD API Response - First Test from ${allTests[0].apiSource}:`);
      console.log(JSON.stringify(allTests[0], null, 2).substring(0, 2000));
    }

    console.log(`🎯 Total: Found ${allTests.length} tests across ${this.config2 ? 'both' : 'primary'} API(s)`);

    return {
      data: allTests,
      total: allTests.length
    };
  }

  /**
   * Get detailed test results by test ID (includes all metrics)
   * This matches the get_FD_results() function from the Python script
   */
  /**
   * Transform trials data into flat metric structure
   * Converts VALD's nested results array into direct properties matching BigQuery column names
   */
  transformTrialsToMetrics(trialsData) {
    const metrics = {};

    if (!trialsData || !Array.isArray(trialsData) || trialsData.length === 0) {
      return metrics;
    }

    // Normalize compound units by replacing full names with abbreviations
    const normalizeUnit = (unitStr) => {
      if (!unitStr) return '';

      // Replace unit names with abbreviations, maintaining underscores
      return unitStr
        .replace(/Centimeter/g, 'cm')
        .replace(/Millimeter/g, 'mm')
        .replace(/Meter/g, 'm')
        .replace(/Inch/g, 'in')
        .replace(/Newton/g, 'N')
        .replace(/Watt/g, 'W')
        .replace(/Kilo/g, 'kg')
        .replace(/Pound/g, 'lb')
        .replace(/Millisecond/g, 'ms')
        .replace(/Second/g, 's')
        .replace(/Percent/g, 'percent')
        .replace(/_Per_/g, '_per_')  // Normalize "Per" to lowercase with underscores
        .replace(/\sPer\s/g, '_per_')  // Handle space-separated "Per"
        .replace(/\s+/g, '_');  // Replace all remaining spaces with underscores
    };

    // Process all trials (usually just one trial per test)
    for (const trial of trialsData) {
      if (!trial.results || !Array.isArray(trial.results)) continue;

      // Extract each result and map to expected field names
      for (const result of trial.results) {
        if (!result.definition || !result.definition.result) continue;

        const resultName = result.definition.result;
        const limb = result.limb || 'Trial';
        const unit = result.definition.unit || '';

        // Build the field name in BigQuery format: METRIC_NAME_Limb_unit
        // Example: JUMP_HEIGHT_Trial_cm
        let fieldName = `${resultName}_${limb}`;

        // Add unit suffix if present
        if (unit) {
          // Normalize the unit name to match BigQuery convention
          const normalizedUnit = normalizeUnit(unit);
          fieldName += `_${normalizedUnit}`;
        }

        // Store the value
        metrics[fieldName] = result.value;
      }
    }

    return metrics;
  }

  async getTestDetails(testObj) {
    // Extract testId from the test object
    const testId = testObj.testId || testObj.id;

    if (!testId) {
      console.error('No testId found in test object');
      return null;
    }

    // Determine which API to use based on the test's source
    const useSecondary = testObj.apiSource === 'Secondary';
    const config = useSecondary ? this.config2 : this.config;
    const token = useSecondary ? await this.getAccessToken2() : await this.getAccessToken();

    if (!token) {
      console.error(`No token available for ${useSecondary ? 'Secondary' : 'Primary'} API`);
      return null;
    }

    try {
      // Fetch test trials (actual metrics data) using the v2019q3 API
      const response = await axios.get(`${config.forceDecksUrl}/v2019q3/teams/${config.tenantId}/tests/${testId}/trials`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`📊 Fetched detailed test trials for ${testId} from ${useSecondary ? 'Secondary' : 'Primary'} API`);

      // Transform the nested trials structure into flat metrics
      const metrics = this.transformTrialsToMetrics(response.data);

      console.log(`📊 Extracted ${Object.keys(metrics).length} metrics from trials`);
      console.log(`📊 Sample metrics:`, Object.keys(metrics).slice(0, 5));

      // DEBUG: Log RSI fields to file for easier debugging
      const logPath = path.join(__dirname, '..', '..', 'rsi-debug.log');
      let logMessage = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      logMessage += `🔍 RSI FIELD DETECTION - TEST ID: ${testId}\n`;
      logMessage += `Test Type: ${testObj.testType || 'Unknown'}\n`;
      logMessage += `Time: ${new Date().toISOString()}\n\n`;

      const allFieldNames = Object.keys(metrics);
      const rsiRelatedFields = allFieldNames.filter(key =>
        key.includes('FLIGHT') ||
        key.includes('CONTRACTION') ||
        key.includes('RATIO') ||
        key.includes('RSI')
      );

      if (rsiRelatedFields.length > 0) {
        logMessage += `✅ RSI-RELATED FIELDS FOUND: ${rsiRelatedFields.length}\n`;
        rsiRelatedFields.forEach(field => {
          logMessage += `   📊 ${field} = ${metrics[field]}\n`;
        });
      } else {
        logMessage += '❌ NO RSI-RELATED FIELDS FOUND\n';
        logMessage += `📋 First 20 available fields:\n`;
        allFieldNames.slice(0, 20).forEach(field => {
          logMessage += `   - ${field}\n`;
        });
      }
      logMessage += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

      // Write to log file
      try {
        fs.appendFileSync(logPath, logMessage);
        console.log('📝 RSI field info written to rsi-debug.log');
      } catch (err) {
        console.error('Error writing to RSI debug log:', err);
      }

      // Add BigQuery field name aliases for fields that don't match
      // VALD API uses different naming than BigQuery database
      const bigQueryAliases = {};

      // Map VALD field names to BigQuery column names
      if (metrics['CONCENTRIC_IMPULSE_Trial_N_s']) {
        bigQueryAliases['CONCENTRIC_IMPULSE_Trial_Ns'] = metrics['CONCENTRIC_IMPULSE_Trial_N_s'];
      }
      if (metrics['RSI_MODIFIED_Trial_RSIModified']) {
        bigQueryAliases['RSI_MODIFIED_Trial_RSI_mod'] = metrics['RSI_MODIFIED_Trial_RSIModified'];
      }

      // Map standard RSI (FLIGHT_CONTRACTION_TIME_RATIO) with comprehensive field name matching
      // Try all possible RSI field name variations from VALD API
      const rsiFieldVariations = [
        'FLIGHT_CONTRACTION_TIME_RATIO_Trial_No_Unit',  // ACTUAL field name from VALD API
        'FLIGHT_CONTRACTION_TIME_RATIO_Trial_',
        'FLIGHT_CONTRACTION_TIME_RATIO_Trial',
        'FLIGHT__CONTRACTION_TIME_RATIO_Trial_',  // Double underscore variation
        'FLIGHT__CONTRACTION_TIME_RATIO_Trial',
        'RSI_Trial_',
        'RSI_Trial',
        'CMJ_RSI_Trial_',
        'CMJ_RSI_Trial',
        'SLJ_RSI_Trial_',  // For Single Leg Jump
        'SLJ_RSI_Trial',
        'SLJ_RSI_Left_',   // For Single Leg Jump Left
        'SLJ_RSI_Left',
        'SLJ_RSI_Right_',  // For Single Leg Jump Right
        'SLJ_RSI_Right'
      ];

      let rsiFound = false;
      for (const fieldName of rsiFieldVariations) {
        if (metrics[fieldName] !== undefined && metrics[fieldName] !== null) {
          bigQueryAliases['FLIGHT_CONTRACTION_TIME_RATIO_Trial_'] = metrics[fieldName];
          console.log(`✅ Found RSI field "${fieldName}":`, metrics[fieldName]);
          rsiFound = true;
          break;
        }
      }

      if (!rsiFound) {
        console.log('⚠️  Standard RSI field not found. Tried:', rsiFieldVariations.join(', '));
        console.log('📋 Available metrics that might be RSI:',
          Object.keys(metrics).filter(k => k.includes('RSI') || k.includes('FLIGHT') || k.includes('CONTRACTION') || k.includes('RATIO'))
        );
      }

      // Handle limb-specific RSI fields for Single Leg CMJ
      // These need to be mapped to FLIGHT_CONTRACTION_TIME_RATIO_Left_ and FLIGHT_CONTRACTION_TIME_RATIO_Right_
      const leftRsiVariations = [
        'FLIGHT_CONTRACTION_TIME_RATIO_Left_No_Unit',  // Likely actual field name
        'FLIGHT_CONTRACTION_TIME_RATIO_Left_',
        'FLIGHT_CONTRACTION_TIME_RATIO_Left',
        'FLIGHT__CONTRACTION_TIME_RATIO_Left_',
        'FLIGHT__CONTRACTION_TIME_RATIO_Left',
        'RSI_Left_',
        'RSI_Left',
        'SLJ_RSI_Left_',
        'SLJ_RSI_Left'
      ];

      const rightRsiVariations = [
        'FLIGHT_CONTRACTION_TIME_RATIO_Right_No_Unit',  // Likely actual field name
        'FLIGHT_CONTRACTION_TIME_RATIO_Right_',
        'FLIGHT_CONTRACTION_TIME_RATIO_Right',
        'FLIGHT__CONTRACTION_TIME_RATIO_Right_',
        'FLIGHT__CONTRACTION_TIME_RATIO_Right',
        'RSI_Right_',
        'RSI_Right',
        'SLJ_RSI_Right_',
        'SLJ_RSI_Right'
      ];

      // Check for Left limb RSI
      for (const fieldName of leftRsiVariations) {
        if (metrics[fieldName] !== undefined && metrics[fieldName] !== null) {
          bigQueryAliases['FLIGHT_CONTRACTION_TIME_RATIO_Left_'] = metrics[fieldName];
          console.log(`✅ Found Left RSI field "${fieldName}":`, metrics[fieldName]);
          break;
        }
      }

      // Check for Right limb RSI
      for (const fieldName of rightRsiVariations) {
        if (metrics[fieldName] !== undefined && metrics[fieldName] !== null) {
          bigQueryAliases['FLIGHT_CONTRACTION_TIME_RATIO_Right_'] = metrics[fieldName];
          console.log(`✅ Found Right RSI field "${fieldName}":`, metrics[fieldName]);
          break;
        }
      }

      // Merge the metrics with the original test metadata
      return {
        ...testObj,
        ...metrics,
        ...bigQueryAliases, // Add BigQuery aliases last so they override VALD names
        trials: response.data // Keep original trials data for reference
      };
    } catch (error) {
      console.error(`Error fetching test trials for ${testId}:`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get latest CMJ test for an athlete
   */
  async getLatestCMJ(profileId) {
    const tests = await this.getForceDecksTests(profileId, 'CMJ');

    if (tests && tests.data && tests.data.length > 0) {
      // Sort by test date and get the latest
      const sortedTests = tests.data.sort((a, b) =>
        new Date(b.testDate) - new Date(a.testDate)
      );
      return sortedTests[0];
    }

    return null;
  }

  /**
   * Get latest Squat Jump test
   */
  async getLatestSquatJump(profileId) {
    const tests = await this.getForceDecksTests(profileId, 'SJ');

    if (tests && tests.data && tests.data.length > 0) {
      const sortedTests = tests.data.sort((a, b) =>
        new Date(b.testDate) - new Date(a.testDate)
      );
      return sortedTests[0];
    }

    return null;
  }

  /**
   * Get latest IMTP test
   */
  async getLatestIMTP(profileId) {
    const tests = await this.getForceDecksTests(profileId, 'IMTP');

    if (tests && tests.data && tests.data.length > 0) {
      const sortedTests = tests.data.sort((a, b) =>
        new Date(b.testDate) - new Date(a.testDate)
      );
      return sortedTests[0];
    }

    return null;
  }


  /**
   * Get all jump test data for an athlete (for report generation)
   * Focuses only on ForceDecks jump tests, excluding dynamometer tests
   */
  async getAthleteTestData(profileId) {
    try {
      const [profile, forceDecksTests] = await Promise.all([
        this.getAthleteProfile(profileId),
        this.getForceDecksTests(profileId)
      ]);

      // Organize tests by type (jump tests only)
      const testData = {
        profile,
        forceDecks: {
          cmj: null,
          squatJump: null,
          imtp: null,
          singleLegCMJ_Left: null,
          singleLegCMJ_Right: null,
          hopTest: null,
          plyoPushUp: null,
          dropJump: null
        },
        asymmetries: {} // Will store asymmetry calculations
      };

      // Process ForceDecks tests
      if (forceDecksTests && forceDecksTests.data) {
        console.log(`📊 Found ${forceDecksTests.data.length} tests for athlete`);

        // Log all unique test types
        const testTypes = [...new Set(forceDecksTests.data.map(t => t.testType))];
        console.log(`   Test types found:`, testTypes);

        // Collect SLJ tests for special processing (need to check limb)
        const sljTests = forceDecksTests.data.filter(t => t.testType === 'SLJ' || t.testType === 'Single Leg Jump');

        forceDecksTests.data.forEach(test => {
          const testDate = new Date(test.testDate);

          // Log first test to see structure
          if (forceDecksTests.data.indexOf(test) === 0) {
            console.log('   Sample test data:', {
              testType: test.testType,
              testDate: test.testDate,
              hasJumpHeight: !!test.JUMP_HEIGHT_IMP_MOM_Trial_cm
            });
          }

          switch(test.testType) {
            case 'CMJ':
            case 'CMJ (Arms)':
            case 'Countermovement Jump':
              console.log(`✅ Found CMJ test from ${test.testDate}`);
              if (!testData.forceDecks.cmj || new Date(testData.forceDecks.cmj.testDate) < testDate) {
                testData.forceDecks.cmj = test;
              }
              break;
            case 'SJ':
            case 'Squat Jump':
              console.log(`✅ Found SJ test from ${test.testDate}`);
              if (!testData.forceDecks.squatJump || new Date(testData.forceDecks.squatJump.testDate) < testDate) {
                testData.forceDecks.squatJump = test;
              }
              break;
            case 'SLJ':
            case 'Single Leg Jump':
              // Skip here - will process SLJ tests separately below to check limb
              console.log(`✅ Found SLJ test from ${test.testDate} - will check limb`);
              break;
            case 'IMTP':
            case 'Isometric Mid-Thigh Pull':
              console.log(`✅ Found IMTP test from ${test.testDate}`);
              if (!testData.forceDecks.imtp || new Date(testData.forceDecks.imtp.testDate) < testDate) {
                testData.forceDecks.imtp = test;
              }
              break;
            case 'Single Leg CMJ - Left':
            case 'SL CMJ - Left':
              if (!testData.forceDecks.singleLegCMJ_Left || new Date(testData.forceDecks.singleLegCMJ_Left.testDate) < testDate) {
                testData.forceDecks.singleLegCMJ_Left = test;
              }
              break;
            case 'Single Leg CMJ - Right':
            case 'SL CMJ - Right':
              if (!testData.forceDecks.singleLegCMJ_Right || new Date(testData.forceDecks.singleLegCMJ_Right.testDate) < testDate) {
                testData.forceDecks.singleLegCMJ_Right = test;
              }
              break;
            case 'Drop Jump':
            case 'DJ':
              if (!testData.forceDecks.dropJump || new Date(testData.forceDecks.dropJump.testDate) < testDate) {
                testData.forceDecks.dropJump = test;
              }
              break;
            case 'Hop Test':
            case 'Single Leg Hop':
              if (!testData.forceDecks.hopTest || new Date(testData.forceDecks.hopTest.testDate) < testDate) {
                testData.forceDecks.hopTest = test;
              }
              break;
            case 'Plyometric Push-Up':
            case 'PPU':
              if (!testData.forceDecks.plyoPushUp || new Date(testData.forceDecks.plyoPushUp.testDate) < testDate) {
                testData.forceDecks.plyoPushUp = test;
              }
              break;
          }
        });

        // Process SLJ tests - need to check trial.limb to determine left vs right
        if (sljTests.length > 0) {
          console.log(`📊 Processing ${sljTests.length} SLJ test(s) to check limb...`);

          for (const sljTest of sljTests) {
            try {
              // Fetch trial data to get limb information
              const token = await this.getAccessToken();
              const config = sljTest.apiSource === 'Secondary' ? this.config2 : this.config;

              const axios = (await import('axios')).default;
              const response = await axios.get(`${config.forceDecksUrl}/v2019q3/teams/${config.tenantId}/tests/${sljTest.testId}/trials`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });

              if (response.data && response.data.length > 0) {
                const trial = response.data[0];
                const limb = trial.limb; // 'Left' or 'Right'
                const testDate = new Date(sljTest.testDate);

                console.log(`   SLJ test ${sljTest.testId}: limb = ${limb}`);

                if (limb === 'Left') {
                  if (!testData.forceDecks.singleLegCMJ_Left || new Date(testData.forceDecks.singleLegCMJ_Left.testDate) < testDate) {
                    testData.forceDecks.singleLegCMJ_Left = sljTest;
                  }
                } else if (limb === 'Right') {
                  if (!testData.forceDecks.singleLegCMJ_Right || new Date(testData.forceDecks.singleLegCMJ_Right.testDate) < testDate) {
                    testData.forceDecks.singleLegCMJ_Right = sljTest;
                  }
                }
              }
            } catch (error) {
              console.error(`Error checking limb for SLJ test ${sljTest.testId}:`, error.message);
            }
          }
        }

        // Fetch detailed metrics for each test type by calling getTestDetails()
        console.log('📊 Fetching detailed metrics for each test type...');

        if (testData.forceDecks.cmj) {
          console.log('   Fetching CMJ metrics...');
          testData.forceDecks.cmj = await this.getTestDetails(testData.forceDecks.cmj);
        }

        if (testData.forceDecks.squatJump) {
          console.log('   Fetching SJ metrics...');
          testData.forceDecks.squatJump = await this.getTestDetails(testData.forceDecks.squatJump);
        }

        if (testData.forceDecks.imtp) {
          console.log('   Fetching IMTP metrics...');
          testData.forceDecks.imtp = await this.getTestDetails(testData.forceDecks.imtp);
        }

        if (testData.forceDecks.singleLegCMJ_Left) {
          console.log('   Fetching Single Leg CMJ Left metrics...');
          testData.forceDecks.singleLegCMJ_Left = await this.getTestDetails(testData.forceDecks.singleLegCMJ_Left);
        }

        if (testData.forceDecks.singleLegCMJ_Right) {
          console.log('   Fetching Single Leg CMJ Right metrics...');
          testData.forceDecks.singleLegCMJ_Right = await this.getTestDetails(testData.forceDecks.singleLegCMJ_Right);
        }

        if (testData.forceDecks.dropJump) {
          console.log('   Fetching Drop Jump metrics...');
          testData.forceDecks.dropJump = await this.getTestDetails(testData.forceDecks.dropJump);
        }

        if (testData.forceDecks.hopTest) {
          console.log('   Fetching Hop Test metrics...');
          testData.forceDecks.hopTest = await this.getTestDetails(testData.forceDecks.hopTest);
        }

        if (testData.forceDecks.plyoPushUp) {
          console.log('   Fetching Plyo Push-Up metrics...');
          testData.forceDecks.plyoPushUp = await this.getTestDetails(testData.forceDecks.plyoPushUp);
        }

        console.log('✅ Detailed metrics fetched for all test types');

        // Calculate asymmetries for bilateral tests
        if (testData.forceDecks.cmj && testData.forceDecks.cmj.leftPeakForce && testData.forceDecks.cmj.rightPeakForce) {
          testData.asymmetries.cmjPeakForce = this.calculateAsymmetry(
            testData.forceDecks.cmj.leftPeakForce,
            testData.forceDecks.cmj.rightPeakForce
          );
        }

        if (testData.forceDecks.singleLegCMJ_Left && testData.forceDecks.singleLegCMJ_Right) {
          testData.asymmetries.singleLegJumpHeight = this.calculateAsymmetry(
            testData.forceDecks.singleLegCMJ_Left.jumpHeight,
            testData.forceDecks.singleLegCMJ_Right.jumpHeight
          );
        }
      }

      return testData;
    } catch (error) {
      console.error('Error fetching athlete test data:', error);
      throw error;
    }
  }

  /**
   * Calculate asymmetry percentage
   */
  calculateAsymmetry(leftValue, rightValue) {
    if (leftValue === 0 && rightValue === 0) return 0;

    const diff = Math.abs(leftValue - rightValue);
    const avg = (leftValue + rightValue) / 2;
    const asymmetry = (diff / avg) * 100;

    return {
      percentage: asymmetry.toFixed(1),
      direction: leftValue > rightValue ? 'L' : 'R',
      color: asymmetry < 5 ? 'green' : asymmetry < 10 ? 'yellow' : 'red'
    };
  }
}

// Export the class instead of singleton to allow proper env loading
export default VALDApiService;