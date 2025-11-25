import puppeteer from 'puppeteer';
import { getComparativeAnalysis, getPercentileLabel } from './cmjComparativeService.js';

/**
 * CMJ Metric Display Names and Units
 */
const CMJ_METRIC_INFO = {
  jumpHeight: { name: 'Jump Height', unit: 'cm' },
  eccentricBrakingRFD: { name: 'Eccentric Braking RFD', unit: 'N/s' },
  forceAtZeroVelocity: { name: 'Force at Zero Velocity', unit: 'N' },
  eccentricPeakForce: { name: 'Eccentric Peak Force', unit: 'N' },
  concentricImpulse: { name: 'Concentric Impulse', unit: 'Ns' },
  eccentricPeakVelocity: { name: 'Eccentric Peak Velocity', unit: 'm/s' },
  concentricPeakVelocity: { name: 'Concentric Peak Velocity', unit: 'm/s' },
  eccentricPeakPower: { name: 'Eccentric Peak Power', unit: 'W' },
  eccentricPeakPowerBM: { name: 'Eccentric Peak Power / BM', unit: 'W/kg' },
  peakPower: { name: 'Peak Power', unit: 'W' },
  peakPowerBM: { name: 'Peak Power / BM', unit: 'W/kg' },
  rsiMod: { name: 'RSI-mod', unit: '' },
  countermovementDepth: { name: 'Countermovement Depth', unit: 'cm' }
};

/**
 * Get color for percentile label
 */
const getPercentileColor = (label) => {
  switch(label) {
    case 'Elite': return '#10b981'; // Green
    case 'Above Average': return '#3b82f6'; // Blue
    case 'Average': return '#f59e0b'; // Yellow/Orange
    case 'Below Average': return '#ef4444'; // Red
    default: return '#6b7280'; // Gray
  }
};

/**
 * Render CMJ metrics with comparative analysis
 */
const renderCMJMetrics = (comparisonData) => {
  if (!comparisonData || !comparisonData.metrics) {
    return '<p>No comparative data available</p>';
  }

  console.log('🔍 PDF RENDERING - RSI-mod metric:', comparisonData.metrics.rsiMod);

  return Object.entries(comparisonData.metrics).map(([key, metric]) => {
    const info = CMJ_METRIC_INFO[key];
    if (!info) return '';

    const percentile = metric.percentile !== null ? Math.round(metric.percentile) : null;
    const label = metric.label || 'N/A';
    const color = getPercentileColor(label);
    const value = typeof metric.value === 'number' ? metric.value.toFixed(2) : metric.value;

    if (key === 'rsiMod') {
      console.log('🔍 RSI-MOD RENDERING:', {
        key,
        metricValue: metric.value,
        valueType: typeof metric.value,
        displayValue: value,
        percentile,
        label
      });
    }

    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 15px 10px;">
          <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${info.name}</div>
          <div style="font-size: 12px; color: #6b7280;">vs ${comparisonData.totalProTests} pro tests</div>
        </td>
        <td style="padding: 15px 10px; text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: #667eea;">
            ${value} ${info.unit}
          </div>
        </td>
        <td style="padding: 15px 10px;">
          <div style="margin-bottom: 6px;">
            <div style="background: #f3f4f6; height: 24px; border-radius: 12px; overflow: hidden; position: relative;">
              <div style="
                background: ${color};
                height: 100%;
                width: ${percentile || 0}%;
                border-radius: 12px;
                transition: width 0.3s ease;
              "></div>
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 11px;
                font-weight: 700;
                color: ${percentile > 50 ? 'white' : '#111827'};
                z-index: 1;
              ">${percentile !== null ? percentile + 'th' : 'N/A'}</div>
            </div>
          </div>
          <div style="
            display: inline-block;
            padding: 4px 12px;
            background: ${color};
            color: white;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
          ">${label}</div>
        </td>
      </tr>
    `;
  }).join('');
};

/**
 * Generate PDF HTML with CMJ comparative analysis
 */
const generateReportHTML = async (reportData) => {
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
    cmjMetrics = null, // CMJ metrics for comparative analysis
  } = reportData;

  const formattedDate = assessmentDate
    ? new Date(assessmentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  // Get comparative analysis if CMJ metrics provided
  let cmjComparison = null;
  if (cmjMetrics) {
    try {
      cmjComparison = await getComparativeAnalysis(cmjMetrics);
    } catch (error) {
      console.error('Error getting CMJ comparison:', error);
    }
  }

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

        .section-heading {
          font-size: 24px;
          font-weight: 800;
          color: #111827;
          margin: 30px 0 20px 0;
          padding-bottom: 10px;
          border-bottom: 3px solid #667eea;
        }

        .cmj-section {
          background: white;
          border: 2px solid #667eea;
          border-radius: 12px;
          padding: 0;
          margin-bottom: 25px;
          page-break-inside: avoid;
        }

        .cmj-header {
          background-color: #667eea;
          color: white;
          padding: 20px;
          border-radius: 10px 10px 0 0;
        }

        .cmj-title {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
        }

        .cmj-subtitle {
          font-size: 14px;
          opacity: 0.9;
        }

        .cmj-metrics-table {
          width: 100%;
          border-collapse: collapse;
        }

        .cmj-metrics-table th {
          background-color: #f3f4f6;
          padding: 12px 10px;
          text-align: left;
          font-weight: 700;
          color: #374151;
          border-bottom: 2px solid #667eea;
          font-size: 13px;
        }

        .legend-section {
          padding: 20px;
          background: #f9fafb;
          border-top: 2px solid #e5e7eb;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .legend-item {
          text-align: center;
          padding: 10px;
          border-radius: 6px;
          border: 2px solid;
        }

        .legend-elite {
          border-color: #10b981;
          background: #d1fae5;
        }

        .legend-above {
          border-color: #3b82f6;
          background: #dbeafe;
        }

        .legend-average {
          border-color: #f59e0b;
          background: #fef3c7;
        }

        .legend-below {
          border-color: #ef4444;
          background: #fee2e2;
        }

        .legend-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .legend-range {
          font-size: 10px;
          color: #6b7280;
        }

        .page-break {
          page-break-after: always;
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
        <div style="font-size: 12px; margin-top: 10px; opacity: 0.8;">Professional Athlete Comparative Analysis</div>
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

      <div class="page-break"></div>

      <!-- CMJ Comparative Analysis -->
      ${cmjComparison ? `
        <div class="section-heading">⚡ Countermovement Jump (CMJ) Analysis</div>

        <div class="cmj-section">
          <div class="cmj-header">
            <h2 class="cmj-title">Performance vs Professional Athletes</h2>
            <div class="cmj-subtitle">Compared against ${cmjComparison.totalProTests} professional baseball player CMJ tests</div>
          </div>

          <table class="cmj-metrics-table">
            <thead>
              <tr>
                <th style="width: 35%;">Metric</th>
                <th style="width: 25%; text-align: center;">Your Result</th>
                <th style="width: 40%;">Percentile Ranking</th>
              </tr>
            </thead>
            <tbody>
              ${renderCMJMetrics(cmjComparison)}
            </tbody>
          </table>

          <div class="legend-section">
            <div class="legend-item legend-elite">
              <div class="legend-label" style="color: #10b981;">Elite</div>
              <div class="legend-range">≥ 90th %ile</div>
            </div>
            <div class="legend-item legend-above">
              <div class="legend-label" style="color: #3b82f6;">Above Avg</div>
              <div class="legend-range">75-89th %ile</div>
            </div>
            <div class="legend-item legend-average">
              <div class="legend-label" style="color: #f59e0b;">Average</div>
              <div class="legend-range">25-74th %ile</div>
            </div>
            <div class="legend-item legend-below">
              <div class="legend-label" style="color: #ef4444;">Below Avg</div>
              <div class="legend-range">< 25th %ile</div>
            </div>
          </div>
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
    const html = await generateReportHTML(reportData);

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
