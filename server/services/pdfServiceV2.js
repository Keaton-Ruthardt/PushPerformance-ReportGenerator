import puppeteer from 'puppeteer';

/**
 * Generate visually improved PDF with guaranteed test visibility
 */
const generateReportHTML = (reportData) => {
  const {
    athleteName = 'Unknown Athlete',
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

  const formattedDate = assessmentDate
    ? new Date(assessmentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  const testNames = {
    'cmj': 'Countermovement Jump (CMJ)',
    'sj': 'Squat Jump (SJ)',
    'ht': 'Hop Test (HT)',
    'slcmj': 'Single Leg CMJ',
    'imtp': 'Isometric Mid-Thigh Pull',
    'ppu': 'Plyometric Push-Up',
  };

  // Render test metrics
  const renderMetrics = (data) => {
    if (!data || typeof data !== 'object') return '<p>No data available</p>';

    return Object.entries(data)
      .filter(([key]) => key !== 'asymmetry')
      .map(([key, value]) => {
        const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
        const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);
        const displayValue = typeof value === 'number' ? value.toFixed(2) : value;

        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 500; color: #374151;">${displayLabel}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 700; color: #667eea; text-align: right;">${displayValue}</td>
          </tr>
        `;
      }).join('');
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          size: A4;
          margin: 20mm;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #1f2937;
          line-height: 1.6;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* Header with solid purple background */
        .header {
          background-color: #667eea;
          color: white;
          padding: 30px;
          text-align: center;
          margin-bottom: 30px;
          border-radius: 8px;
        }

        .logo {
          font-size: 48px;
          font-weight: 900;
          letter-spacing: -1px;
          margin-bottom: 10px;
        }

        .subtitle {
          font-size: 20px;
          font-weight: 300;
          opacity: 0.95;
        }

        /* Athlete Info Card */
        .athlete-card {
          background-color: #f9fafb;
          border: 3px solid #667eea;
          border-radius: 12px;
          padding: 25px;
          margin-bottom: 25px;
        }

        .athlete-name {
          font-size: 28px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 15px;
          border-bottom: 3px solid #667eea;
          padding-bottom: 10px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 15px;
        }

        .info-item {
          background: white;
          padding: 12px;
          border-radius: 6px;
          border-left: 4px solid #667eea;
        }

        .info-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #6b7280;
          letter-spacing: 0.5px;
        }

        .info-value {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin-top: 4px;
        }

        /* Assessment Sections */
        .assessment-box {
          background-color: #fef3c7;
          border-left: 5px solid #f59e0b;
          padding: 20px;
          margin-bottom: 20px;
          border-radius: 6px;
        }

        .assessment-title {
          font-size: 16px;
          font-weight: 700;
          color: #92400e;
          margin-bottom: 10px;
          text-transform: uppercase;
        }

        .assessment-content {
          color: #78350f;
          white-space: pre-wrap;
          line-height: 1.8;
        }

        /* Test Section */
        .test-section {
          background: white;
          border: 2px solid #667eea;
          border-radius: 12px;
          padding: 0;
          margin-bottom: 25px;
          page-break-inside: avoid;
        }

        .test-header {
          background-color: #667eea;
          color: white;
          padding: 15px 20px;
          border-radius: 10px 10px 0 0;
        }

        .test-title {
          font-size: 22px;
          font-weight: 700;
          margin: 0;
        }

        .test-body {
          padding: 20px;
        }

        .metrics-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }

        .metrics-table th {
          background-color: #f3f4f6;
          padding: 12px;
          text-align: left;
          font-weight: 700;
          color: #374151;
          border-bottom: 2px solid #667eea;
        }

        .takeaway-box {
          background-color: #dbeafe;
          border-left: 4px solid #3b82f6;
          padding: 15px;
          border-radius: 6px;
          margin-top: 15px;
        }

        .takeaway-title {
          font-weight: 700;
          color: #1e40af;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .takeaway-content {
          color: #1e3a8a;
          line-height: 1.6;
        }

        .page-break {
          page-break-after: always;
        }

        .section-heading {
          font-size: 24px;
          font-weight: 800;
          color: #111827;
          margin: 30px 0 20px 0;
          padding-bottom: 10px;
          border-bottom: 3px solid #667eea;
        }

        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div class="logo">PUSH PERFORMANCE</div>
        <div class="subtitle">Athlete Assessment Report</div>
        <div style="font-size: 12px; margin-top: 10px; opacity: 0.8;">v2.0 - Enhanced Design</div>
      </div>

      <!-- Athlete Profile -->
      <div class="athlete-card">
        <div class="athlete-name">${athleteName}</div>
        <div class="info-grid">
          ${age ? `<div class="info-item"><div class="info-label">Age</div><div class="info-value">${age} years</div></div>` : ''}
          ${sport ? `<div class="info-item"><div class="info-label">Sport</div><div class="info-value">${sport}</div></div>` : ''}
          ${position ? `<div class="info-item"><div class="info-label">Position</div><div class="info-value">${position}</div></div>` : ''}
          ${schoolTeam ? `<div class="info-item"><div class="info-label">Team/School</div><div class="info-value">${schoolTeam}</div></div>` : ''}
          ${height ? `<div class="info-item"><div class="info-label">Height</div><div class="info-value">${height}</div></div>` : ''}
          ${bodyMass ? `<div class="info-item"><div class="info-label">Body Mass</div><div class="info-value">${bodyMass} lbs</div></div>` : ''}
          <div class="info-item"><div class="info-label">Assessment Date</div><div class="info-value">${formattedDate}</div></div>
        </div>
      </div>

      <!-- Assessment Sections -->
      ${currentInjuries ? `
        <div class="assessment-box">
          <div class="assessment-title">🏥 Current Injuries</div>
          <div class="assessment-content">${currentInjuries}</div>
        </div>
      ` : ''}

      ${injuryHistory ? `
        <div class="assessment-box">
          <div class="assessment-title">📋 Injury History</div>
          <div class="assessment-content">${injuryHistory}</div>
        </div>
      ` : ''}

      ${posturePresentation ? `
        <div class="assessment-box">
          <div class="assessment-title">🧍 Posture Presentation</div>
          <div class="assessment-content">${posturePresentation}</div>
        </div>
      ` : ''}

      ${movementAnalysisSummary ? `
        <div class="assessment-box">
          <div class="assessment-title">🏃 Movement Analysis</div>
          <div class="assessment-content">${movementAnalysisSummary}</div>
        </div>
      ` : ''}

      <div class="page-break"></div>

      <!-- Force Plate Tests -->
      <div class="section-heading">⚡ Force Plate Test Results</div>

      ${testResults.length === 0 ? '<p style="color: #6b7280; font-style: italic;">No test results available</p>' : ''}

      ${testResults.map(test => {
        const testName = testNames[test.testType?.toLowerCase()] || test.testType || 'Unknown Test';
        const hasData = test.data && Object.keys(test.data).length > 0;

        if (!hasData) return '';

        return `
          <div class="test-section">
            <div class="test-header">
              <h2 class="test-title">${testName}</h2>
            </div>
            <div class="test-body">
              <table class="metrics-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th style="text-align: right;">Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderMetrics(test.data)}
                </tbody>
              </table>
              ${test.keyTakeaways ? `
                <div class="takeaway-box">
                  <div class="takeaway-title">💡 Key Takeaways</div>
                  <div class="takeaway-content">${test.keyTakeaways}</div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}

      ${trainingGoals || actionPlan ? '<div class="page-break"></div>' : ''}

      <!-- Training Plan -->
      ${trainingGoals ? `
        <div class="assessment-box" style="border-left-color: #3b82f6; background-color: #dbeafe;">
          <div class="assessment-title" style="color: #1e40af;">🎯 Training Goals</div>
          <div class="assessment-content" style="color: #1e3a8a;">${trainingGoals}</div>
        </div>
      ` : ''}

      ${actionPlan ? `
        <div class="assessment-box" style="border-left-color: #8b5cf6; background-color: #ede9fe;">
          <div class="assessment-title" style="color: #5b21b6;">📝 Action Plan</div>
          <div class="assessment-content" style="color: #4c1d95;">${actionPlan}</div>
        </div>
      ` : ''}

      <!-- Footer -->
      <div class="footer">
        <div>Generated by Push Performance Assessment System</div>
        <div style="margin-top: 8px;">© ${new Date().getFullYear()} Push Performance. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate PDF using Puppeteer
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
      preferCSSPageSize: true,
    });

    return pdfBuffer;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw new Error('Failed to generate PDF');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

export default { generatePDF };
