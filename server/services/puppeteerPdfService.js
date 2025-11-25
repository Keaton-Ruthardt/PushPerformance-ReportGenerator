import puppeteer from 'puppeteer';

/**
 * Generate PDF from web UI using Puppeteer
 * This ensures the PDF looks exactly like the web UI
 */
export async function generatePdfFromHtml(reportData, outputPath) {
  let browser;

  try {
    console.log('🚀 Launching headless browser for PDF generation...');

    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2 // High DPI for better quality
    });

    console.log('📄 Generating report HTML...');

    // Generate HTML content with embedded data
    const htmlContent = generateReportHtml(reportData);

    // Set content directly
    await page.setContent(htmlContent, {
      waitUntil: ['networkidle0', 'domcontentloaded']
    });

    // Wait for Chart.js to load and charts to render
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if (typeof Chart !== 'undefined') {
          // Chart.js is loaded, wait for chart to render
          setTimeout(resolve, 2000);
        } else {
          // Wait for Chart.js to load with timeout
          let elapsed = 0;
          const maxWait = 10000; // 10 seconds max
          const checkChart = setInterval(() => {
            elapsed += 100;
            if (typeof Chart !== 'undefined') {
              clearInterval(checkChart);
              setTimeout(resolve, 2000);
            } else if (elapsed >= maxWait) {
              // Timeout - proceed anyway
              clearInterval(checkChart);
              console.warn('Chart.js loading timeout - proceeding without chart');
              resolve();
            }
          }, 100);
        }
      });
    });

    console.log('📊 Charts rendered successfully');

    console.log('💾 Generating PDF...');

    // Generate PDF
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
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
function generateReportHtml(reportData) {
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
      height: 50px;
      margin-right: 20px;
      filter: brightness(0) invert(1);
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
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAACfCAYAAACP12FFAAAABHNCSVQICAgIfAhkiAAAIABJREFUeJzt3XlcVFX7APDn3HtnYABBQERFSE3E1DSRBDQVNdNSw315XTJNMsv3LcuKFzPflp9aWq5ZpuZS5l65lJWYW265K24o4L6hCMIIM/fe8/uDOXgdWWZg7twZeb6fz3xEmLn3mbucc+5ZARBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIQTE0RucPXt29aNHj/YhhJgcvW1XRwgBAKD37t27tXjx4js+Pj5yq1at7mzYsOGMXq/P1zo+W02ePLleenp6Z0KI2Zb3y7LM+/n5ZX7++edr1I5Na6+++upzAFCvrGNDKSWWfz3Cw8N/Hjdu3GWnBOgkv/32m//kyZPDtm3bVvX555/3rF27ti/HcXpCiCcAyADAaR1jKajlJcmynL9r167M1NRUc9euXW+tWbPmHCGkQOsAHendd9+tmpOT0xcAgFJKLelUsSilAACUEMJPmTJloZ+fn+ikMF3Ga6+91oVSGkoplS3HqtR8UpZlXe3atTdPmDAh1TkRurC33377Obh/g1XalyAIVBAEGhQURMPDw2/XqFHjaM+ePecOGzasY4UPsspGjhyZAHZ+35iYmCvaROt0G8DOYzNy5Mje2oTqONOnT6/Tv3//V9u2bfuzn5/fpYiIiJyAgADK87zm91pFX4QQqtPpaHBwMI2IiLgVFBR0qmvXrgv69OnT/8CBAwGOP5rO1aRJk6d0Op1dxyQwMJDu2bOnukYha4oQsg3svIZ69uw5RZtoK0Zw9AY5jpMAAARBAFmWobTS5qOOUgqZmZlw8+ZNf57n/X/66acn9Xr9qIiIiOtPPfXU94sXLx7v6enpcjUDhBARoPAcWp4ISiVJEhBCXO57qIHn+QKAwtqeso4NIQREUQSO49z2KWrIkCEDz549m/TRRx81vn37NgAUXhenT58GQggQQoDneQAovN7d8X6nlIIkSXDz5k24fv16AMdxARs3bozQ6XTDt2/fTrt06fJ7y5YtP/7oo492aR1reQiCIHt5eUFubq5N160syyAIAhgMBslJIboULy+v/Px825MzSZIACgsCbsfhBQBbMozKgB0HjrtfE8oKRadPnw4+ffr02ykpKaNffPHFduvWrftHqzjLwhJ0G84rnvhHyL/+9a86aWlpm5cuXfo4AADP8w8UCFmmzzIUSilwHOdW9z+LXXmNs+/FvmtmZibZtGlTl02bNnXp2LHjpjZt2vSZOHFinpZxOwshxH1Opsbc9Vi5cjvdI4vneeB5Ho4fP2747bff9g0fPjxB65iU3CkRR473xhtvRP7111+pe/bsedz6CZ9hP7N/bXmydDXK76AsCCgLNYQQ0Ov1wHEcJCcnd/nhhx+OzZ07N1jLuBFyFIcXANy1JOQMLFFheJ4Hs9kM69at+2bs2LFx2kX2IEopFgwrqR9//DFgy5Ytv169elXQ6XRFmb+Su1b1l4Q1ZTDWBRlLExfwPA+pqal158+fv9XJISKkCkzoNcbzPGRmZsLmzZtXrFq1yqB1PKhyW7x48aQTJ04Eu1t1vtpYoUcQBDhw4EDDtm3bTtM6JoQqymUKANal8MpEEAQ4evRo9ZUrVw7VOpbiYEZQOcyYMaPGnj17EjiOK/bJvzIjhIAsywBQeL8ePHhw7PLly6tqHBZCFaJGJ0DO8m9Rpl5SBsI6DgEU9jzlOM6tCgFslIOyE1F5OkOxhOX06dMTKaXzsBnFvVlf8+7SpPLdd9+9f+fOHeB5vuiaLAnLEJWdXN2d9fexvoeV93Vubi6sXLkyCQDGOTNGtSk7Roqi6D6JMSoXhxcAwI7e4CwRYf+Wlei4MtZGyHFc0XeytRDAcRxwHAdHjx6t8c477zQHgIPqRouczF0KdINteZOy4O6Onf9KwvM8SJJUbKdH6/8TQuDUqVO94RErAKDKRY0CgN28vLwgJibmFAC41XhpQoggy7Kn2Wz2zszMDEpJSQGAwoTEnkRR2alq27ZtPQELAMjJVq5cWbtfv36BPM+XmqkTQkCSpKLCujsX2ktiS20kpRSysrLqJiUl1f/000/POjE85ILctRCseQFAlmVo3Lhx/qJFi6JCQkLcbnwtpVTYt2+fPjk52T8vLy927969r+/YsSPObDaX2QRSHH9//7YqhotQsRYtWtQK4MFaueKIogiRkZFH+/btO9pkMlFQYTpxLQmCIJ07d679woUL/6+0fhCCIMC1a9fg2rVrbQEACwCVHMdxbnkfaF4AsOBWr16tdQzlYpk1TwQAIwCsBoDVb7zxRtc5c+ZssPy9zG0oCwhXr159Up1IESqZwWBox34uqw+LwWC4mZiY+LdTAtNAYmKiX2l/ZzV2lFLIz89/3FlxlRfrm/SoDd90JbIsu2UVgEv04KGUErZ4yqNg9uzZGxMSEj5l/Rrs6RSYm5vrpXJ4CD2koKCgAYDNVfqPzL1aHFEUS30wUtbqpaWlNXBKUBXAcVypCwChihMEwSXyUnu5Sg3AI+frr7/+cN++fUmHDh2yaXQDIQQ4jgOj0ejhpBARKnLr1i2c3e6+MhNzdj/n5OQ4vcYuKSmpe35+vs6Gt/KNGzfeOmXKlEevo4aLmjlzZo2MjIy2bD0Vi4cSf0op8fT0NHXs2HFjx44dNVtzwSUKAI/iHACEEKlHjx7Jhw4dKnP1P+UUpPfu3YOMjIyqderUuaN6kAhZ5OXlVQewuVf/o3WzloNi6K/TJ0yYN2/eups3b9r03hEjRrxRUFDwh7t2UnMXkiRRAIAzZ848P3v27IW2fCY0NBTS0tL8ACBH1eBK4RIFAADb2srdDaX0OAB0tGVVRHaDyrIM9+7dc8vqJOS+zGZzMAAWAGylOEZOPxasRrG0ORjYSpSSJBHreUUepaGbroLneXYdiJb/P/B362MuSRJwHGfSehQNZjQqqlu37jkA2wo35RkxgJAjUEq5goIC9rPG0bgHdpwEQRBc+ZjhpGLOobgGij3ernqNYAFARQEBAdcAbG/iwF66SCO82WwGANdNqLRQWoFcMQ+CJ2A6ispJ6/TeZZoAHkUeHh55APcTi5JOtvUMY5gIIycjtjRTVTbWU32L4v1+XbVr15YCAwMvN2jQYCkhBDvZIbtRSokkadb/DwCwAKAqWzNy63XIEXIygtdd8dhSwJRSCA8PN3IctzU2NnZ9tWrV/pg6dWrakSNHtA4RubDSanUJIVTrRbewAOAilIUASZKwShEhjbDFmzw8PKBJkyZXeJ7/LSoqaoXJZNo9b9683NOnTztkPwkJCT1zcnLaE0JMJYdCBUopbzAYLixatGiq5ZcO2T9Snw2dvykAwIgRIz7Ny8vzLKPPBpFlWahXr96GSZMm/emI+LAAoCJlpm4LdmPjDY6cDa+5+wIDA8/26dPn9a5du/728ssvpwMA7Nmzx+H72bFjx3MnT54cZct7IyMjTwLAVADt242RYxBCqCAUZsHJycnvZmRk2JQfDxkyJBsAsADwqGFVjZgYIy1gxlIoMTExBQBS1J6enBAiseF8xVUVs1UXRVEEnudNyt8j96fsAyAIQgEACCU1CbC8wdIk5bBF87CqGSFEMVPRFha+kBawAIAQQghVQlgAQAhJPM8XDXvD2gCEnEurGiAsACCEqE53f20ZrI5GqHLAAgBClRwhRNbr9QCAHcwQqkywAOAiMOFFWvL09LRteblCeLG6MUxrEIMFABWZTCZvgLJn+GND/3AtAKQVg8FQtG6FDTAH0ZAynXB0Zs62LUkS6PX6SnmeKaWVJhHGAoCKsrOzqwHgIj/I9fn7+9+29b14LT/a2NwENWrUcNh4c3ciSZJcWWpJcCIgFaWmptZnP9vSuxoTVqQVX1/fNABoZ+N1qu0KJkhVlFIoKCiABQsWPD958uQsACC2LCtMKXX6mhKWxZoqvFOW9np5eRXMmDHDLzU1FbSep98ZsACgIkmSmgLYvsgPG4ZVpUoVTGCRUxmNxh0A8HJZ7yOEwLlz56K7d+++TpZljlJKSWHqSaBwQiFq+dnlFDPTnizLsslkMhXcu3fPLIpiVq1atU40bdo0vWbNmhciIyPTY2JizBqFqxlCCOTk5MB77723WetYtCIIQqXoK4EFAJVQSoWoqKhn7fmMLMvg7e0NdevWvaNWXAgVp0OHDvs3bNgAhBAobWlgjuPgypUrvleuXOnu5BCd5pdffgEvLy+IiIi4ERcXd7J27dprIiMjV44dO/a61rE5Azv3leEJuCSVIfMHwAKAahISEt4/cOAAcBxXZg0AW3NclmXw8PAocESVFkL2GDt27LF69epJaWlpfFkJ/6OWMSjvTXYvFhQUwKFDh6oDQHUAaPf3339//vTTTy9599133+zbt69Rs2ARciDsBKiCpKSk/uvWrfuYJSa2tO3LsgwAAHq9vtJVOSLXULNmzVUAlefph1Hep8oVPDmOA57nged5SE9P9/jnn39GJiUlXUxMTIzVOGSEHMJVCgB0zJgx97QOoiIopR5jxowZ8sILLxz+8ssvl1+/fr3oSYmt+FQSltgAAISFhZ1VPViEitGsWbNJHh4elbozqvWQXPavIAjA8zycOXMmYN68ebtef/31aK1jRaiiXKIJ4NixY/r4+PjjvXr1MoGLdiBSYPFRURS9jEZjtcuXL/spE02e50Gn0z2QiNjqzp07WxwcL0I2+eqrr44+88wzW3fu3BnH8zyuCwAPd+DleR6ysrLgxx9/3PPbb7/5Pf/88zkahodQhWheAOA4DvLz82HdunUNtY6lIniefyDDZ1X6tlDOE9CuXbufDxw4oFaYCJUqNjZ2dFpa2rErV67wgqB58uCSeJ6H27dvw5QpUxYCQB+t43EmVysQVubaKkdwiSYAZXubIAgu+2LtgdYvjuMeyMTtvSgJISCKIkREROQGBgbuVuMYI2SLzz///GT37t1f9vLyAlEsnAdG2TZe3HVemRJh1lmX4zg4d+5c90WLFtXSOiZnsu4v4eove79LZaN5AUDZzgbwYBucq71K+w72Xjxse8rPRURETE1KSqqUs28h1/HNN98s7dOnT886derIkiQ9UJulzPTZcMHKtIyw8jtevHhR/9dffw3SMByHY+eRjV6yTte0ztCLy7BLS69L+2xJ6XtlKghgHZ9GlBeZ5ek/LzY2dta6des0jAqhQkuWLPn5jz/+8J8xY8ZXBw8eHHD16lUeoHCCFEmSQBCEhwoDrCasMuB5HmRZhuPHj/cEgM+1jsdRWOZvXfCrTCpT/xcsAGiMJaYxMTGvJSYm2jwfO0Jqe+6553IAYDCl9OXBgwd3vX379r/27NkT5+PjE3jz5k1OFMUHEslHKcNgT8AlYbUeRqPxie+//77q4MGD3WLyrrIyNvY0rNfroXv37vMEQcixzO7oqrkh56gndlmWZZ1OJ+3du3dwampq6KM230VxsACgEuWNpqyqUv7LEsxu3brNWLx48VINwkSoTIQQMwD8bHnBhAkTHps5c+bj4eHhQSEhIY9lZWWF5ObmVjEajZ4FBQUe7HOW69xt6lMV96fu9OnT3QoKCkosBLBmy/Pnz1edPn36YwDg1AIA239p8dnze2v+/v6wcuXKtwghlW7SI71e35zn+VCt43AGLACoRJZlEAQB2FMSK00qM/969erR2NjYUT/88MM8LWNFyB5vvfXWeQA4n56ernUoqpgyZQo/a9as/MuXLwslZbAs8zUajRAdHd1o//79R5wcpioIKVwKmFIKx44d8wSASlcA0Ol0nCiKlaIvgOadAAHK14nO1bF2NIDC72c2m0EURZAkCapUqQKxsbFrExISIjDzR8i1bN261UeW5TLTRlaYP3LkCE4K9Ih51PKjkrhEDQAbbvQoEgQBPDw8wMfHp6BevXoZAQEBSxISEr6Mj4+/t3s3jvhDyNVwHEd5nreprpzjODhy5MjjaseEkBo0LwBQSiEoKOheXFzcYo7jKHHThXBYeyfHcZIgCPk8zxslSco2m83H27dvn/7qq6+mXr9euJjYxo0bNY0VIVQ6e3qAS5KkVzEUp2P9l0RRrByPwZWY5gUAWZYhLCzszqpVq17TOha1LF++XOsQEEIqkGUZGjVq5LN//36tQ3G4yjAMrrJziT4AsiyTjRs36rSOAyGE7G3/1ev1j1QNAKo8NK8BsCBY3YQQckeEkPIWAGhZs4yiR5v1EHFnc4kCACGECoKAdwFCyB2V6+GFjX5iS4Fbw4LBo48VAFinU2ePPnCJJgALrAFACFUamMEjRpIkTfJil6gBQAihyoZSKlBKi+YLKebvRbUDlFLsZ/AIUswWqwMofTptxUyVDsu3sQCAECrToEGDmsXFxZ0ZOXLkPa1jeVTUqlVrx71796pyHGcu6T0cx8kmk0nn5+eX5czYkHOwDL969eoLzWazN8dxJVYLWYZm6n19ffc5av9YAEAIPYBSyo0bN+7JjIyMuMzMzM6HDx+O2b17t3+DBg0aAECq1vE9KpKTk5cBwDJb3nvhwgWVo0FaIJZG/7///nuUrZ+ZM2eOw/aPBQCEKrnDhw9XnTp1ahuz2dzlypUrMbVq1YrMysqC/Pz8ovdYlr/FRmuEHIQQQnU6nab3FBYAEHIwd+jc9c477+iOHj367c2bN1+IiooKUk7Hzdqd2ZK4bDErnU7nSp2GKy21105xh+vX1XAcZ/cJkSSJv3v3rqad3/GGRg8hhDw6C7s7mD0Jr6LTjsuNcAkKCgpKS0t76dChQ0EAhZk9z/PA83xRBsNe7HtIkoTXhcYopcSWDJq9h+M4zrpjWWVZ6MaZOEupmVLK2/EZ2WAwaFrawgIAekhpHVFQ2VimqUiEXS7jzM/P5xQ9zMvMFJQFAaQdtlYKO2clvdi5NZvNUnmeTpF9JMtQDo7jJAAo9dwoa3BkWdb03GATAHqIIAiP7vKMTqDI+EGWZdDr9S53PM1mcz7LJGzJ3DHzLxmltMRe/Crtj/UIL/O9bHgZUhchhAMAkCTJA8DmFW71JU0C5SxYAEAPYaVYVH6s/RwAQKfTudzxFEUxDwCyAcBP61jcnSzLTi0AtGrVasidO3d4Dw+PEnMZQgiYzWZdw4YN/9y7d29V9jukDlEUJQCAkJCQP9u3b/8yz/OlXhOUUuLn5ye1atXKqOVicVgAQA8xGAxGrWNwd5TSojG+fn5+Lnc869WrJ+v1eqdmXI+qzMzMPGfub926dd/b+t6//voLmjdvHgBgW1MPKh/WzJKUlHQBABbZ+rm1a9eqFZJNsA8Aeoher8/R6/VY7esAHh4eUKNGjdtax2GtX79+kqenpxGg9NnHGMw4iicIApw9exYLUpWcu6aVWABAD7l169aFKlWquO1F7Qo4jgNKKfj4+EBgYOAdreOxVrVqVdHDwyMXwLbMHa+F4omiCHXr1r2ldRxIW+5aQMYCAHoIpfSOv7//PVmWbU743fUGsJdi7u5S36es/vfw8LiqemDlwPN8TlnvUVYb8zxfKU5yQUEBKWvoprInd8uWLY85JTDksmRbqtFcEBYA0EPmzp2b7e/vnwkARePCy8LzvMv1dFcDIUQEsK3anFIKtWrVuta9e3eX6wQIAMBx3N/2vD8wMLBSrAPQs2dPI8dxsq2FX39//wMqh4RcnLvWkGEnQPQQQoi5UaNGxwEgFKAwsyutEMBxHKSmpoZ26dJlhSzLOuXNIMsydcfaActKbMQqdnNqamrr9PR0EATBppveaDTuVy3ICgoPD0/ZsmVL0XDFkhBCIDMzE9asWbO0c+fOWbIsU3dN8EpDKaUcx5HVq1frbty4wZc2RIt9/5CQEEhLSzvrrBgRciQsAKBiNWrUaNuJEyeel2W5qD27JBzHwbVr1wybNm3q58QQNcFxHAhC6beNsto8JCRk78GDB50Rmt1ycnJ2BQUFwa1bt0ot4LF5ApKTk+OcF522BEEos+ZLkiQIDAy88Pvvv190x0IuQlgAQMUSRfH3wMDAyVlZWQBQept3myu+sijr6ZcdK19fX/D39//JGTGVx48//ng6IiIiPTMzs25Z55cQgue4GEFBQdtZsxBC7gb7AKBi/fzzz4cDAwNT3LRvi+YkSYI6dersW7JkSbrWsZSmTp06ax7F6nxn8PLygvr166/WOg6EygsLAKhEsbGxHwFUnh7+jvb0009/qXUMZXnxxRc/q1WrlsxGfOC5to0kSRASEnLjm2+++UXrWBAqLywAoBItXrx4ZXR09HHLOhdu29O1vIpbvKO09zKSJEFUVFTK/PnztZvj00avv/76zejo6MnW55bNN1/ZznlJ2PlVnuemTZt+oFU8FaE8t8W9mMrU5FNZYQEAlap///4Da9asCZIkgSAImCiUQZIkqFmzJrRp02a4uzxN//TTT0lPPfVUqj3zPlRGimWRoW3btlvXrFkzT+OQysXWlep4nseLwUbuuuIiFgBQqcaOHXu8R48eXcLCwsBkMmEGUQpJkiA4OBhatGgR/+WXX+7TOh57/Pe//21do0aN85IksSGQNtV8VBbKFfhiYmL2bd++vb3WMSHXYT1e2F2oUQCw+0BgVaNrmzt37u8jR45s0LJly6NmsxlYJlGaynI+ZVkGSZJAFEWIiopK69+/f+SGDRvWaR2Xvfr163dz2LBhDbp16/ajXq8HURQfmhvATdM4uxTXFCJJEkiSBL6+vtC9e/dvdu/eHaNReBWiPH+lPfkrP+LUAF1IZUm/HD4MkBDyQKthy4EkhFCDwVA5jrib+uCDD1IBoNnbb7/97LFjx5L27dsXl5ubW7TuNc/zwPoKKCdQceeOZdYZIJsTgf1eEATw9fWF5s2b72rSpMlns2fP/mX/fped96dMkydPNgHAv6ZMmfLh7t27Pzh48GCfmzdvGu7de3gCQFv7RrgD6/Zv5bVsMBggODg4Jzo6emn79u2njBo1yi3H/LN7srR5Pay/FyGkUqbJhBAobRKo4pjNZpec7bMsDi8AUEp1ALYnEJIkAc/zhrLm3kauYdq0aZsBYDOlVN+hQ4dnq1at2u7EiRPPXrlypXZwcLBPfn6+h9Fo5AsKCsBsNrt1SZoQAnq9HgRBAB8fH+rh4XHvzp07Rl9f36tPPfXUtrS0tL8OHz68iRBi3Lp1q9bhOsx7772XCgBDAWDoiBEjYq5du9YuKyur48GDB5uEhIR4S5JkyM3N1eXn5xfVFLjreeZ5HnQ6HXh4eICPj4+ZEGI8f/58buvWrU8GBAT8ERYW9secOXP2Z2RkwIoVK7QOt1wIITxr0tHpdFDaiA/lWheiKFbKJmKO4zwA7Kvx8vHx8VQtIBU5vAAQFBS0x2AwPO/h4SFxHFdmqmA0GnlBEO41b94cl9R0I4QQEwD8ankBAMDOnTv9VqxYEXjo0CG/S5cuGTIzMz1NJhMH4J5Vap6enlJQUFBB1apVTS1atLjTv3//zOjo6Du3bt2C9PTC4f3u+DRojwULFuwBgD0AMAUA4OzZsx5z5syptnnz5moZGRle2dnZeqPRKLAnaFmWibuca47joEqVKmZ/f39TWFiYsU2bNrfHjh17hRAi/f23XcskuLTq1aunZmdnPyuKIs/zPOV5vsSpnCVJIjqdTjYYDFCvXj2XW8XSGXx8fN4SBCEIAMqcBIUQAllZWbpq1aoddUJoCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEECof4siNzZ071/O7776rz/O8JEkSAQAgxPZdEEIoIQR0Oh2tVatWQWJi4o1mzZrlOTJGa/3796+TkZHhxfM8rch2CCEUAMBsNvMxMTGXZ86ceccxEd7Xu3fv8EuXLgkcxwEhBCil7FXsQWYxybJMAAA4jqNVqlSR4uPjb7/xxhuZjo7P2jvvvBO0bdu26pbzSu25FqwRQkCWZY7n+eu7du1SJfaVK1dWXb58eeCNGzd0JpOJEwSBsmNoC5PJxOl0Ourr6yt27tz5zltvvXVTjTitDRgwoM7FixcNlJbvEpZlGXx8fKTY2Ni7H3/88VUHh/eQCRMmVP31119D9Hq9zHEct3PnzhRHbr9du3aNjEYjCIJAn3jiibyFCxdecOT27ZWUlFR98+bN1QghVJZlfu/evScJIZJW8WzZsoVMmzatQVZWFuF5ntuxY8eJim5z7ty5nitWrKhrNBoJx3GkdevW6dOmTTM6It7SUEqFUaNG1crIyPC8e/cuZ0kXixKaku5fSinodDpao0YN09ChQ2937do1W+1YBw4cGHbu3DkfjuOoJTa78kclWZbBZDIJbdq0uTBjxoxyxy6U94PFSUlJiTp79uwOgMIDbC92MDiOg3PnzslHjx7N6dKly7pNmza95Mg4ldLS0nadPn26piBU7FCwk2k2myEwMHAMAMx2TIT3paenn0hLSxMEQSg6vvYcZ0op6PV6uHDhQl6LFi1OJiQkDHr11VfPODpO5vr16/9LSUl5Ta/XAyu0lBVfWXienwAAHzsoRAAAGD9+fOzWrVunTJgwoVl2dnYVs9lM7L1+2fsJIcDzPKSlpeVFRkaei46OnjR37tzljozXar+kVatW21JSUsJ0Ol257zue5yEjI6MgKirqVExMzOuzZ8/+W4VwAQDg6tWr/U6ePPmNh4cHUErhpZdeennx4sWLHLHtfv36vZScnLyIUgpmsxmqVKlyBACecsS2y2vz5s37z5w5E8pxHJhMJujevfssAPi3hvFUuXjx4sGLFy96AQB07Njxt+Tk5Bcqss2MjIxWZ86cSc7LywNCCISEhIwGgLkOCbgEffr0mdakSZMBubm5Qfn5+TpRFNmDAgCU/fBJCIFz587Jx44dy42Njf2CxOaiAAAaHUlEQVRn6NChr7322mupasV78eLFf06cOFFdr9c/EANj770riiL4+fm9DgBfOSrGChk+fHgbnucpIYRyHMeensr1Un72ueeem6VWzM2bN78GAJTjOGopmVX4FRcXN0aNWJs2bUpZrBU5tuwVGRl5Vo04mYEDB85h8bLroryxKj77gSNjXLx4sV/NmjWLjmt54yvp5e3tTceNG9fakTErUUq5yMjISyz+8n4H5TXVsGHDnG+++cZDrZhfeumlUQBAeZ6nHMfRkJAQ+fPPP29U0e3OnTu3XlhYmIltGwBo+/btD1c44Aro16/f2wBAdTpd0fnx9fWln376aT2tYho3bpxvw4YNc0Bx/hs1anR87ty5uvJu8+233+7g4+PDavro888/r0oayMTHx38BZeQb9r4aN258nVJa7mNQlpYtW96GB+c10dHRoysSk0NrAADuP01IkgR+fn4F1apVuyJJkk37sVSRGbKysoKys7NBEAQQRRGOHTs2AgBUuaBYaZHjOKCUQmhoKOU4rrybIwAA/v7+qjRbKEuLgiBAaGhoGi0sNhZb1LWUKAn72WQy1b169aqO53kghEBqaurjXbt2jdm4ceMeleKlLG5JkqB69erg5eVFSyrpllZil2UZeJ4nkiTlXrjguBrd+fPnv3f16lUQBAEkSYLQ0FDQ6/VUlmVCKbW5io59J3YdnT9/HjiOg7y8PEhNTR0DAGo9UVMAkAGgqFkoNDT0kl6vz5Nlmbf8/YEYreImoig+fvnyZcLzPFBK4dSpU1W2b98+GAAWqBEwz/Oi5V8wmUxw+fJlMn/+/F///PPPBp06dTKVd7tLlixZduHCBZ0gCEXnsyLNThW1YsWKKgkJCVMBACRJAh8fH7h79y7k5OTAn3/+uQgA2moRlyiKD6R7AAAnTpxoPHXq1EsLFiyIGjFixEV7t0kI4dj9QggBk8mkahNHcnLymyx2g8EANWrUoGazGSil7DuVeuIJIcBxHDUajeTatWug0+ngzJkz1V966aVnAeA3NWIWRVFW/r9OnTogSRLlOK5cFymlFIKDg3McE50DjBgxoo0gCEWlm86dO/9enu2MHj06Pjg4WGI1CbVq1aLjxo1r4OBwAQCgWbNmV8FSmqpdu7b4v//9r4Ya+3GEJ598sqiUW69ePbvbwY8cOeL/1FNP7QHFE1K3bt0GOjxQi4EDB84GACoIAgUA2q9fP1WfCsqjW7duf4AixgULFrSr6DYppR5hYWFFpfQOHTocq+g2S9kXNG/e/DxYrotatWqZZs6cWc3ObXBt2rRJBsWTarVq1RzehMW8/PLLI8HyJOTj41N0nDp27PhHebfZq1ev/7Lt6PX6oifBDh06aFYD0Lp1659ZTE2bNr00ZsyYyWC51vR6PR01atSLWsQ1duxY34iIiBxQpAPs+m/YsGH2+++/H12Obbb38fEpqknq3r27avf6vHnz6lSvXr3oHEdHRx8s77befffdbqA4DoMHD/7QYYFaiYqKugWW+7RmzZrirFmzQtTal63K/ahb6kYtJTOj0Vj8o14Z5syZ80tYWNhl9sSSn58Pp06dquK4CO9jTwiWkiu9dOmSpxr7cQQWK6UULDesXZo1a5bVtGnTFcpt+fr6ejsyxuKwfcmy7PAap4rKysoKBLgfY25ubrmuWaUXX3yRU9YiZWdn+1d0m2VQdrglFy9etOucEkJkPz+/2QBFNS1w+/Ztg+PDLNofsH1FRkZCz549AQAgOTm5U48ePd63d3sjRox4ZseOHZ8AAISGhkJcXFy5+kI40uuvvx6XkpISr9PpwNPTEyIiIsbMmjXr/VatWp0QRRFEUYRt27Z9dfDgQdWqnEuivDYlSYIRI0awJ2I4deqU77Jly/bEx8fH27NNYlXVoubxT0lJ8TObzUX/F0Wx3DvLzs4mAPdrgimlXhWNrxRFcXIcRzZt2qR5eqhKAaBo4+Ws2rBkxmbr36mBXbis6qqinQGdRZKkcp07QRDKXcVaXorEQLv62BLk5+cbAB6IUS753baxvu4lSeIruk1bsapNez/n5eWVzzIBWZZVrTpX9tLOzs6+1KxZs1Hs/zt37pw0fvx4m59AKaW6rVu3rrx5s3DARcOGDb/Iy8tTrSOXrQ4fPjz5zp07YDabISYmZveqVat+AgBo2rTpWx4eHsDzPJw8eTLk/fffd2iHVlso+nsAAEBAQMD8559/PpEV/i5dugTbtm37eeDAgcPs2S7LRNWWl5cnyLJcVJDhKtBka00URTUfAIuue8soBM3TQ1UKAJJU2PxT3gIAAABrKGYZsz3DseyhfKqmlDrtIq6o8h4P65K6I2+ekijax13u4LL2aEUBwCHXmbL/gFrXrjXWB0AURbvvO57nKbsHnMloNFaZOHHiN61btz4EAJCZmQnLly/fXFBQYNOTce/evRecO3euJgDAk08+mfXnn3++fePGDV81Yy7L0KFDB+3atSuaEAIGgwH69ev3Cvvb119//UdkZOROs9kMHMfBsWPH3v3f//7n1A6B1uc5IyPDvG7dusn9+/f/mKV/OTk5sGrVqu8GDBjwiS3btE5X1MTyBPYdZFku90XLOv1RSqFRo0a51apVU7NjtDJPI66Q16iS+CsSvnJfFNYZM5tXwNGUw7cAAPz9/e+psR9HK++hta5ZkVhpTUXKc1kZWCdQzkobWYJSnntFWY3qhDJhEbavESNGdH/88ccLAADOnj3r0759+zLbdV955ZXn165dOwQAICAgADp27NjDsk3NqvFycnL4AwcOzGHpVqdOnTaMHj36gXH2r7322ov+/oWtQlevXiW7du2a48wYLTUwyrHyXgAAK1asmBAfH/+mp6cn+z0sX748qVOnTj87M76yODIdCQ4O3jlx4sQYSil34sSJKnPmzFFtxJkVOTg4WPV5Esqiah8AjuPE8nx+yZIl1bKzs4s6MhFCwNvbW/WM6u7du/zSpUu/8vT0/M7Ly2ux9cvb2/s7Ly+vxRzH/dC7d+8+asdTGlmWy3Xubt269RhAYQ9sAICCggLVjyvLmGRXKPI+wljBw8PDw+5mHpPJVJ9tA+B+LZ7a2CRVw4cPvxweHt6jatWqwHEc7Nq1q0nnzp2/LOlz06ZNC16/fv169p07dOgwefr06dsBtC1oDho06IuUlBQ/nuchNDQUOnXqNNL6PUOHDs3q0qXLTFmWQRAE+P3337skJia2d1aM1behsknm559/ntGpU6dhQUFBYDabQa/Xw59//hkfGxv7l7Pic6aPP/74xsSJE/c6q5YOoPAey8nJ4ZOTk7/W6/XfGQyGxcW99Hr9Ep1O90P79u1V66itSkmZJSI3b96MGDx48Nv2dP7Kycnx/uKLL3qfPn3ajz1FGQwG03/+85/0FStWqBEuABQWWu7evUvu3r3bS/l762c31kwgy/IlAFitWkBlyM7O1r/55pv9KaUyWLWts+pny98AAGRKqf7GjRv1duzY8TrHcWA2m8HLywtyc3OvqB0ra1c+f/58zy5dugSXcj0QX1/f/M6dO08eOXKkVqVjhycEzsqQOI6DnJwc7vr16z3/85//XKaUcmAp5CuuCfZ2mVIqE0L0mZmZ1ffs2TOBvU8URWjTpk3ajh07VI9ZeX9t2rRpU//+/ZNWrlz5KSEE9u3b9+bo0aO3fvXVV79Yf27t2rVrr1+/zgMAPPnkk9tWr16dyP5W0syYavv2229rjx079t9s2GtUVNQnY8aMuVbce/v16zfh2LFjo44fP64HAFi/fv1yAAh2Rpxl1Uj98ssvi//73/+mr1q1amNqaqqPTqeD3bt3x0VGRh778MMPO8THxz80w2WJY3tVYs8QXVdkNBohIyOjJ7tWikMIAVEUIT8/PwcAfnRuhOXAhgHqdLqiYSXlfQmCUDQ0o2nTpqoNo2ITASn3p3yR+9PYFr0AgPbo0WOqWjGVhE0ExKaoZRNKsBchpOhv7Bwoh2UC3J+UxzIBi2nhwoXV1YpXOQzQ1uvhsccekxMSEpySEAIAtGzZ8igohgFNnz49pqLb7Nmzp1edOnWKvlPz5s1VK2RZhgFeAMVQLlAcc57nS3xZXxdsCKDBYKAffPBBM7VifvnllxPYfhs0aPDQNKYtW7b8g/29Ro0a+W+88UZ95d8HDBjwLljuzQYNGtzdv3+/j/Lv4eHht9jnnTkMMC4urijuiIiIzJSUFH1p72dDF3U6HQUA2rVrV5va2ytKOQwQAGjfvn2XFPe+SZMmRYSGht4ExbXVuHHjK7NmzXqoz8K4ceOeVQ4D7Natm2rDAEeOHBnp5+dXFFOLFi3KPQzQmaKiojLBKj0sbeIiliZFR0fPUysmVWoAZFmu8FOPKBa2HtSvX1/q2bNnn6NHjzoitBJxHAceHh7QoEGDqZTSG2B5ciKEFNWXUUqJJEkcx3FcYGDgLlUDKgWr9iyuRl0UxaLJaFhPWeX7lD8/++yzHwwfPvyGU4K2EaWUmEwmLYv2Dt+3s55UJEkqOt/s/rGOgzX9sGlpGUutFnAcB506dZrx8ccfH3NK0MXUuOzdu7dL06ZNs48dO+Zz7do1j717924AgIYAAJMnT24we/bsSQCFhZ8BAwZ0jYqKyrXahNOvn8TExDafffZZJzZ5WVRU1HuNGzcutSlmzZo1//fYY4+9cfHixZqCIMChQ4feW7hw4VfDhw9XvVbOSrHHKzEx8XR8fHxEYGDg3sOHD9fX6XSQkpJSc+bMmUeTkpLafvrpp0UZr1zIeRG7MVmWwdfXF+rVqzeFEHITSmiKF0WRFwQBwsLCDuzdu1eVWFTrLCPLMjRu3Phq48aNV9raBGCpRqKUUuB5nvr7+2//+uuvN3AcV6BWnIzJZIKaNWuaO3To8MXnn39e5oIohw4dUjukEkmSBDzP0969e39LKTXD/RuYAgC/adOmUUajEXieB7PZDLGxsSmhoaEbJUkyAABwHHcpPj5+9eDBg9OcEa+lEye0bt16e2ho6A52PVgSDOVMdZy3t3deXFxc1qJFi5wR2iOFFC6kBe3bt19SpUqVu9ZV4fv37x+SkZFRhc3AFxMTc+uxxx6bL8tyVVmWzRzHZcTGxv42duzYCi8OUxGEEHnKlClPzpgxI+3KlSvkn3/+iXjuueeW/fHHH/9avnx58qVLlzgAgF69ek356KOPtmsZK7N+/fpFrCr36aefvp6YmLg+ISHB3zL7W9GMjOzBSBRFHgDu9unTZ9IXX3wxk1IKV65cEVasWDEbAHoVvxfn++WXX24DQPizzz775+bNm5/leR5SU1O958+ff2DMmDG9Z82atRYAwGw2i2wmSXfy5Zdf+hsMhhqjRo066ax9yrIMXl5ecsOGDacvW7as2CYipQMHDjgjrIqzngmwTZs2G7WOqSysCQAAaGhoqPmVV16pq3VMJWFNAFBYxVjiFJAjR47s4OXlVdRkUa9evbt9+/aNcF6khVgTAKvKGjBgQIXmrVaDdRPAjBkzWlV0m7169fKqW7du0bmKjIx0ShMAx3G0du3a4sSJE2sV995PPvmk6eOPP57L3hsSEmJ++eWXnT4bnVUTQImrZo4cOXKQwWAoqi6Njo4+wz7XpEmTEmvgwsPDb7P3OaMJoFOnTu+DVTOip6cn9fb2pj4+Pg+8vLy8HviZVQezz/r5+dHXXnutwrNRlqaYJoCltnyubdu2y0BRba3T6eiQIUNeBQD497//3bhatWpFaY7KTQAt/Pz8ivKZijQBjBw5shdA4Syw7dq1OzZs2LAhjov0QawJAABorVq1pPj4+Dpq7ctWqo73IYS4x6w6AMqqUbcowpY2EdC33347Zfjw4V1q1aplBgBIS0vz2bp166khQ4b0dV6E97GnAkmSSm0TdREVrj5m1emMs56K2NLQd+7cKXY2s/Hjxx995ZVXYh5//PF7sizDlStXhLVr1/7Ss2fPt5wSoJ2+/fbbH1q1ajVPFEUQBAH27t0bDgDQoEGDW6NHj+6hdXwAADNnzgw+e/bsePZ/VguQn58PeXl5kJub+8DLaDQ+8DObFZB9Ljs7G3bt2vWNNt+mdNu3b/9Xt27dPvb19QWO40CSJFi6dOnXgwcPHuPj45Pp7e3tlM55bL5/R+xHp9PJAACXL1/mt23b1uTevXt2T4NsL8Wkc5rnNc4b8Ovi3K3qqiyzZ8/+fcCAAZ0CAgJAp9NBZmYmrF+/fuXAgQP/q3VsLkY5ja5D6HS6ogIlgHa90ouTmJh4/PXXX38qPDw8j1IK2dnZsH79+i969+79hdaxFWfz5s2jYmNjD7BCQGBgILzwwgsvjR492iX6rmzZsuWj9PR0b57nQRRFaNWqVXp0dPT5mJiYDOUrOjr6PHtZ/y0mJiYjIiIiS5IkEAQBjhw5EvHcc899pPV3K86GDRsmxMfHvxIQEMBms4Pvv/9+pre39yY/Pz8AUD8tFQRBdtRslWz0ApsBlhDirJlSXSLDcZsndLVZ5i6g5Z27wBnsvbGmTZu2rXXr1k8dP378cHZ2Npvd69MXXnihxq+//qrZeuSuxMPDowDg/pObXq+vcH+TVatWFdSte78lSRAEcylvd7qxY8eemTlzZrPZs2cfP3PmjCelFNasWfPWs88+G7958+buTg6nrFXb6Lffftv56tWrlzMyMjwaNmw4c/r06S7RtPjll1/W//TTTxPY03CvXr3mr127dqT1U3Bp9y1735YtW6p27do1y2w2AyEETpw4Mf6HH374ctCgQVmOjruiGeeSJUsWjB07Nm3BggVbsrOzgRAC48ePr+Pl5VU0B4yawwK9vb0lZedmZUdtexFCRIAHVoV1VvpPjEajcybbKIWqBQBnzihWUZIkQV5enuDn59f4+++/N5jNZpvnb7fc8JRSSiilHM/zt4YNG3ZdzXhtnbji77//PpKUlPTk4sWLj126dAkAAH799dcxzzzzTN2dO3c6JbG3HongSgIDA88DQAudTgcmkwlOnTo1dNKkSbUlSRIs4+htUXTuBUEQ7969W3X27NlF37tatWqqXgvl8e9///vc3LlzG8+cOXPvyZMnq+l0Oti8eXO3Vq1a7UtMTGzdvXt3pxRabGlyGzly5K3ExMTIq1evjli0aNHbzojLFqtXr/4hMzMTBEGA2rVrw5gxY95eu3btQxmsLRluhw4d7vTt23fCqlWrPtLr9XDp0iWyYsWKuQAwwNFxFzNKy+6b84svvvhr7ty5DaZOnXro3Llz3gAA9+7dU05H7ahwHzJo0KBLS5bcH7loMpkCpkyZ0sZsNovFzNtS7MG3TJhVcOTIkSjl73U63W01YrbEUrRvo9EITz75ZJOBAwd6sbyG9Z8oq8aQEEJlWeYszQiZQ4cOfWheBk2wToCsI0xcXFy5lgN2JtYJkI2NBjvmKijpFRUVtUiNWJs0aVK0j/Dw8Lv2fDYxMTGqRo0aBWweAACgbdu23bNz505VVlkEeHg54L59+76p1r7Kq02bNiPA0qFJr9c75PyD1Vjffv36TVcrfmUnQEIIDQkJkd988836ZX7QYtGiRWENGza8ApaOgQBAmzVrdvqzzz5TbVlsZSfAiIiIEjsBlpfVPACqjBHv37//QFCM4e/Ro0eFF/WhlPJNmza9Aop7ZuLEiU9VdLvW3nzzTd8GDRrchfudABeXd1vz5s0LjIyMTAO4v8wxIYT26NFD1aW/69evfwMU12xFXmzuFF9fXzp+/PjmasXcokWLTLDkNaWN/7fnFR8fv7IiMTn0EV2WZaLs0EIpdfkmBrZSmyRJjpz+VJXir7LULkmSXcd20qRJ+5544omnq1evnse+5/bt26PfeOONo0lJSaGOjbQQpZQHAOXTgMtVCe3YsWNBREREhtlsfmBcfEWxzl1PPPHE3bi4uP9z2IYfRth9Znny4uypfR02bNiFiRMnRjZu3PgGq6U5cuRIg5kzZ6Z/+OGHLdQIWPmEI4qiw9MI5eqLaixBTSkVDhw4sAAAwGw2Q1hY2N1hw4ZNqeh2CSHS008//R7A/Xtm2bJl6yq63WL288BU4rIsl3u1yoSEhFvfffdd42eeeWaPKIpgMpmAUgpGo1HVfi8tW7Z8rUqVKg6pWRRFESil0LRp098++eQT1cZ3s4WHJElyZD+JCm3IoTdH9erV85555pkLAHCPUqoPDg52+QGMjz322DFfX9/ahBAJCtsjKYD97WSsGUCWZY+AgIDLKoQKderUOejv7+8NhVPm3k1Ls28Y/19//XV07NixrQ8dOrRYkiQ9pZSTJMnjxIkTS9atW9fvxRdfdGhVUtWqVc+3atUqg+f5AkmSvIKCglyjqsrK6NGjG+/evXvUrVu3uoqiWE2WZd6SKBZdDzaiAIXV2nq9/pa3t/fmZs2afaNmhzVCCO3evXuKt7d3HiFE9vT0NFerVs2uksyAAQOuLV26NHLRokU/mUwmX4DCtSb27dv33cKFC7sNHz78giNjDggIuN26desLAFDg7++fde7cOUduHho2bHiqZs2aAQBAatSoccqhGweAd999d1D16tVv1qxZ0yjLsiEsLOyDHj16WE9GVC7z589fdv369SF37typQwgRKaXePXr06PfZZ59V6ElPKSQkRIqIiDgeHBzsDwB8QEBAekW216xZs3uU0rY9evSYf+vWrdYAoAsNDVV1SeZly5atefXVV9ulp6cPliQp0mw2eyoeOG25ZwkUPv3nE0IyateuvWnJkiWqjr4ICwvbYjAYmljyGpbHsFjtTWuAUqr39fV17M2DKh9KKTl48KDL9FRHroFSSnbu3InXhRVnjxhypVEkCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQu7g/wE9AijBh2XMqwAAAABJRU5ErkJggg==" class="header-logo" alt="Push Performance">
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
        <div class="assessment-question">Current Injuries</div>
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
            <td>${cmj.jumpHeight?.toFixed(2) || 'N/A'} cm</td>
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
            <td>RSI-mod</td>
            <td>${cmj.rsiMod?.toFixed(2) || 'N/A'}</td>
            <td>${cmjComp.metrics?.rsiMod?.percentile?.toFixed(1) || 'N/A'}%</td>
          </tr>
          <tr>
            <td>Countermovement Depth</td>
            <td>${cmj.countermovementDepth?.toFixed(2) || 'N/A'} cm</td>
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
            <td>${sj.jumpHeight?.toFixed(2) || 'N/A'} cm</td>
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
            <td>${slCmjLeft?.jumpHeight ? `${slCmjLeft.jumpHeight.toFixed(2)} cm` : 'N/A'}</td>
            <td>${slCmjRight?.jumpHeight ? `${slCmjRight.jumpHeight.toFixed(2)} cm` : 'N/A'}</td>
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
            <td>RSI-mod</td>
            <td>${slCmjLeft?.rsiMod ? slCmjLeft.rsiMod.toFixed(3) : 'N/A'}</td>
            <td>${slCmjRight?.rsiMod ? slCmjRight.rsiMod.toFixed(3) : 'N/A'}</td>
            <td style="color: ${(() => {
              if (!slCmjLeft?.rsiMod || !slCmjRight?.rsiMod) return '#ccc';
              const diff = Math.abs(slCmjLeft.rsiMod - slCmjRight.rsiMod);
              const avg = (slCmjLeft.rsiMod + slCmjRight.rsiMod) / 2;
              const asym = (diff / avg) * 100;
              return asym <= 5 ? '#27AE60' : asym <= 10 ? '#F39C12' : '#E74C3C';
            })()}; font-weight: 600;">
              ${(() => {
                if (!slCmjLeft?.rsiMod || !slCmjRight?.rsiMod) return 'N/A';
                const diff = Math.abs(slCmjLeft.rsiMod - slCmjRight.rsiMod);
                const avg = (slCmjLeft.rsiMod + slCmjRight.rsiMod) / 2;
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
            <td>${ppu.pushupHeight?.toFixed(2) || 'N/A'} cm</td>
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
  <div class="page-break"></div>
  <div class="test-section">
    <h2 class="test-title">Hop Test</h2>

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
    const reportData = ${JSON.stringify({ cmj, cmjComp, sj, sjComp, imtp, imtpComp, ppu, ppuComp, hopTest, hopComp })};

    // CMJ Spider Chart
    if (reportData.cmj && reportData.cmjComp?.metrics) {
      const keyMetrics = [
        { key: 'jumpHeight', label: 'Jump Height' },
        { key: 'rsiMod', label: 'RSI-mod' },
        { key: 'peakPowerBM', label: 'Peak Power / BM' },
        { key: 'eccentricBrakingRFD', label: 'Ecc Braking RFD' },
        { key: 'concentricPeakVelocity', label: 'Con Peak Velocity' },
        { key: 'eccentricPeakPowerBM', label: 'Ecc Peak Power / BM' }
      ];

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
