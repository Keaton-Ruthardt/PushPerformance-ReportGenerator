import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import mlbNormsService from './mlbNormsService.js';
import valdApiService from './valdApiServiceInstance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Report Generator Service
 * Creates PDF reports matching Push Performance template
 */
class ReportGeneratorService {
  constructor() {
    this.colors = {
      primary: '#2C3E50',      // Dark blue
      secondary: '#E74C3C',    // Red
      success: '#27AE60',      // Green
      warning: '#F39C12',      // Orange
      danger: '#E74C3C',       // Red
      gray: '#7F8C8D',
      lightGray: '#ECF0F1',
      white: '#FFFFFF',
      black: '#000000'
    };

    this.asymmetryColors = {
      good: '#27AE60',    // Green (<5%)
      moderate: '#F39C12', // Yellow/Orange (5-10%)
      poor: '#E74C3C'     // Red (>10%)
    };
  }

  /**
   * Generate complete performance report
   */
  async generateReport(athleteData, outputPath) {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Performance Report - ${athleteData.name}`,
          Author: 'Push Performance',
          Subject: 'Athletic Performance Assessment',
          Keywords: 'performance, assessment, baseball'
        }
      });

      // Pipe to file
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Add content sections
      await this.addHeaderSection(doc, athleteData);
      await this.addAthleteInfoSection(doc, athleteData);
      await this.addJumpTestSection(doc, athleteData);
      await this.addSingleLegCMJSection(doc, athleteData);
      await this.addIMTPSection(doc, athleteData);
      await this.addPPUSection(doc, athleteData);
      await this.addAsymmetrySection(doc, athleteData);
      await this.addNormsComparisonSection(doc, athleteData);
      await this.addRecommendationsSection(doc, athleteData);
      this.addFooter(doc);

      // Finalize PDF
      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => {
          resolve(outputPath);
        });
        stream.on('error', reject);
      });

    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  /**
   * Add header section with logo and title
   */
  async addHeaderSection(doc, athleteData) {
    // Header background
    doc.rect(0, 0, doc.page.width, 120)
       .fill(this.colors.primary);

    // Title
    doc.fillColor(this.colors.white)
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('PERFORMANCE ASSESSMENT REPORT', 50, 40, {
         align: 'center'
       });

    // Subtitle
    doc.fontSize(14)
       .font('Helvetica')
       .text(`${athleteData.name}`, 50, 75, {
         align: 'center'
       });

    // Date
    doc.fontSize(10)
       .text(`Report Date: ${new Date().toLocaleDateString()}`, 50, 95, {
         align: 'center'
       });

    // Reset position
    doc.fillColor(this.colors.black);
    doc.y = 140;
  }

  /**
   * Add athlete information section
   */
  async addAthleteInfoSection(doc, athleteData) {
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('ATHLETE INFORMATION', 50, doc.y);

    doc.moveDown(0.5);

    const infoItems = [
      { label: 'Name:', value: athleteData.name },
      { label: 'Date of Birth:', value: athleteData.dateOfBirth || 'N/A' },
      { label: 'Height:', value: athleteData.height || 'N/A' },
      { label: 'Weight:', value: athleteData.weight || 'N/A' },
      { label: 'Position:', value: athleteData.position || 'N/A' },
      { label: 'Team/Organization:', value: athleteData.team || 'N/A' }
    ];

    doc.fontSize(11)
       .font('Helvetica');

    infoItems.forEach(item => {
      doc.font('Helvetica-Bold')
         .text(item.label, 50, doc.y, { continued: true })
         .font('Helvetica')
         .text(` ${item.value}`);
    });

    doc.moveDown();
  }

  /**
   * Add jump test results section (CMJ, HOP RSI)
   */
  async addJumpTestSection(doc, athleteData) {
    // Check if we need a new page
    if (doc.y > 600) {
      doc.addPage();
    }

    // Add explanatory text matching template
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Force Plate Test Reasoning', 50, doc.y);

    doc.moveDown(0.3);

    doc.fontSize(10)
       .font('Helvetica')
       .text('Performing multiple VALD force plate tests during an assessment provides a comprehensive understanding of an athlete\'s performance, asymmetries, injury risk, and readiness to train or return to play. These tests capture detailed metrics such as force production, rate of force development, and neuromuscular control, which are critical in a highly asymmetrical and explosive sport like baseball.', 50, doc.y, {
         width: 500,
         align: 'justify'
       });

    doc.moveDown(1);

    // CMJ Results with all 13 metrics
    if (athleteData.tests?.cmj) {
      const cmj = athleteData.tests.cmj;
      const cmjComp = athleteData.cmjComparison;

      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Countermovement Jump (CMJ)', 50, doc.y);

      doc.moveDown(0.5);

      // Define all 13 CMJ metrics matching template
      const cmjMetricDefs = [
        { key: 'jumpHeight', name: 'Jump Height', unit: 'in' },
        { key: 'eccentricBrakingRFD', name: 'Eccentric Braking RFD', unit: 'N/s' },
        { key: 'forceAtZeroVelocity', name: 'Force @ Zero Velocity', unit: 'N' },
        { key: 'eccentricPeakForce', name: 'Eccentric Peak Force', unit: 'N' },
        { key: 'concentricImpulse', name: 'Concentric Impulse', unit: 'Ns' },
        { key: 'eccentricPeakVelocity', name: 'Eccentric Peak Velocity', unit: 'm/s' },
        { key: 'concentricPeakVelocity', name: 'Concentric Peak Velocity', unit: 'm/s' },
        { key: 'eccentricPeakPower', name: 'Eccentric Peak Power', unit: 'W' },
        { key: 'eccentricPeakPowerBM', name: 'Eccentric Peak Power / BM', unit: 'W/kg' },
        { key: 'peakPower', name: 'Peak Power', unit: 'W' },
        { key: 'peakPowerBM', name: 'Peak Power / BM', unit: 'W/kg' },
        { key: 'rsiMod', name: 'RSI-mod', unit: 'm/s' },
        { key: 'countermovementDepth', name: 'Countermovement Depth', unit: 'in' }
      ];

      // Draw CMJ metrics table
      this.drawCMJMetricsTable(doc, cmj, cmjComp, cmjMetricDefs);

      // Add comparative info if available
      if (cmjComp) {
        doc.moveDown(0.5);
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(this.colors.gray)
           .text(`Compared against ${cmjComp.totalProTests} professional baseball player CMJ tests`, 50, doc.y);
        doc.fillColor(this.colors.black);

        // Add spider chart comparing athlete to MLB averages
        doc.moveDown(1);
        this.drawCMJSpiderChart(doc, cmj, cmjComp, cmjMetricDefs);
      }
    }

    // Hop Test Results with comparative analysis
    if (athleteData.tests?.hopTest) {
      doc.moveDown(1);
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Hop Test (HT)', 50, doc.y);

      doc.moveDown(0.5);

      const hopData = athleteData.tests.hopTest;
      const hopComp = athleteData.hopComparison;

      const metrics = [
        {
          name: 'RSI (Best 5 Avg)',
          value: hopData.rsi,
          unit: 'm/s',
          percentile: hopComp?.metrics?.rsi?.percentile ? Math.round(hopComp.metrics.rsi.percentile) : null
        },
        {
          name: 'Jump Height (Best 5 Avg)',
          value: hopData.jumpHeight,
          unit: 'in',
          percentile: hopComp?.metrics?.jumpHeight?.percentile ? Math.round(hopComp.metrics.jumpHeight.percentile) : null
        },
        {
          name: 'Ground Contact Time (Best 5 Avg)',
          value: hopData.groundContactTime,
          unit: 'ms',
          percentile: hopComp?.metrics?.gct?.percentile ? Math.round(hopComp.metrics.gct.percentile) : null
        }
      ];

      this.drawMetricsTable(doc, metrics);

      // Add comparative info if available
      if (hopComp) {
        doc.moveDown(0.5);
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(this.colors.gray)
           .text(`Compared against ${hopComp.totalProTests} professional baseball player Hop Test results`, 50, doc.y);
        doc.fillColor(this.colors.black);
      }
    }

    doc.moveDown();
  }

  /**
   * Add Single Leg CMJ section
   */
  async addSingleLegCMJSection(doc, athleteData) {
    console.log('📝 addSingleLegCMJSection called');
    console.log('📝 Has Left data:', !!athleteData.tests?.singleLegCMJ_Left);
    console.log('📝 Has Right data:', !!athleteData.tests?.singleLegCMJ_Right);
    console.log('📝 Has recommendations:', !!athleteData.slCmjRecommendations);
    console.log('📝 Recommendations content:', athleteData.slCmjRecommendations);

    if (!athleteData.tests?.singleLegCMJ_Left || !athleteData.tests?.singleLegCMJ_Right) return;

    // Check if we need a new page
    if (doc.y > 500) {
      doc.addPage();
    }

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('SINGLE LEG COUNTERMOVEMENT JUMP (SL CMJ)', 50, doc.y);

    doc.moveDown(0.5);

    // Draw asymmetry table
    const leftData = athleteData.tests.singleLegCMJ_Left;
    const rightData = athleteData.tests.singleLegCMJ_Right;

    const startY = doc.y;
    const rowHeight = 20;

    // Headers
    doc.fontSize(10)
       .font('Helvetica-Bold');
    doc.text('Metric', 50, startY);
    doc.text('Left', 250, startY);
    doc.text('Right', 350, startY);
    doc.text('Asymmetry', 450, startY);

    doc.moveDown(0.5);

    // Draw line under headers
    doc.moveTo(50, doc.y)
       .lineTo(550, doc.y)
       .stroke();

    doc.y += 5;

    // Metrics to display
    const metrics = [
      { name: 'Jump Height', leftVal: leftData.jumpHeight, rightVal: rightData.jumpHeight, unit: 'in' },
      { name: 'Ecc Peak Force', leftVal: leftData.eccentricPeakForce, rightVal: rightData.eccentricPeakForce, unit: 'N' },
      { name: 'Ecc Braking RFD', leftVal: leftData.eccentricBrakingRFD, rightVal: rightData.eccentricBrakingRFD, unit: 'N/s' },
      { name: 'Ecc Peak Velocity', leftVal: leftData.eccentricPeakVelocity, rightVal: rightData.eccentricPeakVelocity, unit: 'm/s' },
      { name: 'Con Peak Force', leftVal: leftData.concentricPeakForce, rightVal: rightData.concentricPeakForce, unit: 'N' },
      { name: 'Con Peak Velocity', leftVal: leftData.concentricPeakVelocity, rightVal: rightData.concentricPeakVelocity, unit: 'm/s' },
      { name: 'Peak Power', leftVal: leftData.peakPower, rightVal: rightData.peakPower, unit: 'W' },
      { name: 'Peak Power / BM', leftVal: leftData.peakPowerBM, rightVal: rightData.peakPowerBM, unit: 'W/kg' },
      { name: 'RSI-mod', leftVal: leftData.rsiMod, rightVal: rightData.rsiMod, unit: 'm/s' }
    ];

    doc.font('Helvetica');
    metrics.forEach((metric) => {
      if (metric.leftVal != null && metric.rightVal != null) {
        const asymmetry = Math.abs(((metric.leftVal - metric.rightVal) / Math.max(metric.leftVal, metric.rightVal)) * 100);
        const dominantSide = metric.leftVal > metric.rightVal ? 'L' : 'R';
        const asymmetryColor = this.getAsymmetryColor(asymmetry);

        doc.text(metric.name, 50, doc.y);
        doc.text(metric.leftVal.toFixed(2), 250, doc.y);
        doc.text(metric.rightVal.toFixed(2), 350, doc.y);

        doc.fillColor(asymmetryColor)
           .text(`${asymmetry.toFixed(1)}% ${dominantSide}`, 450, doc.y);
        doc.fillColor(this.colors.black);

        doc.moveDown(0.5);
      }
    });

    // Add recommendations box if available
    if (athleteData.slCmjRecommendations) {
      doc.moveDown(0.5);

      // Draw recommendations box
      const boxY = doc.y;
      const boxHeight = 80;

      // Background
      doc.rect(50, boxY, 500, boxHeight)
         .fill(this.colors.lightGray);

      // Title
      doc.fillColor(this.colors.black)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('Key Takeaways:', 60, boxY + 10);

      // Recommendations text
      doc.fontSize(9)
         .font('Helvetica')
         .text(athleteData.slCmjRecommendations, 60, boxY + 30, {
           width: 480,
           align: 'left'
         });

      doc.y = boxY + boxHeight + 10;
    }

    doc.moveDown();
  }

  /**
   * Add IMTP section
   */
  async addIMTPSection(doc, athleteData) {
    if (!athleteData.tests?.imtp) return;

    // Check if we need a new page
    if (doc.y > 600) {
      doc.addPage();
    }

    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('ISOMETRIC MID-THIGH PULL (IMTP)', 50, doc.y);

    doc.moveDown(0.5);

    const imtp = athleteData.tests.imtp;
    const metrics = [
      { name: 'Peak Force', value: imtp.peakForce, unit: 'N', percentile: null },
      { name: 'Force @ 100ms', value: imtp.force100ms, unit: 'N', percentile: null },
      { name: 'Force @ 200ms', value: imtp.force200ms, unit: 'N', percentile: null }
    ];

    this.drawMetricsTable(doc, metrics);
    doc.moveDown();
  }

  /**
   * Add PPU section
   */
  async addPPUSection(doc, athleteData) {
    if (!athleteData.tests?.ppu) return;

    // Check if we need a new page
    if (doc.y > 600) {
      doc.addPage();
    }

    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('PLYOMETRIC PUSH-UP (PPU)', 50, doc.y);

    doc.moveDown(0.5);

    const ppu = athleteData.tests.ppu;
    const metrics = [
      { name: 'Push-Up Height', value: ppu.height, unit: 'cm', percentile: null },
      { name: 'Relative Peak Force', value: ppu.relativePeakForce, unit: 'N/kg', percentile: null },
      { name: 'Push-Up Depth', value: ppu.depth, unit: 'cm', percentile: null }
    ];

    this.drawMetricsTable(doc, metrics);
    doc.moveDown();
  }

  /**
   * Add asymmetry analysis section
   */
  async addAsymmetrySection(doc, athleteData) {
    if (!athleteData.asymmetries || Object.keys(athleteData.asymmetries).length === 0) return;

    // Check if we need a new page
    if (doc.y > 600) {
      doc.addPage();
    }

    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('ASYMMETRY ANALYSIS', 50, doc.y);

    doc.moveDown(0.5);

    doc.fontSize(10)
       .font('Helvetica')
       .text('Asymmetry values indicate the percentage difference between left and right sides.', 50, doc.y);

    doc.moveDown(0.5);

    // Draw asymmetry table
    const startY = doc.y;
    const rowHeight = 25;

    // Headers
    doc.fontSize(10)
       .font('Helvetica-Bold');
    doc.text('Test', 50, startY);
    doc.text('Left', 200, startY);
    doc.text('Right', 280, startY);
    doc.text('Asymmetry %', 360, startY);
    doc.text('Status', 460, startY);

    doc.moveDown(0.3);

    // Draw line under headers
    doc.moveTo(50, doc.y)
       .lineTo(550, doc.y)
       .stroke();

    doc.y += 5;

    // Asymmetry data
    doc.font('Helvetica');
    Object.entries(athleteData.asymmetries).forEach(([test, data]) => {
      doc.text(test, 50, doc.y);
      doc.text(data.left?.toFixed(1) || 'N/A', 200, doc.y);
      doc.text(data.right?.toFixed(1) || 'N/A', 280, doc.y);

      // Color code the asymmetry percentage
      const asymColor = this.getAsymmetryColor(data.percentage);
      doc.fillColor(asymColor)
         .text(`${data.percentage}% ${data.direction}`, 360, doc.y);

      // Status
      const status = this.getAsymmetryStatus(data.percentage);
      doc.text(status, 460, doc.y);

      doc.fillColor(this.colors.black);
      doc.moveDown(0.5);
    });

    doc.moveDown();
  }

  /**
   * Add MLB norms comparison section
   */
  async addNormsComparisonSection(doc, athleteData) {
    // Check if we need a new page
    if (doc.y > 500) {
      doc.addPage();
    }

    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('PROFESSIONAL BASEBALL COMPARISON', 50, doc.y);

    doc.moveDown(0.5);

    doc.fontSize(10)
       .font('Helvetica')
       .text('Percentile rankings compared to MLB/MiLB professional baseball players', 50, doc.y);

    doc.moveDown(0.5);

    // This would integrate with the MLB norms service
    if (athleteData.comparisons) {
      this.drawPercentileChart(doc, athleteData.comparisons);
    }

    doc.moveDown();
  }

  /**
   * Add recommendations section
   */
  async addRecommendationsSection(doc, athleteData) {
    // Check if we need a new page
    if (doc.y > 500) {
      doc.addPage();
    }

    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('RECOMMENDATIONS', 50, doc.y);

    doc.moveDown(0.5);

    // Use custom recommendations if provided, otherwise generate them
    let recommendations;
    if (athleteData.customRecommendations && Array.isArray(athleteData.customRecommendations)) {
      recommendations = athleteData.customRecommendations;
    } else {
      recommendations = this.generateRecommendations(athleteData);
    }

    doc.fontSize(11)
       .font('Helvetica');

    recommendations.forEach((rec, index) => {
      doc.font('Helvetica-Bold')
         .text(`${index + 1}. `, 50, doc.y, { continued: true })
         .font('Helvetica')
         .text(rec);
      doc.moveDown(0.3);
    });
  }

  /**
   * Add footer to current page
   */
  addFooter(doc) {
    // Add footer to current page only
    const currentY = doc.y;

    // Footer line
    doc.moveTo(50, doc.page.height - 50)
       .lineTo(doc.page.width - 50, doc.page.height - 50)
       .stroke(this.colors.lightGray);

    // Footer text
    doc.fontSize(8)
       .fillColor(this.colors.gray)
       .text(
         'Push Performance | Performance Assessment Report',
         50,
         doc.page.height - 40,
         { align: 'center', width: doc.page.width - 100 }
       );

    // Restore position
    doc.y = currentY;
    doc.fillColor(this.colors.black);
  }

  /**
   * Draw metrics table
   */
  drawMetricsTable(doc, metrics) {
    const startX = 50;
    const startY = doc.y;
    const colWidths = [200, 100, 80, 100];

    metrics.forEach((metric, index) => {
      const y = startY + (index * 20);

      doc.fontSize(10)
         .font('Helvetica')
         .text(metric.name, startX, y);

      doc.font('Helvetica-Bold')
         .text(
           metric.value !== null && metric.value !== undefined
             ? `${metric.value.toFixed(1)}`
             : 'N/A',
           startX + colWidths[0],
           y
         );

      doc.font('Helvetica')
         .text(metric.unit, startX + colWidths[0] + colWidths[1], y);

      if (metric.percentile) {
        const percentileColor = this.getPercentileColor(metric.percentile);
        doc.fillColor(percentileColor)
           .text(`${metric.percentile}th`, startX + colWidths[0] + colWidths[1] + colWidths[2], y);
        doc.fillColor(this.colors.black);
      }
    });

    doc.y = startY + (metrics.length * 20);
  }

  /**
   * Draw percentile comparison chart
   */
  drawPercentileChart(doc, comparisons) {
    const startY = doc.y;
    const barHeight = 15;
    const maxWidth = 400;

    Object.entries(comparisons).forEach(([test, data], index) => {
      if (data.percentile) {
        const y = startY + (index * 25);

        // Test name
        doc.fontSize(10)
           .font('Helvetica')
           .text(test, 50, y);

        // Background bar
        doc.rect(200, y, maxWidth, barHeight)
           .fill(this.colors.lightGray);

        // Percentile bar
        const barWidth = (data.percentile / 100) * maxWidth;
        const barColor = this.getPercentileColor(data.percentile);
        doc.rect(200, y, barWidth, barHeight)
           .fill(barColor);

        // Percentile text
        doc.fillColor(this.colors.black)
           .fontSize(9)
           .text(`${data.percentile}th`, 200 + barWidth + 5, y + 2);
      }
    });

    doc.y = startY + (Object.keys(comparisons).length * 25);
  }

  /**
   * Get color based on asymmetry percentage
   */
  getAsymmetryColor(percentage) {
    if (percentage < 5) return this.asymmetryColors.good;
    if (percentage < 10) return this.asymmetryColors.moderate;
    return this.asymmetryColors.poor;
  }

  /**
   * Get asymmetry status text
   */
  getAsymmetryStatus(percentage) {
    if (percentage < 5) return 'Good';
    if (percentage < 10) return 'Monitor';
    return 'Address';
  }

  /**
   * Get color based on percentile ranking
   */
  getPercentileColor(percentile) {
    if (percentile >= 75) return this.colors.success;
    if (percentile >= 50) return this.colors.warning;
    return this.colors.danger;
  }

  /**
   * Generate Single Leg CMJ recommendations based on asymmetry data
   */
  generateSingleLegCMJRecommendations(leftData, rightData) {
    const recommendations = [];

    if (!leftData || !rightData) {
      return null;
    }

    // Calculate asymmetries for key metrics
    const metrics = [
      { name: 'Jump Height', left: leftData.jumpHeight, right: rightData.jumpHeight, unit: 'in' },
      { name: 'Eccentric Peak Force', left: leftData.eccentricPeakForce, right: rightData.eccentricPeakForce, unit: 'N' },
      { name: 'Eccentric Braking RFD', left: leftData.eccentricBrakingRFD, right: rightData.eccentricBrakingRFD, unit: 'N/s' },
      { name: 'Concentric Peak Force', left: leftData.concentricPeakForce, right: rightData.concentricPeakForce, unit: 'N' },
      { name: 'Peak Power', left: leftData.peakPower, right: rightData.peakPower, unit: 'W' },
      { name: 'Peak Power / BM', left: leftData.peakPowerBM, right: rightData.peakPowerBM, unit: 'W/kg' },
      { name: 'RSI-mod', left: leftData.rsiMod, right: rightData.rsiMod, unit: 'm/s' }
    ];

    let highestAsymmetry = 0;
    let highestAsymmetryMetric = null;
    let dominantSide = null;

    metrics.forEach(metric => {
      if (metric.left && metric.right) {
        const asymmetryPercent = Math.abs(((metric.left - metric.right) / Math.max(metric.left, metric.right)) * 100);
        if (asymmetryPercent > highestAsymmetry) {
          highestAsymmetry = asymmetryPercent;
          highestAsymmetryMetric = metric.name;
          dominantSide = metric.left > metric.right ? 'Left' : 'Right';
        }
      }
    });

    // Generate recommendations based on asymmetry levels
    if (highestAsymmetry > 15) {
      recommendations.push(`CRITICAL: Significant ${highestAsymmetry.toFixed(1)}% asymmetry detected in ${highestAsymmetryMetric} (${dominantSide} side dominant). Prioritize unilateral training to address this imbalance and reduce injury risk.`);
      recommendations.push(`Focus on strengthening the weaker leg through single-leg exercises: Bulgarian split squats, single-leg RDLs, and step-ups.`);
    } else if (highestAsymmetry > 10) {
      recommendations.push(`MODERATE: ${highestAsymmetry.toFixed(1)}% asymmetry in ${highestAsymmetryMetric} (${dominantSide} side dominant). Incorporate more unilateral exercises to reduce this imbalance.`);
      recommendations.push(`Add single-leg plyometric work and tempo training on the weaker side.`);
    } else if (highestAsymmetry > 5) {
      recommendations.push(`MINOR: ${highestAsymmetry.toFixed(1)}% asymmetry in ${highestAsymmetryMetric}. This is within acceptable range but monitor during training.`);
      recommendations.push(`Continue bilateral and unilateral training with balanced volume.`);
    } else {
      recommendations.push(`EXCELLENT: Asymmetries are all below 5%, indicating good bilateral balance.`);
      recommendations.push(`Maintain current training approach with continued monitoring of single-leg performance.`);
    }

    // Check for overall power output
    const avgPowerBM = ((leftData.peakPowerBM || 0) + (rightData.peakPowerBM || 0)) / 2;
    if (avgPowerBM < 40) {
      recommendations.push(`Focus on developing overall lower body power through Olympic lifts and plyometric training.`);
    }

    return recommendations.join(' ');
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations(athleteData) {
    const recommendations = [];

    // Check asymmetries
    if (athleteData.asymmetries) {
      Object.entries(athleteData.asymmetries).forEach(([test, data]) => {
        if (data.percentage > 10) {
          recommendations.push(
            `Address ${data.direction} side dominance in ${test} (${data.percentage}% asymmetry). Consider unilateral training to reduce imbalance.`
          );
        }
      });
    }

    // Check percentile rankings
    if (athleteData.comparisons) {
      Object.entries(athleteData.comparisons).forEach(([test, data]) => {
        if (data.percentile && data.percentile < 25) {
          recommendations.push(
            `Focus on improving ${test} performance (currently ${data.percentile}th percentile compared to professional athletes).`
          );
        }
      });
    }

    // Default recommendations if none generated
    if (recommendations.length === 0) {
      recommendations.push('Continue current training program with focus on maintaining performance levels.');
      recommendations.push('Monitor asymmetries to ensure they remain below 10%.');
    }

    return recommendations;
  }

  /**
   * Draw CMJ metrics table with all 13 metrics matching template style
   */
  drawCMJMetricsTable(doc, cmj, cmjComp, metricDefs) {
    console.log('🔍 PDF RENDERING - CMJ object keys:', Object.keys(cmj));
    console.log('🔍 PDF RENDERING - cmj.rsiMod:', cmj.rsiMod);
    console.log('🔍 PDF RENDERING - Full CMJ object:', cmj);

    const startY = doc.y;
    const tableWidth = 500;
    const col1Width = 300; // Metric name
    const col2Width = 200; // Athlete Value

    // Draw table header background
    doc.rect(50, startY, tableWidth, 25)
       .fill(this.colors.black);

    // Table headers
    doc.fillColor(this.colors.white)
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('Metric', 55, startY + 7)
       .text('Athlete Value', 360, startY + 7);

    doc.fillColor(this.colors.black);

    let currentY = startY + 30;

    // Draw each metric row
    metricDefs.forEach((metricDef, index) => {
      const value = cmj[metricDef.key];
      const compData = cmjComp?.metrics?.[metricDef.key];

      // Alternate row background for readability
      if (index % 2 === 0) {
        doc.rect(50, currentY - 2, tableWidth, 20)
           .fill('#F9F9F9');
      }

      // Metric name (in blue to match template)
      doc.fillColor('#4472C4')
         .fontSize(10)
         .font('Helvetica')
         .text(metricDef.name, 55, currentY);

      // Athlete value
      doc.fillColor(this.colors.black);
      if (value !== null && value !== undefined) {
        const displayValue = typeof value === 'number' ? value.toFixed(2) : value;
        doc.font('Helvetica-Bold')
           .text(`${displayValue} ${metricDef.unit}`, 360, currentY);
      } else {
        doc.font('Helvetica')
           .fillColor(this.colors.gray)
           .text('N/A', 360, currentY);
        doc.fillColor(this.colors.black);
      }

      currentY += 20;
    });

    // Draw table border
    doc.rect(50, startY, tableWidth, currentY - startY)
       .stroke(this.colors.gray);

    doc.y = currentY + 10;
  }

  /**
   * Draw CMJ Spider/Radar Chart comparing athlete to MLB pro averages
   */
  drawCMJSpiderChart(doc, cmj, cmjComp, metricDefs) {
    // Select key metrics for spider chart (6 metrics for clean visualization)
    const chartMetrics = [
      { key: 'jumpHeight', label: 'Jump\nHeight' },
      { key: 'rsiMod', label: 'RSI-mod' },
      { key: 'peakPowerBM', label: 'Peak Power\n/ BM' },
      { key: 'eccentricBrakingRFD', label: 'Ecc Braking\nRFD' },
      { key: 'concentricPeakVelocity', label: 'Con Peak\nVelocity' },
      { key: 'eccentricPeakPowerBM', label: 'Ecc Peak\nPower / BM' }
    ];

    // Check if we need a new page
    if (doc.y > 500) {
      doc.addPage();
    }

    const centerX = 300;
    const centerY = doc.y + 150;
    const radius = 100;
    const numMetrics = chartMetrics.length;

    // Title
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(this.colors.black)
       .text('CMJ Performance Comparison', centerX - 80, doc.y, { width: 160, align: 'center' });

    doc.moveDown(0.5);

    // Normalize athlete and MLB values to 0-1 scale for each metric
    const normalizedData = chartMetrics.map(metric => {
      const athleteValue = cmj[metric.key];
      const mlbMean = cmjComp.metrics[metric.key]?.proMean;
      const mlbMax = cmjComp.metrics[metric.key]?.proMax;
      const mlbMin = cmjComp.metrics[metric.key]?.proMin;

      // Normalize to 0-1 scale using min-max normalization
      const range = mlbMax - mlbMin;
      const athleteNorm = range > 0 ? (athleteValue - mlbMin) / range : 0.5;
      const mlbNorm = range > 0 ? (mlbMean - mlbMin) / range : 0.5;

      console.log(`🕷️ Spider Chart - ${metric.key}:`, {
        athleteValue,
        mlbMean,
        mlbMin,
        mlbMax,
        athleteNorm,
        mlbNorm,
        athleteClamped: Math.max(0, Math.min(1, athleteNorm)),
        mlbClamped: Math.max(0, Math.min(1, mlbNorm))
      });

      return {
        label: metric.label,
        athleteValue: Math.max(0, Math.min(1, athleteNorm)), // Clamp to 0-1
        mlbValue: Math.max(0, Math.min(1, mlbNorm))
      };
    });

    // Draw concentric circles (grid)
    const gridLevels = [0.25, 0.5, 0.75, 1.0];
    gridLevels.forEach(level => {
      doc.circle(centerX, centerY, radius * level)
         .stroke('#E0E0E0');
    });

    // Draw axes
    for (let i = 0; i < numMetrics; i++) {
      const angle = (Math.PI * 2 * i) / numMetrics - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      doc.moveTo(centerX, centerY)
         .lineTo(x, y)
         .stroke('#E0E0E0');
    }

    // Draw MLB average polygon (orange)
    console.log('🕷️ Drawing MLB polygon - center:', centerX, centerY, 'radius:', radius);
    const mlbPoints = [];
    for (let i = 0; i < numMetrics; i++) {
      const angle = (Math.PI * 2 * i) / numMetrics - Math.PI / 2;
      const value = normalizedData[i].mlbValue;
      const x = centerX + Math.cos(angle) * radius * value;
      const y = centerY + Math.sin(angle) * radius * value;
      mlbPoints.push({ x, y });
      console.log(`🕷️ MLB point ${i}: angle=${angle.toFixed(2)}, value=${value.toFixed(3)}, x=${x.toFixed(1)}, y=${y.toFixed(1)}`);
    }

    // Draw MLB polygon (orange)
    doc.fillColor('#F39C12', 0.3);
    doc.strokeColor('#F39C12');
    doc.lineWidth(2);

    doc.moveTo(mlbPoints[0].x, mlbPoints[0].y);
    for (let i = 1; i < mlbPoints.length; i++) {
      doc.lineTo(mlbPoints[i].x, mlbPoints[i].y);
    }
    doc.closePath();
    doc.fillAndStroke();

    // Draw athlete polygon (blue)
    const athletePoints = [];
    for (let i = 0; i < numMetrics; i++) {
      const angle = (Math.PI * 2 * i) / numMetrics - Math.PI / 2;
      const value = normalizedData[i].athleteValue;
      const x = centerX + Math.cos(angle) * radius * value;
      const y = centerY + Math.sin(angle) * radius * value;
      athletePoints.push({ x, y });
      console.log(`🕷️ Athlete point ${i}: angle=${angle.toFixed(2)}, value=${value.toFixed(3)}, x=${x.toFixed(1)}, y=${y.toFixed(1)}`);
    }

    doc.fillColor('#3B82F6', 0.4);
    doc.strokeColor('#3B82F6');
    doc.lineWidth(2);

    doc.moveTo(athletePoints[0].x, athletePoints[0].y);
    for (let i = 1; i < athletePoints.length; i++) {
      doc.lineTo(athletePoints[i].x, athletePoints[i].y);
    }
    doc.closePath();
    doc.fillAndStroke();

    // Draw labels
    doc.fontSize(8)
       .font('Helvetica');

    for (let i = 0; i < numMetrics; i++) {
      const angle = (Math.PI * 2 * i) / numMetrics - Math.PI / 2;
      const labelDistance = radius + 20;
      const x = centerX + Math.cos(angle) * labelDistance;
      const y = centerY + Math.sin(angle) * labelDistance;

      doc.fillColor(this.colors.black)
         .text(normalizedData[i].label, x - 30, y - 10, {
           width: 60,
           align: 'center',
           lineGap: -2
         });
    }

    // Draw legend
    const legendY = centerY + radius + 50;
    const legendX = centerX - 60;

    // Athlete legend (blue)
    doc.rect(legendX, legendY, 15, 10)
       .fillAndStroke('#3B82F6', '#3B82F6');
    doc.fontSize(9)
       .fillColor(this.colors.black)
       .text('Athlete', legendX + 20, legendY);

    // MLB average legend (orange)
    doc.rect(legendX + 80, legendY, 15, 10)
       .fillAndStroke('#F39C12', '#F39C12');
    doc.fontSize(9)
       .fillColor(this.colors.black)
       .text('MLB Avg', legendX + 100, legendY);

    doc.y = legendY + 30;
  }
}

// Export singleton instance
const reportGeneratorService = new ReportGeneratorService();
export default reportGeneratorService;