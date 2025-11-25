import { generatePDF } from './server/services/pdfServiceV2.js';
import fs from 'fs';

const testData = {
  athleteName: "DEBUG TEST ATHLETE",
  age: 25,
  sport: "Basketball",
  position: "Forward",
  schoolTeam: "Test Team",
  assessmentDate: "2025-01-20",
  height: "6'5\"",
  bodyMass: 200,
  currentInjuries: "None",
  injuryHistory: "Previous ankle sprain",
  posturePresentation: "Good posture",
  movementAnalysisSummary: "Excellent movement",
  trainingGoals: "Improve vertical jump",
  actionPlan: "Plyometric training 3x/week",
  testResults: [
    { testType: 'cmj', data: { jump_height: 50, peak_power: 5000 }, keyTakeaways: 'Excellent power' },
    { testType: 'sj', data: { jump_height: 45 }, keyTakeaways: 'Good strength' },
    { testType: 'ht', data: { rsi: 1.5 }, keyTakeaways: 'Great reactivity' },
    { testType: 'slcmj', data: { left_jump_height: 30, right_jump_height: 32 }, keyTakeaways: 'Slight asymmetry' },
    { testType: 'imtp', data: { peak_force: 3500 }, keyTakeaways: 'Strong' },
    { testType: 'ppu', data: { left_peak_force: 500, right_peak_force: 520 }, keyTakeaways: 'Balanced' },
  ],
};

console.log('Generating PDF from V2 service...');
const pdfBuffer = await generatePDF(testData);
fs.writeFileSync('VERIFICATION-TEST.pdf', pdfBuffer);
console.log('✅ PDF saved as VERIFICATION-TEST.pdf');
console.log('📊 PDF size:', pdfBuffer.length, 'bytes');
