import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Check if Blake Weiman exists in VALD API
 */

async function checkBlakeInVald() {
  try {
    const profileId = '947548a9-b81f-474a-9863-6dc14a3078c4';

    console.log('🔍 Checking if Blake Weiman exists in VALD API...');
    console.log(`Profile ID: ${profileId}\n`);

    // Get access token
    const tokenResponse = await axios.post(
      process.env.AUTH_URL,
      {
        grant_type: 'client_credentials',
        client_id: process.env.VALD_API_KEY.replace(/"/g, ''),
        client_secret: process.env.VALD_API_SECRET.replace(/"/g, '')
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const token = tokenResponse.data.access_token;
    console.log('✅ Got access token\n');

    // Try to get profile by ID
    try {
      console.log('📊 Attempting to get profile directly...');
      const profileResponse = await axios.get(
        `${process.env.PROFILE_URL}/profiles/${profileId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Found profile:', JSON.stringify(profileResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Profile not found via direct lookup:', error.response?.status, error.response?.data || error.message);
    }

    // Try searching via groups endpoint
    console.log('\n📊 Checking all groups...');
    const groupsResponse = await axios.get(
      `${process.env.TENANT_URL}/groups`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          TenantId: process.env.TENANT_ID
        }
      }
    );

    const groups = groupsResponse.data.groups || groupsResponse.data || [];
    console.log(`Found ${groups.length} groups:`, groups.map(g => g.name));

    // Check each group for Blake
    let foundBlake = false;
    for (const group of groups) {
      try {
        console.log(`\n   Checking group "${group.name}" (${group.id})...`);
        const profilesResponse = await axios.get(
          `${process.env.PROFILE_URL}/profiles`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            params: {
              tenantId: process.env.TENANT_ID,
              groupId: group.id,
              limit: 500
            }
          }
        );

        const profiles = profilesResponse.data.profiles || [];
        console.log(`      Found ${profiles.length} profiles in this group`);

        const blake = profiles.find(p =>
          p.profileId === profileId ||
          (p.givenName?.toLowerCase() === 'blake' && p.familyName?.toLowerCase() === 'weiman')
        );

        if (blake) {
          console.log(`\n✅ FOUND Blake in group "${group.name}":`);
          console.log(JSON.stringify(blake, null, 2));
          foundBlake = true;
        } else {
          console.log(`      Blake NOT in this group`);
        }
      } catch (error) {
        console.log(`   ❌ Error checking group ${group.name}:`, error.response?.status, error.message);
      }
    }

    if (!foundBlake) {
      console.log('\n⚠️  Blake Weiman was NOT found in any VALD API group');
      console.log('   This is why he doesn\'t appear in the athlete search');
      console.log('   His data is in BigQuery but not in VALD API groups');
    }

    console.log('\n✅ Check complete');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkBlakeInVald();
