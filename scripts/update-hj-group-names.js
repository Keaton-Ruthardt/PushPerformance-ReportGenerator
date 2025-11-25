import 'dotenv/config';
import { query, bigquery, dataset } from '../server/config/bigquery.js';
import VALDApiService from '../server/services/valdApiService.js';

// Create service instance
const valdApiService = new VALDApiService();

// Rate limiter: 20 requests per 5 seconds
class RateLimiter {
  constructor(maxRequests = 20, windowMs = 5000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async waitIfNeeded() {
    const now = Date.now();

    // Remove requests older than the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    // If we've hit the limit, wait until the oldest request expires
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100; // +100ms buffer
      console.log(`    ⏳ Rate limit reached (${this.requests.length}/${this.maxRequests}), waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Clean up again after waiting
      const newNow = Date.now();
      this.requests = this.requests.filter(time => newNow - time < this.windowMs);
    }

    // Record this request
    this.requests.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(20, 5000);

// Cache for athlete groups to avoid redundant API calls
const athleteGroupsCache = new Map();

/**
 * Get athlete groups from VALD API
 */
async function getAthleteGroups(profileId) {
  // Check cache first
  if (athleteGroupsCache.has(profileId)) {
    return athleteGroupsCache.get(profileId);
  }

  try {
    // Wait for rate limiter
    await rateLimiter.waitIfNeeded();

    // Get all athletes (which includes group information)
    const allAthletes = await valdApiService.getAllAthletes();

    // Find this specific athlete by profileId
    const athlete = allAthletes.find(a =>
      a.id === profileId || a.profileIds.includes(profileId)
    );

    if (athlete && athlete.groups) {
      const groupNames = {
        group_name_1: athlete.groups[0]?.name || athlete.group_name_1 || null,
        group_name_2: athlete.groups[1]?.name || athlete.group_name_2 || null,
        group_name_3: athlete.groups[2]?.name || athlete.group_name_3 || null
      };

      // Cache the result
      athleteGroupsCache.set(profileId, groupNames);
      return groupNames;
    }

    return { group_name_1: null, group_name_2: null, group_name_3: null };
  } catch (error) {
    console.error(`  ❌ Error fetching groups for profile ${profileId}:`, error.message);
    return { group_name_1: null, group_name_2: null, group_name_3: null };
  }
}

/**
 * Main function to update group names
 */
async function updateGroupNames() {
  console.log('🚀 Updating group names in HJ_result_updated table...\n');

  try {
    // First, get all athletes with their groups to build cache
    console.log('📡 Fetching all athletes to build group cache...');
    const allAthletes = await valdApiService.getAllAthletes();
    console.log(`✅ Found ${allAthletes.length} athletes\n`);

    // Build cache
    allAthletes.forEach(athlete => {
      const groupNames = {
        group_name_1: athlete.groups?.[0]?.name || athlete.group_name_1 || null,
        group_name_2: athlete.groups?.[1]?.name || athlete.group_name_2 || null,
        group_name_3: athlete.groups?.[2]?.name || athlete.group_name_3 || null
      };

      // Cache for all profileIds this athlete has
      athlete.profileIds.forEach(profileId => {
        athleteGroupsCache.set(profileId, groupNames);
      });
    });

    console.log(`📦 Built cache for ${athleteGroupsCache.size} profile IDs\n`);

    // Get all distinct profile_ids from the table
    console.log('📊 Fetching distinct profile IDs from BigQuery...');
    const profileIdsSql = `
      SELECT DISTINCT profile_id, full_name
      FROM \`vald-ref-data-copy.${dataset}.HJ_result_updated\`
      WHERE group_name_1 IS NULL OR group_name_2 IS NULL OR group_name_3 IS NULL
      ORDER BY full_name
    `;

    const profileRows = await query(profileIdsSql);
    console.log(`✅ Found ${profileRows.length} unique profiles needing group updates\n`);

    let updated = 0;
    let notFound = 0;

    // Process each profile (only athletes 971-1200)
    const startIndex = 970; // 0-based index, so 970 = athlete #971
    const endIndex = 1200;

    for (let i = startIndex; i < Math.min(endIndex, profileRows.length); i++) {
      const row = profileRows[i];
      const profileId = row.profile_id;
      const fullName = row.full_name;

      console.log(`[${i + 1}/${profileRows.length}] ${fullName} (${profileId})`);

      // Get groups from cache
      const groupNames = athleteGroupsCache.get(profileId);

      if (!groupNames) {
        console.log(`  ⚠️  No groups found in cache`);
        notFound++;
        continue;
      }

      // Only update if we have at least one group name
      if (groupNames.group_name_1 || groupNames.group_name_2 || groupNames.group_name_3) {
        // Update all rows for this profile_id using BigQuery client directly
        const updateSql = `
          UPDATE \`vald-ref-data-copy.${dataset}.HJ_result_updated\`
          SET
            group_name_1 = @group_name_1,
            group_name_2 = @group_name_2,
            group_name_3 = @group_name_3,
            updated_at = CURRENT_TIMESTAMP()
          WHERE profile_id = @profile_id
        `;

        const options = {
          query: updateSql,
          location: 'US',
          params: {
            profile_id: profileId,
            group_name_1: groupNames.group_name_1,
            group_name_2: groupNames.group_name_2,
            group_name_3: groupNames.group_name_3
          },
          types: {
            profile_id: 'STRING',
            group_name_1: 'STRING',
            group_name_2: 'STRING',
            group_name_3: 'STRING'
          }
        };

        await bigquery.query(options);

        console.log(`  ✅ Updated: ${groupNames.group_name_1 || 'N/A'}, ${groupNames.group_name_2 || 'N/A'}, ${groupNames.group_name_3 || 'N/A'}`);
        updated++;
      } else {
        console.log(`  ⚠️  No group names available`);
        notFound++;
      }
    }

    console.log('\n\n✅ Update complete!');
    console.log(`📊 Profiles updated: ${updated}`);
    console.log(`📊 Profiles without groups: ${notFound}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateGroupNames();
