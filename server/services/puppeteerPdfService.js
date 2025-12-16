import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load and encode logo as base64
 */
function getLogoBase64() {
  try {
    const logoPath = path.join(__dirname, '../../client/public/push-performance-logo.png');
    const logoBuffer = fs.readFileSync(logoPath);
    return logoBuffer.toString('base64');
  } catch (error) {
    console.warn('Could not load logo file, using fallback');
    return null;
  }
}

/**
 * Generate PDF from web UI using Puppeteer
 * This ensures the PDF looks exactly like the web UI
 */
export async function generatePdfFromHtml(reportData, outputPath) {
  let browser;

  try {
    console.log('🚀 Launching headless browser for PDF generation...');

    // Launch browser with appropriate configuration for production vs development
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    };

    // In production (Render), use system Chromium
    if (process.env.NODE_ENV === 'production' && process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      console.log('📌 Using system Chromium at:', process.env.PUPPETEER_EXECUTABLE_PATH);
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 1.5 // Balanced quality and performance
    });

    console.log('📄 Generating report HTML...');

    // Load logo as base64
    const logoBase64 = getLogoBase64();

    // Generate HTML content with embedded data
    const htmlContent = generateReportHtml(reportData, logoBase64);

    // Set content directly with increased timeout
    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded',
      timeout: 60000 // 60 seconds timeout
    });

    // Wait for Chart.js to load and charts to render
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if (typeof Chart !== 'undefined') {
          // Chart.js is loaded, wait a bit for charts to render
          setTimeout(resolve, 500);
        } else {
          // Wait for Chart.js to load with timeout
          let elapsed = 0;
          const maxWait = 5000; // 5 seconds max
          const checkChart = setInterval(() => {
            elapsed += 50;
            if (typeof Chart !== 'undefined') {
              clearInterval(checkChart);
              setTimeout(resolve, 500);
            } else if (elapsed >= maxWait) {
              // Timeout - proceed anyway
              clearInterval(checkChart);
              console.warn('Chart.js loading timeout - proceeding without chart');
              resolve();
            }
          }, 50);
        }
      });
    });

    console.log('📊 Charts rendered successfully');

    console.log('💾 Generating PDF...');

    // Generate PDF with optimized settings
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    console.log('✅ PDF generated successfully:', outputPath);

  } catch (error) {
    console.error('❌ Error generating PDF with Puppeteer:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    throw error;
  } finally {
    if (browser) {
      console.log('🔒 Closing browser...');
      await browser.close();
    }
  }
}

/**
 * Generate standalone HTML for the report
 * This includes all styles and data embedded
 */
function generateReportHtml(reportData, logoBase64 = null) {
  console.log('📄 Generating HTML with data structure:', {
    hasAthlete: !!reportData.athlete,
    hasName: !!reportData.name,
    hasTests: !!reportData.tests,
    hasCMJ: !!reportData.tests?.cmj,
    hasCMJComparison: !!reportData.cmjComparison,
    hasSJ: !!reportData.tests?.squatJump,
    hasSJComparison: !!reportData.sjComparison,
    hasIMTP: !!reportData.tests?.imtp,
    hasIMTPComparison: !!reportData.imtpComparison,
    hasAthleteInfo: !!reportData.athleteInfo
  });

  const athlete = reportData.athlete || reportData.name || 'Athlete';
  const cmj = reportData.tests?.cmj || {};
  const cmjComp = reportData.cmjComparison || {};
  const sj = reportData.tests?.squatJump || {};
  const sjComp = reportData.sjComparison || {};
  const imtp = reportData.tests?.imtp || {};
  const imtpComp = reportData.imtpComparison || {};
  const ppu = reportData.tests?.ppu || {};
  const ppuComp = reportData.ppuComparison || {};
  const hopTest = reportData.tests?.hopTest || {};
  const hopComp = reportData.hopComparison || {};
  const slCmjLeft = reportData.tests?.singleLegCMJ_Left || {};
  const slCmjRight = reportData.tests?.singleLegCMJ_Right || {};
  const slCmjRecommendations = reportData.slCmjRecommendations || '';
  const cmjRecommendations = reportData.cmjRecommendations || '';
  const sjRecommendations = reportData.sjRecommendations || '';
  const imtpRecommendations = reportData.imtpRecommendations || '';
  const ppuRecommendations = reportData.ppuRecommendations || '';
  const hopRecommendations = reportData.hopRecommendations || '';

  // Extract training goals and action plan - handle both string and object formats
  const trainingGoals = typeof reportData.trainingGoals === 'string' ? reportData.trainingGoals : (reportData.trainingGoals?.goals || reportData.goals || '');
  const actionPlan = typeof reportData.actionPlan === 'string' ? reportData.actionPlan : (reportData.trainingGoals?.actionPlan || reportData.actionPlan?.plan || reportData.plan || '');

  // Extract initial assessment fields
  const currentInjuries = reportData.initialAssessment?.currentInjuries || reportData.currentInjuries || reportData.assessmentQuestions?.currentInjuries || '';
  const injuryHistory = reportData.initialAssessment?.injuryHistory || reportData.injuryHistory || reportData.assessmentQuestions?.injuryHistory || '';
  const posturePresentation = reportData.initialAssessment?.posturePresentation || reportData.posturePresentation || reportData.assessmentQuestions?.posturePresentation || '';
  const movementAnalysis = reportData.initialAssessment?.movementAnalysis || reportData.movementAnalysis || reportData.assessmentQuestions?.movementAnalysis || '';

  const assessmentQuestions = reportData.assessmentQuestions || {};
  const recommendations = reportData.recommendations || reportData.customRecommendations || [];
  const athleteInfo = reportData.athleteInfo || { age: '', height: '', weight: '' };
  const selectedMetrics = reportData.selectedMetrics || {};

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Performance Report - ${athlete}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      background: white;
      color: #1f2937;
      padding: 20px;
      line-height: 1.6;
    }

    .report-header {
      margin-bottom: 20px;
      border-bottom: 3px solid #000000;
      padding-bottom: 15px;
    }

    .header-logo-section {
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      padding: 20px;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-logo {
      height: 60px;
      width: auto;
      margin-right: 20px;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      -ms-interpolation-mode: nearest-neighbor;
      object-fit: contain;
      display: block;
      filter: brightness(0) invert(1);
      -webkit-filter: brightness(0) invert(1);
    }

    .text-logo {
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 2px;
      font-family: 'Roboto', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      text-transform: uppercase;
      margin-right: 20px;
    }

    .report-title {
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
      margin: 0;
      letter-spacing: 3px;
      flex-grow: 1;
      text-align: center;
      font-family: 'Roboto', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      text-transform: uppercase;
    }

    .athlete-info-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 15px;
      align-items: center;
      padding: 15px 20px;
      background: #f8f9fa;
      border-top: 2px solid #000000;
    }

    .athlete-main {
      padding-right: 20px;
      border-right: 2px solid #e0e0e0;
    }

    .athlete-name {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a1a;
      margin: 0 0 5px 0;
    }

    .report-date {
      color: #666;
      font-size: 12px;
      margin: 0;
    }

    .info-item {
      text-align: center;
    }

    .info-label {
      font-size: 10px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }

    .info-value {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
    }

    .report-section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }

    .report-section h3 {
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 6px;
    }

    .cmj-metrics-table {
      width: 100%;
      margin-top: 10px;
    }

    .cmj-metrics-table table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border: 1px solid #e5e7eb;
      font-size: 10px;
    }

    .cmj-metrics-table th,
    .cmj-metrics-table td {
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }

    .cmj-metrics-table th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
      font-size: 10px;
    }

    .cmj-metrics-table td {
      font-size: 10px;
      color: #1f2937;
    }

    .comparison-note {
      margin-top: 8px;
      font-size: 10px;
      color: #6b7280;
      font-style: italic;
    }

    .spider-chart-container {
      width: 420px;
      height: 420px;
      margin: 15px auto;
      page-break-inside: avoid;
    }

    /* Two column layout for CMJ table and spider chart */
    .metrics-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    .metrics-layout .report-section {
      margin-bottom: 0;
    }

    .recommendations-section {
      page-break-before: avoid;
    }

    .recommendations-list {
      margin-top: 15px;
    }

    .recommendation-item {
      padding: 12px;
      margin-bottom: 10px;
      background: #f3f4f6;
      border-left: 4px solid #3b82f6;
      border-radius: 4px;
    }

    .rec-number {
      font-weight: 700;
      color: #3b82f6;
      margin-right: 8px;
    }

    .test-recommendations {
      margin-top: 15px;
      padding: 12px;
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      border-radius: 4px;
      font-size: 11px;
      line-height: 1.6;
    }

    .test-recommendations h4 {
      margin: 0 0 8px 0;
      font-size: 12px;
      font-weight: 700;
      color: #92400e;
    }

    .assessment-section {
      margin-bottom: 25px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
      page-break-inside: avoid;
    }

    .assessment-section h3 {
      font-size: 14px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 12px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 6px;
    }

    .assessment-item {
      margin-bottom: 10px;
      font-size: 11px;
    }

    .assessment-question {
      font-weight: 600;
      color: #4b5563;
      margin-bottom: 3px;
    }

    .assessment-answer {
      color: #1f2937;
      padding-left: 15px;
    }

    .test-reasoning {
      margin-bottom: 30px;
      padding: 20px;
      background: linear-gradient(to right, #eff6ff, #dbeafe);
      border-left: 5px solid #3b82f6;
      border-radius: 6px;
      page-break-inside: avoid;
    }

    .test-reasoning h3 {
      font-size: 16px;
      font-weight: 700;
      color: #1e40af;
      margin: 0 0 12px 0;
    }

    .test-reasoning p {
      font-size: 11px;
      line-height: 1.8;
      color: #1f2937;
      margin: 0;
    }

    .training-goals-section {
      margin-top: 30px;
      page-break-inside: avoid;
    }

    .training-goals-section h3 {
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 12px;
      border-bottom: 2px solid #10b981;
      padding-bottom: 6px;
    }

    .training-goals-content {
      padding: 15px;
      background: #f0fdf4;
      border-left: 4px solid #10b981;
      border-radius: 4px;
      font-size: 11px;
      line-height: 1.8;
      white-space: pre-wrap;
    }

    @media print {
      body {
        padding: 0;
      }

      .report-section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="header-logo-section">
      <img src="data:image/png;base64,${logoBase64}" class="header-logo" alt="Push Performance">
      <h1 class="report-title">Performance Assessment Report</h1>
    </div>
    <div class="athlete-info-grid">
      <div class="athlete-main">
        <h2 class="athlete-name">${athlete}</h2>
        <p class="report-date">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div class="info-item">
        <div class="info-label">Age</div>
        <div class="info-value">${athleteInfo.age || '--'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Height</div>
        <div class="info-value">${athleteInfo.height || '--'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Weight</div>
        <div class="info-value">${athleteInfo.weight || '--'}</div>
      </div>
    </div>
  </div>

  ${currentInjuries || injuryHistory || posturePresentation || movementAnalysis ? `
  <div class="assessment-section">
    <h3>Initial Assessment</h3>
    ${currentInjuries ? `
      <div class="assessment-item">
        <div class="assessment-question">Current Status</div>
        <div class="assessment-answer">${currentInjuries}</div>
      </div>
    ` : ''}
    ${injuryHistory ? `
      <div class="assessment-item">
        <div class="assessment-question">Injury History</div>
        <div class="assessment-answer">${injuryHistory}</div>
      </div>
    ` : ''}
    ${posturePresentation ? `
      <div class="assessment-item">
        <div class="assessment-question">Posture Presentation</div>
        <div class="assessment-answer">${posturePresentation}</div>
      </div>
    ` : ''}
    ${movementAnalysis ? `
      <div class="assessment-item">
        <div class="assessment-question">Movement Analysis Summary</div>
        <div class="assessment-answer">${movementAnalysis}</div>
      </div>
    ` : ''}
  </div>
  ` : ''}

  <div class="test-reasoning">
    <h3>Force Plate Test Reasoning</h3>
    <p>Performing multiple VALD force plate tests during an assessment provides a comprehensive understanding of an athlete's performance, asymmetries, injury risk, and readiness to train or return to play. These tests capture detailed metrics such as force production, rate of force development, and neuromuscular control, which are critical in a highly asymmetrical and explosive sport like baseball. By using a variety of tests—such as countermovement jumps, squat jumps, single leg countermovement jumps, hop test, isometric mid-thigh pulls and plyometric push ups—coaches and clinicians can identify imbalances, monitor fatigue, track training progress, and make objective decisions around injury prevention, rehabilitation and performance. This data-driven approach supports tailored training programs and long-term athlete development.</p>
  </div>

  ${cmj && Object.keys(cmj).length > 0 ? `
  <div class="metrics-layout" style="page-break-before: always;">
    <div class="report-section">
    <h3>Countermovement Jump - Detailed Metrics</h3>
    <div class="cmj-metrics-table">
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Athlete Value</th>
            <th>Percentile</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Jump Height</td>
            <td>${cmj.jumpHeight ? `${(cmj.jumpHeight / 2.54).toFixed(2)} in` : 'N/A'}</td>
            <td>${cmjComp.metrics?.jumpHeight?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Eccentric Braking RFD</td>
            <td>${cmj.eccentricBrakingRFD?.toFixed(2) || 'N/A'} N/s</td>
            <td>${cmjComp.metrics?.eccentricBrakingRFD?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Force @ Zero Velocity</td>
            <td>${cmj.forceAtZeroVelocity?.toFixed(2) || 'N/A'} N</td>
            <td>${cmjComp.metrics?.forceAtZeroVelocity?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Eccentric Peak Force</td>
            <td>${cmj.eccentricPeakForce?.toFixed(2) || 'N/A'} N</td>
            <td>${cmjComp.metrics?.eccentricPeakForce?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Concentric Impulse</td>
            <td>${cmj.concentricImpulse?.toFixed(2) || 'N/A'} Ns</td>
            <td>${cmjComp.metrics?.concentricImpulse?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Eccentric Peak Velocity</td>
            <td>${cmj.eccentricPeakVelocity?.toFixed(2) || 'N/A'} m/s</td>
            <td>${cmjComp.metrics?.eccentricPeakVelocity?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Concentric Peak Velocity</td>
            <td>${cmj.concentricPeakVelocity?.toFixed(2) || 'N/A'} m/s</td>
            <td>${cmjComp.metrics?.concentricPeakVelocity?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Eccentric Peak Power</td>
            <td>${cmj.eccentricPeakPower?.toFixed(2) || 'N/A'} W</td>
            <td>${cmjComp.metrics?.eccentricPeakPower?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Eccentric Peak Power / BM</td>
            <td>${cmj.eccentricPeakPowerBM?.toFixed(2) || 'N/A'} W/kg</td>
            <td>${cmjComp.metrics?.eccentricPeakPowerBM?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Peak Power</td>
            <td>${cmj.peakPower?.toFixed(2) || 'N/A'} W</td>
            <td>${cmjComp.metrics?.peakPower?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Peak Power / BM</td>
            <td>${cmj.peakPowerBM?.toFixed(2) || 'N/A'} W/kg</td>
            <td>${cmjComp.metrics?.peakPowerBM?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>RSI</td>
            <td>${cmj.rsi?.toFixed(2) || 'N/A'}</td>
            <td>${cmjComp.metrics?.rsi?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Countermovement Depth</td>
            <td>${cmj.countermovementDepth ? `${(cmj.countermovementDepth / 2.54).toFixed(2)} in` : 'N/A'}</td>
            <td>${cmjComp.metrics?.countermovementDepth?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
        </tbody>
      </table>
      ${cmjComp.totalProTests ? `
      <p class="comparison-note">
        Compared against professional baseball players from MLB/MiLB
      </p>
      ` : ''}
    </div>
    </div>

    <div class="report-section">
      <h3>CMJ Metrics vs MLB Pro Average</h3>
      <div class="spider-chart-container">
        <canvas id="spiderChart"></canvas>
      </div>
    </div>
  </div>

  ${cmjRecommendations ? `
  <div class="test-recommendations">
    <h4>CMJ Test Recommendations</h4>
    <p>${cmjRecommendations}</p>
  </div>
  ` : ''}
  ` : ''}

  ${sj && Object.keys(sj).length > 0 ? `
  <div class="metrics-layout" style="page-break-before: always;">
    <div class="report-section">
    <h3>Squat Jump - Detailed Metrics</h3>
    <div class="cmj-metrics-table">
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Athlete Value</th>
            <th>Percentile</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Jump Height</td>
            <td>${sj.jumpHeight ? `${(sj.jumpHeight / 2.54).toFixed(2)} in` : 'N/A'}</td>
            <td>${sjComp.metrics?.jumpHeight?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Force @ Peak Power</td>
            <td>${sj.forceAtPeakPower?.toFixed(2) || 'N/A'} N</td>
            <td>${sjComp.metrics?.forceAtPeakPower?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Concentric Peak Velocity</td>
            <td>${sj.concentricPeakVelocity?.toFixed(2) || 'N/A'} m/s</td>
            <td>${sjComp.metrics?.concentricPeakVelocity?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Peak Power</td>
            <td>${sj.peakPower?.toFixed(2) || 'N/A'} W</td>
            <td>${sjComp.metrics?.peakPower?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Peak Power / BW</td>
            <td>${sj.peakPowerBM?.toFixed(2) || 'N/A'} W/kg</td>
            <td>${sjComp.metrics?.peakPowerBM?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
        </tbody>
      </table>
      ${sjComp.summary?.totalTests ? `
      <p class="comparison-note">
        Compared against professional baseball players from MLB/MiLB
      </p>
      ` : ''}
    </div>
    </div>

    <div class="report-section">
      <h3>SJ Metrics vs MLB Pro Average</h3>
      <div class="spider-chart-container">
        <canvas id="sjSpiderChart"></canvas>
      </div>
    </div>
  </div>

  ${sjRecommendations ? `
  <div class="test-recommendations">
    <h4>Squat Jump Test Recommendations</h4>
    <p>${sjRecommendations}</p>
  </div>
  ` : ''}
  ` : ''}

  ${imtp && Object.keys(imtp).length > 0 ? `
  <div class="metrics-layout" style="page-break-before: always;">
    <div class="report-section">
    <h3>IMTP - Detailed Metrics</h3>
    <div class="cmj-metrics-table">
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Athlete Value</th>
            <th>Percentile</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Peak Vertical Force</td>
            <td>${imtp.peakVerticalForce?.toFixed(2) || 'N/A'} N</td>
            <td>${imtpComp.metrics?.peakVerticalForce?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Peak Force / BM</td>
            <td>${imtp.peakForceBM?.toFixed(2) || 'N/A'} N/kg</td>
            <td>${imtpComp.metrics?.peakForceBM?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Force @ 100ms</td>
            <td>${imtp.forceAt100ms?.toFixed(2) || 'N/A'} N</td>
            <td>${imtpComp.metrics?.forceAt100ms?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Time to Peak Force</td>
            <td>${imtp.timeToPeakForce?.toFixed(2) || 'N/A'} s</td>
            <td>${imtpComp.metrics?.timeToPeakForce?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
        </tbody>
      </table>
      ${imtpComp.summary?.totalTests ? `
      <p class="comparison-note">
        Compared against professional baseball players from MLB/MiLB
      </p>
      ` : ''}
    </div>
    </div>

    <div class="report-section">
      <h3>IMTP Metrics vs MLB Pro Average</h3>
      <div class="spider-chart-container">
        <canvas id="imtpSpiderChart"></canvas>
      </div>
    </div>
  </div>

  ${imtpRecommendations ? `
  <div class="test-recommendations">
    <h4>IMTP Test Recommendations</h4>
    <p>${imtpRecommendations}</p>
  </div>
  ` : ''}
  ` : ''}

  ${(slCmjLeft && Object.keys(slCmjLeft).length > 0) || (slCmjRight && Object.keys(slCmjRight).length > 0) ? `
  <div class="report-section" style="page-break-before: always;">
    <h3>Single Leg Countermovement Jump - Left vs Right Comparison</h3>
    <div class="cmj-metrics-table">
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
          <tr>
            <td>Jump Height</td>
            <td>${slCmjLeft?.jumpHeight ? `${(slCmjLeft.jumpHeight / 2.54).toFixed(2)} in` : 'N/A'}</td>
            <td>${slCmjRight?.jumpHeight ? `${(slCmjRight.jumpHeight / 2.54).toFixed(2)} in` : 'N/A'}</td>
            <td style="color: ${(() => {
              if (!slCmjLeft?.jumpHeight || !slCmjRight?.jumpHeight) return '#ccc';
              const diff = Math.abs(slCmjLeft.jumpHeight - slCmjRight.jumpHeight);
              const avg = (slCmjLeft.jumpHeight + slCmjRight.jumpHeight) / 2;
              const asym = (diff / avg) * 100;
              return asym <= 5 ? '#27AE60' : asym <= 10 ? '#F39C12' : '#E74C3C';
            })()}; font-weight: 600;">
              ${(() => {
                if (!slCmjLeft?.jumpHeight || !slCmjRight?.jumpHeight) return 'N/A';
                const diff = Math.abs(slCmjLeft.jumpHeight - slCmjRight.jumpHeight);
                const avg = (slCmjLeft.jumpHeight + slCmjRight.jumpHeight) / 2;
                const asym = (diff / avg) * 100;
                return `${asym.toFixed(1)}%`;
              })()}
            </td>
          </tr>
          <tr>
            <td>Eccentric Peak Force</td>
            <td>${slCmjLeft?.eccentricPeakForce ? `${slCmjLeft.eccentricPeakForce.toFixed(2)} N` : 'N/A'}</td>
            <td>${slCmjRight?.eccentricPeakForce ? `${slCmjRight.eccentricPeakForce.toFixed(2)} N` : 'N/A'}</td>
            <td style="color: ${(() => {
              if (!slCmjLeft?.eccentricPeakForce || !slCmjRight?.eccentricPeakForce) return '#ccc';
              const diff = Math.abs(slCmjLeft.eccentricPeakForce - slCmjRight.eccentricPeakForce);
              const avg = (slCmjLeft.eccentricPeakForce + slCmjRight.eccentricPeakForce) / 2;
              const asym = (diff / avg) * 100;
              return asym <= 5 ? '#27AE60' : asym <= 10 ? '#F39C12' : '#E74C3C';
            })()}; font-weight: 600;">
              ${(() => {
                if (!slCmjLeft?.eccentricPeakForce || !slCmjRight?.eccentricPeakForce) return 'N/A';
                const diff = Math.abs(slCmjLeft.eccentricPeakForce - slCmjRight.eccentricPeakForce);
                const avg = (slCmjLeft.eccentricPeakForce + slCmjRight.eccentricPeakForce) / 2;
                const asym = (diff / avg) * 100;
                return `${asym.toFixed(1)}%`;
              })()}
            </td>
          </tr>
          <tr>
            <td>Eccentric Braking RFD</td>
            <td>${slCmjLeft?.eccentricBrakingRFD ? `${slCmjLeft.eccentricBrakingRFD.toFixed(2)} N/s` : 'N/A'}</td>
            <td>${slCmjRight?.eccentricBrakingRFD ? `${slCmjRight.eccentricBrakingRFD.toFixed(2)} N/s` : 'N/A'}</td>
            <td style="color: ${(() => {
              if (!slCmjLeft?.eccentricBrakingRFD || !slCmjRight?.eccentricBrakingRFD) return '#ccc';
              const diff = Math.abs(slCmjLeft.eccentricBrakingRFD - slCmjRight.eccentricBrakingRFD);
              const avg = (slCmjLeft.eccentricBrakingRFD + slCmjRight.eccentricBrakingRFD) / 2;
              const asym = (diff / avg) * 100;
              return asym <= 5 ? '#27AE60' : asym <= 10 ? '#F39C12' : '#E74C3C';
            })()}; font-weight: 600;">
              ${(() => {
                if (!slCmjLeft?.eccentricBrakingRFD || !slCmjRight?.eccentricBrakingRFD) return 'N/A';
                const diff = Math.abs(slCmjLeft.eccentricBrakingRFD - slCmjRight.eccentricBrakingRFD);
                const avg = (slCmjLeft.eccentricBrakingRFD + slCmjRight.eccentricBrakingRFD) / 2;
                const asym = (diff / avg) * 100;
                return `${asym.toFixed(1)}%`;
              })()}
            </td>
          </tr>
          <tr>
            <td>Concentric Peak Force</td>
            <td>${slCmjLeft?.concentricPeakForce ? `${slCmjLeft.concentricPeakForce.toFixed(2)} N` : 'N/A'}</td>
            <td>${slCmjRight?.concentricPeakForce ? `${slCmjRight.concentricPeakForce.toFixed(2)} N` : 'N/A'}</td>
            <td style="color: ${(() => {
              if (!slCmjLeft?.concentricPeakForce || !slCmjRight?.concentricPeakForce) return '#ccc';
              const diff = Math.abs(slCmjLeft.concentricPeakForce - slCmjRight.concentricPeakForce);
              const avg = (slCmjLeft.concentricPeakForce + slCmjRight.concentricPeakForce) / 2;
              const asym = (diff / avg) * 100;
              return asym <= 5 ? '#27AE60' : asym <= 10 ? '#F39C12' : '#E74C3C';
            })()}; font-weight: 600;">
              ${(() => {
                if (!slCmjLeft?.concentricPeakForce || !slCmjRight?.concentricPeakForce) return 'N/A';
                const diff = Math.abs(slCmjLeft.concentricPeakForce - slCmjRight.concentricPeakForce);
                const avg = (slCmjLeft.concentricPeakForce + slCmjRight.concentricPeakForce) / 2;
                const asym = (diff / avg) * 100;
                return `${asym.toFixed(1)}%`;
              })()}
            </td>
          </tr>
          <tr>
            <td>Eccentric Peak Velocity</td>
            <td>${slCmjLeft?.eccentricPeakVelocity ? `${slCmjLeft.eccentricPeakVelocity.toFixed(2)} m/s` : 'N/A'}</td>
            <td>${slCmjRight?.eccentricPeakVelocity ? `${slCmjRight.eccentricPeakVelocity.toFixed(2)} m/s` : 'N/A'}</td>
            <td style="color: ${(() => {
              if (!slCmjLeft?.eccentricPeakVelocity || !slCmjRight?.eccentricPeakVelocity) return '#ccc';
              const diff = Math.abs(slCmjLeft.eccentricPeakVelocity - slCmjRight.eccentricPeakVelocity);
              const avg = (slCmjLeft.eccentricPeakVelocity + slCmjRight.eccentricPeakVelocity) / 2;
              const asym = (diff / avg) * 100;
              return asym <= 5 ? '#27AE60' : asym <= 10 ? '#F39C12' : '#E74C3C';
            })()}; font-weight: 600;">
              ${(() => {
                if (!slCmjLeft?.eccentricPeakVelocity || !slCmjRight?.eccentricPeakVelocity) return 'N/A';
                const diff = Math.abs(slCmjLeft.eccentricPeakVelocity - slCmjRight.eccentricPeakVelocity);
                const avg = (slCmjLeft.eccentricPeakVelocity + slCmjRight.eccentricPeakVelocity) / 2;
                const asym = (diff / avg) * 100;
                return `${asym.toFixed(1)}%`;
              })()}
            </td>
          </tr>
          <tr>
            <td>Concentric Peak Velocity</td>
            <td>${slCmjLeft?.concentricPeakVelocity ? `${slCmjLeft.concentricPeakVelocity.toFixed(2)} m/s` : 'N/A'}</td>
            <td>${slCmjRight?.concentricPeakVelocity ? `${slCmjRight.concentricPeakVelocity.toFixed(2)} m/s` : 'N/A'}</td>
            <td style="color: ${(() => {
              if (!slCmjLeft?.concentricPeakVelocity || !slCmjRight?.concentricPeakVelocity) return '#ccc';
              const diff = Math.abs(slCmjLeft.concentricPeakVelocity - slCmjRight.concentricPeakVelocity);
              const avg = (slCmjLeft.concentricPeakVelocity + slCmjRight.concentricPeakVelocity) / 2;
              const asym = (diff / avg) * 100;
              return asym <= 5 ? '#27AE60' : asym <= 10 ? '#F39C12' : '#E74C3C';
            })()}; font-weight: 600;">
              ${(() => {
                if (!slCmjLeft?.concentricPeakVelocity || !slCmjRight?.concentricPeakVelocity) return 'N/A';
                const diff = Math.abs(slCmjLeft.concentricPeakVelocity - slCmjRight.concentricPeakVelocity);
                const avg = (slCmjLeft.concentricPeakVelocity + slCmjRight.concentricPeakVelocity) / 2;
                const asym = (diff / avg) * 100;
                return `${asym.toFixed(1)}%`;
              })()}
            </td>
          </tr>
          <tr>
            <td>Peak Power / BW</td>
            <td>${slCmjLeft?.peakPowerBM ? `${slCmjLeft.peakPowerBM.toFixed(2)} W/kg` : 'N/A'}</td>
            <td>${slCmjRight?.peakPowerBM ? `${slCmjRight.peakPowerBM.toFixed(2)} W/kg` : 'N/A'}</td>
            <td style="color: ${(() => {
              if (!slCmjLeft?.peakPowerBM || !slCmjRight?.peakPowerBM) return '#ccc';
              const diff = Math.abs(slCmjLeft.peakPowerBM - slCmjRight.peakPowerBM);
              const avg = (slCmjLeft.peakPowerBM + slCmjRight.peakPowerBM) / 2;
              const asym = (diff / avg) * 100;
              return asym <= 5 ? '#27AE60' : asym <= 10 ? '#F39C12' : '#E74C3C';
            })()}; font-weight: 600;">
              ${(() => {
                if (!slCmjLeft?.peakPowerBM || !slCmjRight?.peakPowerBM) return 'N/A';
                const diff = Math.abs(slCmjLeft.peakPowerBM - slCmjRight.peakPowerBM);
                const avg = (slCmjLeft.peakPowerBM + slCmjRight.peakPowerBM) / 2;
                const asym = (diff / avg) * 100;
                return `${asym.toFixed(1)}%`;
              })()}
            </td>
          </tr>
          <tr>
            <td>RSI</td>
            <td>${slCmjLeft?.rsi ? slCmjLeft.rsi.toFixed(3) : 'N/A'}</td>
            <td>${slCmjRight?.rsi ? slCmjRight.rsi.toFixed(3) : 'N/A'}</td>
            <td style="color: ${(() => {
              if (!slCmjLeft?.rsi || !slCmjRight?.rsi) return '#ccc';
              const diff = Math.abs(slCmjLeft.rsi - slCmjRight.rsi);
              const avg = (slCmjLeft.rsi + slCmjRight.rsi) / 2;
              const asym = (diff / avg) * 100;
              return asym <= 5 ? '#27AE60' : asym <= 10 ? '#F39C12' : '#E74C3C';
            })()}; font-weight: 600;">
              ${(() => {
                if (!slCmjLeft?.rsi || !slCmjRight?.rsi) return 'N/A';
                const diff = Math.abs(slCmjLeft.rsi - slCmjRight.rsi);
                const avg = (slCmjLeft.rsi + slCmjRight.rsi) / 2;
                const asym = (diff / avg) * 100;
                return `${asym.toFixed(1)}%`;
              })()}
            </td>
          </tr>
          <tr>
            <td>Peak Power</td>
            <td>${slCmjLeft?.peakPower ? `${slCmjLeft.peakPower.toFixed(2)} W` : 'N/A'}</td>
            <td>${slCmjRight?.peakPower ? `${slCmjRight.peakPower.toFixed(2)} W` : 'N/A'}</td>
            <td style="color: ${(() => {
              if (!slCmjLeft?.peakPower || !slCmjRight?.peakPower) return '#ccc';
              const diff = Math.abs(slCmjLeft.peakPower - slCmjRight.peakPower);
              const avg = (slCmjLeft.peakPower + slCmjRight.peakPower) / 2;
              const asym = (diff / avg) * 100;
              return asym <= 5 ? '#27AE60' : asym <= 10 ? '#F39C12' : '#E74C3C';
            })()}; font-weight: 600;">
              ${(() => {
                if (!slCmjLeft?.peakPower || !slCmjRight?.peakPower) return 'N/A';
                const diff = Math.abs(slCmjLeft.peakPower - slCmjRight.peakPower);
                const avg = (slCmjLeft.peakPower + slCmjRight.peakPower) / 2;
                const asym = (diff / avg) * 100;
                return `${asym.toFixed(1)}%`;
              })()}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="margin-top: 1rem; padding: 1rem; background: #F8F9FA; border-radius: 6px;">
      <h4 style="color: #2C3E50; font-size: 1rem; margin-bottom: 0.5rem;">Asymmetry Color Guide:</h4>
      <div style="display: flex; gap: 2rem; font-size: 0.9rem;">
        <div><span style="color: #27AE60; font-weight: 600;">● Green:</span> ≤5% (Good)</div>
        <div><span style="color: #F39C12; font-weight: 600;">● Yellow:</span> 5-10% (Moderate)</div>
        <div><span style="color: #E74C3C; font-weight: 600;">● Red:</span> &gt;10% (High)</div>
      </div>
    </div>
  </div>

  ${slCmjRecommendations ? `
  <div class="test-recommendations">
    <h4>Single Leg CMJ Test Recommendations</h4>
    <p>${slCmjRecommendations}</p>
  </div>
  ` : ''}
  ` : ''}

  ${ppu && Object.keys(ppu).length > 0 ? `
  <div class="metrics-layout" style="page-break-before: always;">
    <div class="report-section">
    <h3>Plyometric Push-Up (PPU) - Detailed Metrics</h3>
    <div class="cmj-metrics-table">
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Athlete Value</th>
            <th>Percentile</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Pushup Height</td>
            <td>${ppuComp.metrics?.pushupHeight?.value?.toFixed(2) || 'N/A'} in</td>
            <td>${ppuComp.metrics?.pushupHeight?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Eccentric Peak Force</td>
            <td>${ppu.eccentricPeakForce?.toFixed(2) || 'N/A'} N</td>
            <td>${ppuComp.metrics?.eccentricPeakForce?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Concentric Peak Force</td>
            <td>${ppu.concentricPeakForce?.toFixed(2) || 'N/A'} N</td>
            <td>${ppuComp.metrics?.concentricPeakForce?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Concentric RFD Left</td>
            <td>${ppu.concentricRFD_L?.toFixed(2) || 'N/A'} N/s</td>
            <td>${ppuComp.metrics?.concentricRFD_L?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Concentric RFD Right</td>
            <td>${ppu.concentricRFD_R?.toFixed(2) || 'N/A'} N/s</td>
            <td>${ppuComp.metrics?.concentricRFD_R?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Eccentric Braking RFD</td>
            <td>${ppu.eccentricBrakingRFD?.toFixed(2) || 'N/A'} N/s</td>
            <td>${ppuComp.metrics?.eccentricBrakingRFD?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
        </tbody>
      </table>
      ${ppuComp.summary?.totalTests ? `
      <p class="comparison-note">
        Compared against professional baseball players from MLB/MiLB
      </p>
      ` : ''}
    </div>
    </div>

    <div class="report-section">
      <h3>PPU Metrics vs MLB Pro Average</h3>
      <div class="spider-chart-container">
        <canvas id="ppuSpiderChart"></canvas>
      </div>
    </div>
  </div>

  ${ppuRecommendations ? `
  <div class="test-recommendations">
    <h4>PPU Test Recommendations</h4>
    <p>${ppuRecommendations}</p>
  </div>
  ` : ''}
  ` : ''}

  ${hopTest && Object.keys(hopTest).length > 0 ? `
  <div class="metrics-layout" style="page-break-before: always;">
    <div class="report-section">
    <h3>Hop Test - Detailed Metrics</h3>
    ${hopComp && hopComp.metrics ? `
    <div class="cmj-metrics-table">
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Athlete Value</th>
            <th>Percentile</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>RSI (Reactive Strength Index)</td>
            <td>${hopComp.metrics.rsi?.value?.toFixed(2) || 'N/A'}</td>
            <td>${hopComp.metrics.rsi?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Jump Height</td>
            <td>${hopComp.metrics.jumpHeight?.value?.toFixed(2) || 'N/A'} in</td>
            <td>${hopComp.metrics.jumpHeight?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Ground Contact Time (GCT)</td>
            <td>${hopComp.metrics.gct?.value?.toFixed(3) || 'N/A'} s</td>
            <td>${hopComp.metrics.gct?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
        </tbody>
      </table>
      <p class="comparison-note">
        Compared against professional baseball players from MLB/MiLB
      </p>
    </div>
    ` : ''}
    </div>

    <div class="report-section">
      <h3>Hop Test Metrics vs Pro Average</h3>
      <div class="spider-chart-container">
        <canvas id="hopTestSpiderChart"></canvas>
      </div>
    </div>
  </div>

  ${hopRecommendations ? `
  <div class="test-recommendations">
    <h4>Hop Test Recommendations</h4>
    <p>${hopRecommendations}</p>
  </div>
  ` : ''}
  ` : ''}

  ${(trainingGoals || actionPlan) ? `
  <div class="training-goals-section">
    <h3>Training Goals & Action Plan</h3>
    ${trainingGoals ? `
    <div class="training-goals-content">
      <h4>Training Goals</h4>
      <p>${trainingGoals}</p>
    </div>
    ` : ''}
    ${actionPlan ? `
    <div class="training-goals-content">
      <h4>Action Plan</h4>
      <p>${actionPlan}</p>
    </div>
    ` : ''}
  </div>
  ` : ''}

  <script>
    // Generate spider chart data
    const reportData = ${JSON.stringify({ cmj, cmjComp, sj, sjComp, imtp, imtpComp, ppu, ppuComp, hopTest, hopComp, selectedMetrics })};

    // CMJ Spider Chart
    if (reportData.cmj && reportData.cmjComp?.metrics) {
      // All available CMJ metrics
      const allCmjMetrics = [
        { key: 'jumpHeight', label: 'Jump Height' },
        { key: 'rsi', label: 'RSI' },
        { key: 'peakPowerBM', label: 'Peak Power / BM' },
        { key: 'eccentricBrakingRFD', label: 'Ecc Braking RFD' },
        { key: 'concentricPeakVelocity', label: 'Con Peak Velocity' },
        { key: 'eccentricPeakPowerBM', label: 'Ecc Peak Power / BM' },
        { key: 'forceAtZeroVelocity', label: 'Force @ Zero Velocity' },
        { key: 'eccentricPeakForce', label: 'Ecc Peak Force' },
        { key: 'concentricImpulse', label: 'Concentric Impulse' },
        { key: 'eccentricPeakVelocity', label: 'Ecc Peak Velocity' },
        { key: 'eccentricPeakPower', label: 'Ecc Peak Power' },
        { key: 'peakPower', label: 'Peak Power' },
        { key: 'countermovementDepth', label: 'Countermovement Depth' }
      ];

      // Use selected metrics if provided, otherwise use default metrics
      const selectedCmjMetrics = reportData.selectedMetrics?.cmj || ['jumpHeight', 'rsi', 'peakPowerBM', 'eccentricBrakingRFD', 'concentricPeakVelocity', 'eccentricPeakPowerBM'];
      const keyMetrics = allCmjMetrics.filter(m => selectedCmjMetrics.includes(m.key));

      const labels = [];
      const athleteValues = [];
      const mlbAverages = [];

      keyMetrics.forEach(metric => {
        const athleteValue = reportData.cmj[metric.key];
        const mlbStats = reportData.cmjComp.metrics[metric.key];

        if (athleteValue !== undefined && mlbStats && mlbStats.percentile !== undefined) {
          labels.push(metric.label);

          // Use actual percentile from database for accurate chart positioning
          athleteValues.push(Math.max(0, Math.min(100, mlbStats.percentile)));
          // Pro average (mean) should be at 50th percentile
          mlbAverages.push(50);
        }
      });

      const ctx = document.getElementById('spiderChart').getContext('2d');
      new Chart(ctx, {
        type: 'radar',
        data: {
          labels: labels,
          datasets: [
            {
              label: '${athlete}',
              data: athleteValues,
              backgroundColor: 'rgba(59, 130, 246, 0.4)',
              borderColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(59, 130, 246, 1)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
            },
            {
              label: 'MLB Average',
              data: mlbAverages,
              backgroundColor: 'rgba(243, 156, 18, 0.3)',
              borderColor: 'rgba(243, 156, 18, 1)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(243, 156, 18, 1)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(243, 156, 18, 1)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: 'CMJ Metrics vs MLB Professional Average'
            }
          },
          scales: {
            r: {
              angleLines: {
                display: true
              },
              suggestedMin: 0,
              suggestedMax: 100,
              ticks: {
                stepSize: 20
              }
            }
          }
        }
      });
    }

    // SJ Spider Chart
    if (reportData.sj && reportData.sjComp?.metrics) {
      const sjKeyMetrics = [
        { key: 'jumpHeight', label: 'Jump Height' },
        { key: 'forceAtPeakPower', label: 'Force @ Peak Power' },
        { key: 'concentricPeakVelocity', label: 'Con Peak Velocity' },
        { key: 'peakPower', label: 'Peak Power' },
        { key: 'peakPowerBM', label: 'Peak Power / BW' }
      ];

      const sjLabels = [];
      const sjAthleteValues = [];
      const sjMlbAverages = [];

      sjKeyMetrics.forEach(metric => {
        const athleteValue = reportData.sj[metric.key];
        const mlbStats = reportData.sjComp.metrics[metric.key];

        if (athleteValue !== undefined && mlbStats && mlbStats.percentile !== undefined) {
          sjLabels.push(metric.label);
          sjAthleteValues.push(Math.max(0, Math.min(100, mlbStats.percentile)));
          sjMlbAverages.push(50);
        }
      });

      const sjCtx = document.getElementById('sjSpiderChart').getContext('2d');
      new Chart(sjCtx, {
        type: 'radar',
        data: {
          labels: sjLabels,
          datasets: [
            {
              label: '${athlete}',
              data: sjAthleteValues,
              backgroundColor: 'rgba(59, 130, 246, 0.4)',
              borderColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(59, 130, 246, 1)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
            },
            {
              label: 'MLB Average',
              data: sjMlbAverages,
              backgroundColor: 'rgba(243, 156, 18, 0.3)',
              borderColor: 'rgba(243, 156, 18, 1)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(243, 156, 18, 1)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(243, 156, 18, 1)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'top' },
            title: {
              display: true,
              text: 'SJ Metrics vs MLB Professional Average'
            }
          },
          scales: {
            r: {
              angleLines: { display: true },
              suggestedMin: 0,
              suggestedMax: 100,
              ticks: { stepSize: 20 }
            }
          }
        }
      });
    }

    // IMTP Spider Chart
    if (reportData.imtp && reportData.imtpComp?.metrics) {
      const imtpKeyMetrics = [
        { key: 'peakVerticalForce', label: 'Peak Vertical Force' },
        { key: 'peakForceBM', label: 'Peak Force / BM' },
        { key: 'forceAt100ms', label: 'Force @ 100ms' },
        { key: 'timeToPeakForce', label: 'Time to Peak Force' }
      ];

      const imtpLabels = [];
      const imtpAthleteValues = [];
      const imtpMlbAverages = [];

      imtpKeyMetrics.forEach(metric => {
        const athleteValue = reportData.imtp[metric.key];
        const mlbStats = reportData.imtpComp.metrics[metric.key];

        if (athleteValue !== undefined && mlbStats && mlbStats.percentile !== undefined) {
          imtpLabels.push(metric.label);
          imtpAthleteValues.push(Math.max(0, Math.min(100, mlbStats.percentile)));
          imtpMlbAverages.push(50);
        }
      });

      const imtpCtx = document.getElementById('imtpSpiderChart').getContext('2d');
      new Chart(imtpCtx, {
        type: 'radar',
        data: {
          labels: imtpLabels,
          datasets: [
            {
              label: '${athlete}',
              data: imtpAthleteValues,
              backgroundColor: 'rgba(59, 130, 246, 0.4)',
              borderColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(59, 130, 246, 1)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
            },
            {
              label: 'MLB Average',
              data: imtpMlbAverages,
              backgroundColor: 'rgba(243, 156, 18, 0.3)',
              borderColor: 'rgba(243, 156, 18, 1)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(243, 156, 18, 1)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(243, 156, 18, 1)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'top' },
            title: {
              display: true,
              text: 'IMTP Metrics vs MLB Professional Average'
            }
          },
          scales: {
            r: {
              angleLines: { display: true },
              suggestedMin: 0,
              suggestedMax: 100,
              ticks: { stepSize: 20 }
            }
          }
        }
      });
    }

    // PPU Spider Chart
    if (reportData.ppu && reportData.ppuComp?.metrics) {
      const ppuKeyMetrics = [
        { key: 'pushupHeight', label: 'Pushup Height' },
        { key: 'eccentricPeakForce', label: 'Eccentric Peak Force' },
        { key: 'concentricPeakForce', label: 'Concentric Peak Force' },
        { key: 'concentricRFD_L', label: 'Concentric RFD Left' },
        { key: 'concentricRFD_R', label: 'Concentric RFD Right' },
        { key: 'eccentricBrakingRFD', label: 'Eccentric Braking RFD' }
      ];

      const ppuLabels = [];
      const ppuAthleteValues = [];
      const ppuMlbAverages = [];

      ppuKeyMetrics.forEach(metric => {
        if (reportData.ppuComp.metrics[metric.key]?.percentile !== undefined) {
          ppuLabels.push(metric.label);
          ppuAthleteValues.push(reportData.ppuComp.metrics[metric.key].percentile);
          ppuMlbAverages.push(50); // MLB average is 50th percentile
        }
      });

      const ppuCtx = document.getElementById('ppuSpiderChart').getContext('2d');
      new Chart(ppuCtx, {
        type: 'radar',
        data: {
          labels: ppuLabels,
          datasets: [
            {
              label: '${athlete}',
              data: ppuAthleteValues,
              backgroundColor: 'rgba(59, 130, 246, 0.4)',
              borderColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(59, 130, 246, 1)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
            },
            {
              label: 'MLB Average',
              data: ppuMlbAverages,
              backgroundColor: 'rgba(243, 156, 18, 0.3)',
              borderColor: 'rgba(243, 156, 18, 1)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(243, 156, 18, 1)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(243, 156, 18, 1)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'top' },
            title: {
              display: true,
              text: 'PPU Metrics vs MLB Professional Average'
            }
          },
          scales: {
            r: {
              angleLines: { display: true },
              suggestedMin: 0,
              suggestedMax: 100,
              ticks: { stepSize: 20 }
            }
          }
        }
      });
    }

    // Hop Test Spider Chart
    if (reportData.hopTest && reportData.hopComp?.metrics) {
      const hopKeyMetrics = [
        { key: 'rsi', label: 'RSI' },
        { key: 'jumpHeight', label: 'Jump Height' },
        { key: 'gct', label: 'Ground Contact Time' }
      ];

      const hopLabels = [];
      const hopAthleteValues = [];
      const hopProAverages = [];

      hopKeyMetrics.forEach(metric => {
        if (reportData.hopComp.metrics[metric.key]?.percentile !== undefined) {
          hopLabels.push(metric.label);
          hopAthleteValues.push(reportData.hopComp.metrics[metric.key].percentile);
          hopProAverages.push(50); // Pro average is 50th percentile
        }
      });

      const hopCtx = document.getElementById('hopTestSpiderChart').getContext('2d');
      new Chart(hopCtx, {
        type: 'radar',
        data: {
          labels: hopLabels,
          datasets: [
            {
              label: '${athlete}',
              data: hopAthleteValues,
              backgroundColor: 'rgba(59, 130, 246, 0.4)',
              borderColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(59, 130, 246, 1)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
            },
            {
              label: 'Pro Average',
              data: hopProAverages,
              backgroundColor: 'rgba(243, 156, 18, 0.3)',
              borderColor: 'rgba(243, 156, 18, 1)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(243, 156, 18, 1)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(243, 156, 18, 1)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'top' },
            title: {
              display: true,
              text: 'Hop Test Metrics vs Pro Average'
            }
          },
          scales: {
            r: {
              angleLines: { display: true },
              suggestedMin: 0,
              suggestedMax: 100,
              ticks: { stepSize: 20 }
            }
          }
        }
      });
    }
  </script>
</body>
</html>
  `;
}

export default { generatePdfFromHtml };
