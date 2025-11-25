import puppeteer from 'puppeteer';
import { calculateAsymmetry } from './percentileService.js';

/**
 * Generate HTML template for PDF report
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
    testResults,
  } = reportData;

  // Helper function to get color style
  const getColorStyle = (color) => {
    const colorMap = {
      green: '#22c55e',
      yellow: '#eab308',
      red: '#ef4444',
      gray: '#9ca3af',
    };
    return colorMap[color] || colorMap.gray;
  };

  // Helper function to render test metric row
  const renderMetricRow = (label, data) => {
    if (!data) return '';
    const color = getColorStyle(data.color);
    const percentileText = data.percentile !== null ? `${data.percentile}th percentile` : 'N/A';

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${label}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${data.value}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: ${color}; font-weight: 600;">${percentileText}</td>
      </tr>
    `;
  };

  // Helper function to render asymmetry row
  const renderAsymmetryRow = (label, leftData, rightData) => {
    if (!leftData || !rightData) return '';

    const asymmetry = calculateAsymmetry(leftData.value, rightData.value);
    const asymmetryColor = asymmetry ? getColorStyle(asymmetry.color) : '#9ca3af';
    const asymmetryText = asymmetry ? `${asymmetry.percentage}% ${asymmetry.dominantSide}` : 'N/A';

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${label}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${leftData.value}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${rightData.value}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: ${asymmetryColor}; font-weight: 600;">${asymmetryText}</td>
      </tr>
    `;
  };

  // Get test data
  const cmj = testResults.find(t => t.testType === 'cmj')?.data || {};
  const sj = testResults.find(t => t.testType === 'sj')?.data || {};
  const ht = testResults.find(t => t.testType === 'ht')?.data || {};
  const slCmj = testResults.find(t => t.testType === 'slcmj')?.data || {};
  const imtp = testResults.find(t => t.testType === 'imtp')?.data || {};
  const ppu = testResults.find(t => t.testType === 'ppu')?.data || {};

  // Get key takeaways
  const cmjTakeaways = testResults.find(t => t.testType === 'cmj')?.keyTakeaways || '';
  const sjTakeaways = testResults.find(t => t.testType === 'sj')?.keyTakeaways || '';
  const htTakeaways = testResults.find(t => t.testType === 'ht')?.keyTakeaways || '';
  const slCmjTakeaways = testResults.find(t => t.testType === 'slcmj')?.keyTakeaways || '';
  const imtpTakeaways = testResults.find(t => t.testType === 'imtp')?.keyTakeaways || '';
  const ppuTakeaways = testResults.find(t => t.testType === 'ppu')?.keyTakeaways || '';

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

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          color: #111827;
          line-height: 1.6;
          padding: 40px;
        }

        .header {
          text-align: center;
          margin-bottom: 40px;
          border-bottom: 3px solid #000;
          padding-bottom: 20px;
        }

        .logo {
          font-size: 48px;
          font-weight: 900;
          letter-spacing: -2px;
          margin-bottom: 10px;
        }

        .title {
          font-size: 24px;
          color: #6b7280;
          margin-top: 10px;
        }

        .athlete-name {
          font-size: 20px;
          font-weight: 600;
          margin-top: 5px;
        }

        .section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }

        .section-title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 15px;
          padding-bottom: 8px;
          border-bottom: 2px solid #000;
        }

        .profile-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }

        .profile-item {
          display: flex;
          gap: 10px;
        }

        .profile-label {
          font-weight: 600;
        }

        .assessment-text {
          white-space: pre-wrap;
          line-height: 1.8;
          margin-bottom: 15px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }

        th {
          background-color: #000;
          color: #fff;
          padding: 12px;
          text-align: left;
          font-weight: 600;
        }

        .takeaways {
          background-color: #f3f4f6;
          padding: 15px;
          border-left: 4px solid #000;
          margin-bottom: 20px;
        }

        .takeaways-title {
          font-weight: 600;
          margin-bottom: 8px;
        }

        .page-break {
          page-break-before: always;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">PUSH PERFORMANCE</div>
        <div class="title">Performance Evaluation</div>
        <div class="athlete-name">${athleteName || 'N/A'}</div>
      </div>

      <!-- Athlete Profile -->
      <div class="section">
        <h2 class="section-title">Athlete Profile</h2>
        <div class="profile-grid">
          <div class="profile-item">
            <span class="profile-label">Age:</span>
            <span>${age || 'N/A'}</span>
          </div>
          <div class="profile-item">
            <span class="profile-label">Sport/Position:</span>
            <span>${sport || 'N/A'} / ${position || 'N/A'}</span>
          </div>
          <div class="profile-item">
            <span class="profile-label">School/Team:</span>
            <span>${schoolTeam || 'N/A'}</span>
          </div>
          <div class="profile-item">
            <span class="profile-label">Assessment Date:</span>
            <span>${assessmentDate || 'N/A'}</span>
          </div>
          <div class="profile-item">
            <span class="profile-label">Height:</span>
            <span>${height || 'N/A'}</span>
          </div>
          <div class="profile-item">
            <span class="profile-label">Body Mass:</span>
            <span>${bodyMass || 'N/A'}</span>
          </div>
        </div>
      </div>

      <!-- Assessment -->
      <div class="section">
        <h2 class="section-title">Assessment</h2>

        <div style="margin-bottom: 15px;">
          <strong>Current Injuries:</strong>
          <div class="assessment-text">${currentInjuries || 'N/A'}</div>
        </div>

        <div style="margin-bottom: 15px;">
          <strong>Injury History:</strong>
          <div class="assessment-text">${injuryHistory || 'N/A'}</div>
        </div>

        <div style="margin-bottom: 15px;">
          <strong>Posture Presentation:</strong>
          <div class="assessment-text">${posturePresentation || 'N/A'}</div>
        </div>

        <div style="margin-bottom: 15px;">
          <strong>Movement Analysis Summary:</strong>
          <div class="assessment-text">${movementAnalysisSummary || 'N/A'}</div>
        </div>
      </div>

      <div class="page-break"></div>

      <!-- Force Plate Tests -->
      <div class="section">
        <h2 class="section-title">Force Plate Testing</h2>
        <p style="margin-bottom: 20px; font-style: italic; color: #6b7280;">
          Performing multiple VALD force plate tests during an assessment provides a comprehensive
          understanding of an athlete's performance, asymmetries, injury risk, and readiness to train or return to
          play. These tests capture detailed metrics such as force production, rate of force development, and
          neuromuscular control, which are critical in a highly asymmetrical and explosive sport like baseball.
        </p>
      </div>

      <!-- CMJ -->
      ${cmj.jumpHeight ? `
      <div class="section">
        <h3 class="section-title">Countermovement Jump (CMJ)</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Percentile</th>
            </tr>
          </thead>
          <tbody>
            ${renderMetricRow('Jump Height (in)', cmj.jumpHeight)}
            ${renderMetricRow('Eccentric Braking RFD (N/s)', cmj.eccentricBrakingRFD)}
            ${renderMetricRow('Force @ Zero Velocity (N)', cmj.forceAtZeroVelocity)}
            ${renderMetricRow('Eccentric Peak Force (N)', cmj.eccentricPeakForce)}
            ${renderMetricRow('Concentric Impulse - 100ms (Ns)', cmj.concentricImpulse100ms)}
            ${renderMetricRow('Eccentric Peak Velocity (m/s)', cmj.eccentricPeakVelocity)}
            ${renderMetricRow('Concentric Peak Velocity (m/s)', cmj.concentricPeakVelocity)}
            ${renderMetricRow('Eccentric Peak Power (W)', cmj.eccentricPeakPower)}
            ${renderMetricRow('Eccentric Peak Power / BM (W/kg)', cmj.eccentricPeakPowerPerBM)}
            ${renderMetricRow('Peak Power (W)', cmj.peakPower)}
            ${renderMetricRow('Peak Power / BM (W/kg)', cmj.peakPowerPerBM)}
            ${renderMetricRow('RSI-mod (m/s)', cmj.rsiMod)}
          </tbody>
        </table>
        ${cmjTakeaways ? `
        <div class="takeaways">
          <div class="takeaways-title">Key Takeaways:</div>
          <div>${cmjTakeaways}</div>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- SJ -->
      ${sj.jumpHeight ? `
      <div class="section">
        <h3 class="section-title">Squat Jump (SJ)</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Percentile</th>
            </tr>
          </thead>
          <tbody>
            ${renderMetricRow('Jump Height (in)', sj.jumpHeight)}
            ${renderMetricRow('Force @ Peak Power (N)', sj.forceAtPeakPower)}
            ${renderMetricRow('Concentric Peak Velocity (m/s)', sj.concentricPeakVelocity)}
            ${renderMetricRow('Peak Power (W)', sj.peakPower)}
            ${renderMetricRow('Peak Power / BM (W/kg)', sj.peakPowerPerBM)}
          </tbody>
        </table>
        ${sjTakeaways ? `
        <div class="takeaways">
          <div class="takeaways-title">Key Takeaways:</div>
          <div>${sjTakeaways}</div>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- HT -->
      ${ht.rsi ? `
      <div class="section">
        <h3 class="section-title">Hop Test (HT)</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Percentile</th>
            </tr>
          </thead>
          <tbody>
            ${renderMetricRow('RSI (m/s)', ht.rsi)}
            ${renderMetricRow('Jump Height (cm)', ht.jumpHeight)}
            ${renderMetricRow('Ground Contact Time (ms)', ht.groundContactTime)}
          </tbody>
        </table>
        ${htTakeaways ? `
        <div class="takeaways">
          <div class="takeaways-title">Key Takeaways:</div>
          <div>${htTakeaways}</div>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <div class="page-break"></div>

      <!-- SL CMJ -->
      ${slCmj.left?.jumpHeight ? `
      <div class="section">
        <h3 class="section-title">Single Leg Countermovement Jump (SL CMJ)</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Left</th>
              <th>Right</th>
              <th>Asymmetry</th>
            </tr>
          </thead>
          <tbody>
            ${renderAsymmetryRow('Jump Height (in)', slCmj.left.jumpHeight, slCmj.right.jumpHeight)}
            ${renderAsymmetryRow('Eccentric Peak Force (N)', slCmj.left.eccentricPeakForce, slCmj.right.eccentricPeakForce)}
            ${renderAsymmetryRow('Eccentric Braking RFD (N/s)', slCmj.left.eccentricBrakingRFD, slCmj.right.eccentricBrakingRFD)}
            ${renderAsymmetryRow('Concentric Peak Force (N)', slCmj.left.concentricPeakForce, slCmj.right.concentricPeakForce)}
            ${renderAsymmetryRow('Eccentric Peak Velocity (m/s)', slCmj.left.eccentricPeakVelocity, slCmj.right.eccentricPeakVelocity)}
            ${renderAsymmetryRow('Concentric Peak Velocity (m/s)', slCmj.left.concentricPeakVelocity, slCmj.right.concentricPeakVelocity)}
            ${renderAsymmetryRow('Peak Power (W)', slCmj.left.peakPower, slCmj.right.peakPower)}
            ${renderAsymmetryRow('Peak Power / BM (W/kg)', slCmj.left.peakPowerPerBM, slCmj.right.peakPowerPerBM)}
            ${renderAsymmetryRow('RSI-mod (m/s)', slCmj.left.rsiMod, slCmj.right.rsiMod)}
          </tbody>
        </table>
        ${slCmjTakeaways ? `
        <div class="takeaways">
          <div class="takeaways-title">Key Takeaways:</div>
          <div>${slCmjTakeaways}</div>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- IMTP -->
      ${imtp.peakVerticalForce ? `
      <div class="section">
        <h3 class="section-title">Isometric Mid-Thigh Pull (IMTP)</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Percentile</th>
            </tr>
          </thead>
          <tbody>
            ${renderMetricRow('Peak Vertical Force (N)', imtp.peakVerticalForce)}
            ${renderMetricRow('Peak Vertical Force / BM (N/kg)', imtp.peakVerticalForcePerBM)}
            ${renderMetricRow('Force at 100ms (N)', imtp.forceAt100ms)}
            ${renderMetricRow('Time to Peak Force (s)', imtp.timeToPeakForce)}
          </tbody>
        </table>
        ${imtpTakeaways ? `
        <div class="takeaways">
          <div class="takeaways-title">Key Takeaways:</div>
          <div>${imtpTakeaways}</div>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- PPU -->
      ${ppu.pushUpHeight ? `
      <div class="section">
        <h3 class="section-title">Plyometric Push-Up (PPU)</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Percentile</th>
            </tr>
          </thead>
          <tbody>
            ${renderMetricRow('Push-Up Height (in)', ppu.pushUpHeight)}
            ${renderMetricRow('Eccentric Peak Force (N)', ppu.eccentricPeakForce)}
            ${renderMetricRow('Concentric Peak Force (N)', ppu.concentricPeakForce)}
            ${renderMetricRow('Concentric RFD (N/s) L', ppu.concentricRFDLeft)}
            ${renderMetricRow('Concentric RFD (N/s) R', ppu.concentricRFDRight)}
            ${renderMetricRow('Eccentric Braking RFD (N/s)', ppu.eccentricBrakingRFD)}
          </tbody>
        </table>
        ${ppuTakeaways ? `
        <div class="takeaways">
          <div class="takeaways-title">Key Takeaways:</div>
          <div>${ppuTakeaways}</div>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <div class="page-break"></div>

      <!-- Training Goals -->
      <div class="section">
        <h2 class="section-title">Training Goals</h2>
        <div class="assessment-text">${trainingGoals || 'N/A'}</div>
      </div>

      <!-- Action Plan -->
      <div class="section">
        <h2 class="section-title">Action Plan</h2>
        <div class="assessment-text">${actionPlan || 'N/A'}</div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate PDF from report data
 * @param {Object} reportData - Report data
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generatePDF = async (reportData) => {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    const html = generateReportHTML(reportData);

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
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
