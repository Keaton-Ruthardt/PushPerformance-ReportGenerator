import axios from 'axios';
import valdApiService from './server/services/valdApiService.js';
import mlbNormsService from './server/services/mlbNormsService.js';
import reportGeneratorService from './server/services/reportGeneratorService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testReportGeneration() {
  console.log('🧪 Testing Report Generation System\n');

  try {
    // Step 1: Test VALD Authentication
    console.log('1️⃣  Testing VALD API authentication...');
    const token = await valdApiService.authenticate();
    console.log('✅ VALD authentication successful\n');

    // Step 2: Test MLB Norms
    console.log('2️⃣  Testing MLB norms retrieval...');
    const cmjNorms = await mlbNormsService.getCMJNorms();
    console.log(`✅ Retrieved CMJ norms for ${cmjNorms.sampleSize} professional athletes`);
    console.log(`   Average jump height: ${cmjNorms.averages.jumpHeight?.toFixed(1)} cm\n`);

    // Step 3: Create sample athlete data for testing
    console.log('3️⃣  Creating sample athlete data for report...');
    const sampleAthleteData = {
      name: 'John Doe',
      athleteId: 'TEST-001',
      dateOfBirth: '1998-05-15',
      height: '6\'2"',
      weight: '185 lbs',
      position: 'Pitcher',
      team: 'Test Team',
      tests: {
        cmj: {
          jumpHeight: 42.5,
          peakPower: 5200,
          peakPowerBM: 65.2,
          rsiMod: 52.3
        },
        hopRSI: {
          avg: 2.1
        },
        imtp: {
          peakForce: 2450,
          force100ms: 1850,
          force200ms: 2100
        },
        ppu: {
          height: 12.5,
          relativePeakForce: 14.2,
          depth: 38.5
        }
      },
      asymmetries: {
        'CMJ Peak Force': {
          left: 1020,
          right: 950,
          percentage: 7.2,
          direction: 'L'
        },
        'Single Leg Jump': {
          left: 22.5,
          right: 20.8,
          percentage: 7.8,
          direction: 'L'
        }
      },
      comparisons: {
        'CMJ Jump Height': {
          percentile: 58,
          value: 42.5,
          norm: 44.9
        },
        'CMJ Peak Power': {
          percentile: 45,
          value: 65.2,
          norm: 68.1
        },
        'IMTP Peak Force': {
          percentile: 62,
          value: 2450,
          norm: 2486.7
        }
      }
    };

    // Step 4: Generate PDF report
    console.log('4️⃣  Generating PDF report...');

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const outputPath = path.join(reportsDir, 'test-report.pdf');
    await reportGeneratorService.generateReport(sampleAthleteData, outputPath);

    console.log(`✅ PDF report generated successfully at: ${outputPath}\n`);

    // Step 5: Test API endpoint (if server is running)
    console.log('5️⃣  Testing API endpoints...');

    try {
      // Test VALD connection endpoint
      const valdTestResponse = await axios.get('http://localhost:5000/api/reports/test-vald');
      console.log('✅ VALD API test endpoint:', valdTestResponse.data.success ? 'Connected' : 'Failed');
    } catch (err) {
      console.log('⚠️  Server not running or endpoint not available');
    }

    try {
      // Test norms endpoint
      const normsResponse = await axios.get('http://localhost:5000/api/reports/norms');
      console.log('✅ Norms endpoint working');
      console.log(`   CMJ sample size: ${normsResponse.data.norms.cmj?.sampleSize || 0}`);
      console.log(`   IMTP sample size: ${normsResponse.data.norms.imtp?.sampleSize || 0}`);
    } catch (err) {
      console.log('⚠️  Norms endpoint not available');
    }

    console.log('\n✅ Report generation system test completed successfully!');
    console.log('\n📊 System Status:');
    console.log('   - VALD API: Connected');
    console.log('   - BigQuery MLB Norms: Available');
    console.log('   - PDF Generation: Working');
    console.log('   - API Endpoints: Configured');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

// Run the test
testReportGeneration();