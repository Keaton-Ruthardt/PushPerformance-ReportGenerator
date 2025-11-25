import axios from 'axios';
import fs from 'fs';

/**
 * Test the new /api/reports/generate-cmj-pdf endpoint
 * This will:
 * 1. Search for a real athlete
 * 2. Generate a CMJ comparative PDF for them
 */

const API_BASE = 'http://localhost:5000';

async function testCMJPDFGeneration() {
  try {
    console.log('=== TESTING CMJ PDF GENERATION WITH REAL ATHLETE DATA ===\n');

    // Step 1: Search for athletes
    console.log('Step 1: Searching for athletes...');
    const searchResponse = await axios.get(`${API_BASE}/api/athletes/search?term=`);

    if (!searchResponse.data.success || searchResponse.data.athletes.length === 0) {
      console.log('❌ No athletes found');
      return;
    }

    console.log(`✅ Found ${searchResponse.data.athletes.length} athletes\n`);

    // Display first 5
    console.log('First 5 athletes:');
    searchResponse.data.athletes.slice(0, 5).forEach((athlete, i) => {
      console.log(`  ${i + 1}. ${athlete.name} (ID: ${athlete.id})`);
      console.log(`     Position: ${athlete.position || 'N/A'}, Team: ${athlete.team || 'N/A'}`);
    });

    // Step 2: Try to generate PDF for each athlete until we find one with CMJ data
    console.log('\nStep 2: Attempting to generate CMJ PDF...\n');

    let pdfGenerated = false;
    for (let i = 0; i < Math.min(searchResponse.data.athletes.length, 10); i++) {
      const athlete = searchResponse.data.athletes[i];

      console.log(`\nTrying athlete ${i + 1}: ${athlete.name} (${athlete.id})`);

      try {
        const pdfResponse = await axios.post(
          `${API_BASE}/api/reports/generate-cmj-pdf`,
          {
            athleteId: athlete.id,
            name: athlete.name
          },
          {
            responseType: 'arraybuffer',
            timeout: 30000
          }
        );

        // Save the PDF
        const filename = `test_cmj_report_${athlete.name.replace(/\s+/g, '_')}.pdf`;
        fs.writeFileSync(filename, pdfResponse.data);

        console.log(`\n✅ SUCCESS! PDF generated for ${athlete.name}`);
        console.log(`📄 PDF saved as: ${filename}`);
        console.log(`📊 File size: ${(pdfResponse.data.byteLength / 1024).toFixed(2)} KB`);

        pdfGenerated = true;
        break;

      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`  ⚠️  No CMJ data found for this athlete - trying next...`);
        } else {
          console.log(`  ❌ Error: ${error.response?.data?.message || error.message}`);
        }
      }
    }

    if (!pdfGenerated) {
      console.log('\n❌ Could not find any athlete with CMJ data in the first 10 results');
      console.log('Try running the test again or search for a specific athlete with CMJ data');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
console.log('Starting CMJ PDF generation test...\n');
testCMJPDFGeneration().then(() => {
  console.log('\n=== TEST COMPLETE ===\n');
});
