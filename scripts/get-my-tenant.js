import { getValdApiClient } from './server/services/valdAuthService.js';
import dotenv from 'dotenv';

dotenv.config();

const TENANT_URL = process.env.TENANT_URL;

console.log('\n🔍 Fetching Your VALD Tenants...\n');
console.log('='.repeat(70));
console.log(`Using: ${TENANT_URL}\n`);

try {
  // Step 1: Authenticate
  console.log('📝 Step 1: Authenticating...\n');
  const client = await getValdApiClient();
  client.defaults.baseURL = TENANT_URL;
  console.log('✅ Authentication successful!\n');

  // Step 2: Fetch tenants (Scenario 1)
  console.log('📝 Step 2: Fetching all tenants you have access to...\n');
  const response = await client.get('/tenants');

  console.log('✅ HTTP Status:', response.status, response.statusText);
  console.log('\n' + '='.repeat(70));

  if (response.data && response.data.length > 0) {
    console.log(`\n✅ Found ${response.data.length} tenant(s):\n`);

    response.data.forEach((tenant, index) => {
      console.log(`${index + 1}. ${tenant.name || 'Unnamed Tenant'}`);
      console.log(`   ID: ${tenant.id}`);
      console.log('');
    });

    console.log('='.repeat(70));
    console.log('\n📋 NEXT STEPS:\n');
    console.log('1. Copy the ID of YOUR tenant from the list above');
    console.log('2. Update your .env file:');
    console.log('   TENANT_ID=<paste-your-tenant-id-here>');
    console.log('\n');

  } else {
    console.log('\n⚠️  No tenants found.\n');
    console.log('Possible reasons:');
    console.log('  1. Your API credentials may not have access to any tenants');
    console.log('  2. Your account may not be properly configured');
    console.log('  3. You may be using the wrong region URL\n');
    console.log('📞 SOLUTION: Contact VALD Support\n');
    console.log('Email: support@vald.com');
    console.log('Subject: Request Tenant Access for External API');
    console.log('\nMessage:');
    console.log('---');
    console.log('Hi VALD Support,');
    console.log('');
    console.log('I am trying to use the External Tenants API but receiving');
    console.log('zero tenants when calling GET /tenants.');
    console.log('');
    console.log('My API credentials:');
    console.log('- Client ID: mFQIP7I5RvfzU1Q==');
    console.log('- Region: US East');
    console.log('');
    console.log('Could you please:');
    console.log('1. Provide my tenant ID');
    console.log('2. Confirm my API key has proper tenant access');
    console.log('');
    console.log('Thank you!');
    console.log('---\n');
  }

  console.log('='.repeat(70) + '\n');

} catch (error) {
  console.log('\n❌ ERROR:', error.message);
  console.log('\nDetails:');
  console.log('  Status:', error.response?.status);
  console.log('  Message:', error.response?.data?.message || error.response?.statusText);
  console.log('  Data:', JSON.stringify(error.response?.data, null, 2));
  console.log('\n');
}
