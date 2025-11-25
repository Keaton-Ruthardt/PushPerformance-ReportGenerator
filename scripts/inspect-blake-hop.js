import 'dotenv/config';
import axios from 'axios';

async function inspectBlakeHop() {
  try {
    const testId = 'ab064ce3-e9df-48ea-8b94-8fb3ac3f76b5'; // Blake's hop test from Oct 2024
    const tenantId = process.env.TENANT_ID_2;
    const forceDecksUrl = process.env.FORCEDECKS_URL;

    console.log('🔍 Fetching Blake Weiman hop test details...\\n');

    // Get token from Secondary API
    const authResponse = await axios.post(process.env.AUTH_URL, {
      grant_type: 'client_credentials',
      client_id: process.env.VALD_API_KEY_2.replace(/"/g, ''),
      client_secret: process.env.VALD_API_SECRET_2.replace(/"/g, '')
    }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const token = authResponse.data.access_token;

    // Fetch trials for this hop test
    const trialsResponse = await axios.get(
      `${forceDecksUrl}/v2019q3/teams/${tenantId}/tests/${testId}/trials`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const trials = trialsResponse.data;

    if (trials && trials.length > 0) {
      console.log(`📊 Found ${trials.length} trials\\n`);

      const firstTrial = trials[0];

      console.log('🔍 FIRST TRIAL RESULTS:');
      console.log('==========================================');

      if (firstTrial.results && Array.isArray(firstTrial.results)) {
        // Filter for fields that might be hop-specific
        const relevantFields = firstTrial.results.filter(r => {
          const fieldName = r.definition?.result || '';
          return fieldName.includes('RSI') ||
                 fieldName.includes('JUMP') ||
                 fieldName.includes('HEIGHT') ||
                 fieldName.includes('GCT') ||
                 fieldName.includes('CONTACT') ||
                 fieldName.includes('GROUND');
        });

        console.log(`\\nFound ${relevantFields.length} potentially relevant fields:\\n`);

        relevantFields.forEach((result, idx) => {
          console.log(`${idx + 1}. ${result.definition.result}`);
          console.log(`   Limb: ${result.limb || 'N/A'}`);
          console.log(`   Unit: ${result.definition.unit || 'N/A'}`);
          console.log(`   Value: ${result.value}`);
          console.log('');
        });

        console.log('\\n📋 ALL FIELD NAMES:');
        console.log('==========================================');
        const allFieldNames = firstTrial.results
          .map(r => r.definition?.result)
          .filter(Boolean)
          .sort();
        allFieldNames.forEach((name, idx) => {
          console.log(`${idx + 1}. ${name}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

inspectBlakeHop();
