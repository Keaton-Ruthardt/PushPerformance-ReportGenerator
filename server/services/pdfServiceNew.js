import puppeteer from 'puppeteer';

/**
 * Generate modern, visually appealing HTML template for PDF report
 */
const generateReportHTML = (reportData) => {
  const {
    athleteName,
    age,
    sport,
    position,
    schoolTeam,
    assessmentDate,
    height,
    bodyMass,
    currentInjuries,
    injuryHistory,
    posturePresentation,
    movementAnalysisSummary,
    trainingGoals,
    actionPlan,
    testResults = [],
  } = reportData;

  // Format date
  const formattedDate = assessmentDate
    ? new Date(assessmentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  // Test type display names
  const testTypeNames = {
    'cmj': 'Countermovement Jump (CMJ)',
    'sj': 'Squat Jump (SJ)',
    'ht': 'Hop Test (HT)',
    'slcmj': 'Single Leg Countermovement Jump',
    'imtp': 'Isometric Mid-Thigh Pull (IMTP)',
    'ppu': 'Plyometric Push-Up (PPU)',
  };

  // Render individual test metrics dynamically
  const renderTestMetrics = (testData) => {
    if (!testData || typeof testData !== 'object') return '';

    const metrics = Object.entries(testData)
      .filter(([key]) => key !== 'asymmetry') // Handle asymmetry separately
      .map(([key, value]) => {
        const label = key
          .replace(/_/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .trim();

        return `
          <div class="metric-card">
            <div class="metric-label">${label}</div>
            <div class="metric-value">${typeof value === 'number' ? value.toFixed(2) : value}</div>
          </div>
        `;
      }).join('');

    return `<div class="metrics-grid">${metrics}</div>`;
  };

  // Render individual test section
  const renderTestSection = (test) => {
    const testName = testTypeNames[test.testType?.toLowerCase()] || test.testType || 'Unknown Test';
    const hasData = test.data && Object.keys(test.data).length > 0;

    if (!hasData) return '';

    return `
      <div class="test-section">
        <div class="test-header">
          <h2 class="test-title">${testName}</h2>
        </div>
        ${renderTestMetrics(test.data)}
        ${test.keyTakeaways ? `
          <div class="takeaways-box">
            <div class="takeaways-icon">💡</div>
            <div>
              <div class="takeaways-title">Key Takeaways</div>
              <div class="takeaways-content">${test.keyTakeaways}</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        @page {
          size: A4;
          margin: 0;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
          color: #1f2937;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 0;
        }

        .page-container {
          background: white;
          max-width: 210mm;
          margin: 0 auto;
          padding: 40px 50px;
          min-height: 297mm;
        }

        /* Header Styling */
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px;
          margin: -40px -50px 40px -50px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect fill="rgba(255,255,255,0.1)" width="50" height="50"/><rect fill="rgba(255,255,255,0.05)" x="50" width="50" height="50"/></svg>');
          opacity: 0.1;
        }

        .logo {
          font-size: 56px;
          font-weight: 900;
          letter-spacing: -2px;
          margin-bottom: 10px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
          position: relative;
          z-index: 1;
        }

        .report-title {
          font-size: 24px;
          font-weight: 300;
          letter-spacing: 2px;
          opacity: 0.95;
          position: relative;
          z-index: 1;
        }

        /* Athlete Profile Card */
        .athlete-card {
          background: linear-gradient(135deg, #f6f8fb 0%, #ffffff 100%);
          border-radius: 16px;
          padding: 30px;
          margin-bottom: 30px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          border-left: 5px solid #667eea;
        }

        .athlete-name-header {
          font-size: 32px;
          font-weight: 800;
          color: #1f2937;
          margin-bottom: 20px;
        }

        .profile-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }

        .profile-item {
          background: white;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .profile-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: #6b7280;
          letter-spacing: 0.5px;
          margin-bottom: 5px;
        }

        .profile-value {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
        }

        /* Assessment Sections */
        .assessment-section {
          background: #f9fafb;
          border-radius: 12px;
          padding: 25px;
          margin-bottom: 25px;
          border-left: 4px solid #10b981;
        }

        .section-heading {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .section-icon {
          font-size: 24px;
        }

        .section-content {
          line-height: 1.8;
          color: #374151;
          white-space: pre-wrap;
        }

        /* Test Sections */
        .test-section {
          background: white;
          border-radius: 16px;
          padding: 30px;
          margin-bottom: 30px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.08);
          border: 1px solid #e5e7eb;
          page-break-inside: avoid;
        }

        .test-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px 25px;
          margin: -30px -30px 25px -30px;
          border-radius: 16px 16px 0 0;
        }

        .test-title {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        /* Metrics Grid */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }

        .metric-card {
          background: linear-gradient(135deg, #f6f8fb 0%, #ffffff 100%);
          padding: 20px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          transition: transform 0.2s;
        }

        .metric-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #6b7280;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .metric-value {
          font-size: 24px;
          font-weight: 800;
          color: #667eea;
        }

        /* Takeaways Box */
        .takeaways-box {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          gap: 15px;
          align-items: flex-start;
          border: 2px solid #fbbf24;
        }

        .takeaways-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .takeaways-title {
          font-size: 14px;
          font-weight: 700;
          color: #92400e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .takeaways-content {
          color: #78350f;
          line-height: 1.6;
          font-size: 14px;
        }

        /* Footer */
        .footer {
          text-align: center;
          padding: 30px 0;
          color: #9ca3af;
          font-size: 12px;
          border-top: 2px solid #e5e7eb;
          margin-top: 40px;
        }

        .page-break {
          page-break-after: always;
        }

        /* Print Optimizations */
        @media print {
          body {
            background: white;
          }

          .page-container {
            padding: 20px;
          }

          .test-section {
            box-shadow: none;
            border: 2px solid #e5e7eb;
          }
        }
      </style>
    </head>
    <body>
      <div class="page-container">
        <!-- Header -->
        <div class="header">
          <div class="logo">PUSH PERFORMANCE</div>
          <div class="report-title">ATHLETE ASSESSMENT REPORT</div>
        </div>

        <!-- Athlete Profile Card -->
        <div class="athlete-card">
          <div class="athlete-name-header">${athleteName || 'Athlete Name'}</div>
          <div class="profile-grid">
            ${age ? `
              <div class="profile-item">
                <div class="profile-label">Age</div>
                <div class="profile-value">${age} years</div>
              </div>
            ` : ''}
            ${sport ? `
              <div class="profile-item">
                <div class="profile-label">Sport</div>
                <div class="profile-value">${sport}</div>
              </div>
            ` : ''}
            ${position ? `
              <div class="profile-item">
                <div class="profile-label">Position</div>
                <div class="profile-value">${position}</div>
              </div>
            ` : ''}
            ${schoolTeam ? `
              <div class="profile-item">
                <div class="profile-label">Team/School</div>
                <div class="profile-value">${schoolTeam}</div>
              </div>
            ` : ''}
            ${height ? `
              <div class="profile-item">
                <div class="profile-label">Height</div>
                <div class="profile-value">${height}</div>
              </div>
            ` : ''}
            ${bodyMass ? `
              <div class="profile-item">
                <div class="profile-label">Body Mass</div>
                <div class="profile-value">${bodyMass} lbs</div>
              </div>
            ` : ''}
            <div class="profile-item">
              <div class="profile-label">Assessment Date</div>
              <div class="profile-value">${formattedDate}</div>
            </div>
          </div>
        </div>

        <!-- Assessment Sections -->
        ${currentInjuries ? `
          <div class="assessment-section">
            <div class="section-heading">
              <span class="section-icon">🏥</span>
              Current Injuries
            </div>
            <div class="section-content">${currentInjuries}</div>
          </div>
        ` : ''}

        ${injuryHistory ? `
          <div class="assessment-section">
            <div class="section-heading">
              <span class="section-icon">📋</span>
              Injury History
            </div>
            <div class="section-content">${injuryHistory}</div>
          </div>
        ` : ''}

        ${posturePresentation ? `
          <div class="assessment-section">
            <div class="section-heading">
              <span class="section-icon">🧍</span>
              Posture Presentation
            </div>
            <div class="section-content">${posturePresentation}</div>
          </div>
        ` : ''}

        ${movementAnalysisSummary ? `
          <div class="assessment-section">
            <div class="section-heading">
              <span class="section-icon">🏃</span>
              Movement Analysis
            </div>
            <div class="section-content">${movementAnalysisSummary}</div>
          </div>
        ` : ''}

        <div class="page-break"></div>

        <!-- Force Plate Test Results -->
        <h1 style="font-size: 32px; font-weight: 800; margin-bottom: 30px; color: #111827;">Force Plate Test Results</h1>

        ${testResults.map(test => renderTestSection(test)).join('')}

        <!-- Training Goals & Action Plan -->
        ${trainingGoals ? `
          <div class="page-break"></div>
          <div class="assessment-section" style="border-left-color: #3b82f6;">
            <div class="section-heading">
              <span class="section-icon">🎯</span>
              Training Goals
            </div>
            <div class="section-content">${trainingGoals}</div>
          </div>
        ` : ''}

        ${actionPlan ? `
          <div class="assessment-section" style="border-left-color: #8b5cf6;">
            <div class="section-heading">
              <span class="section-icon">📝</span>
              Action Plan
            </div>
            <div class="section-content">${actionPlan}</div>
          </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
          <div>Generated by Push Performance Assessment System</div>
          <div style="margin-top: 10px;">© ${new Date().getFullYear()} Push Performance. All rights reserved.</div>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate PDF from report data using Puppeteer
 */
export const generatePDF = async (reportData) => {
  let browser;

  try {
    const html = generateReportHTML(reportData);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
      },
    });

    return pdfBuffer;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

export default { generatePDF };
