# CMJ Comparative PDF Report - Integration Guide

## Overview

Your application now has a new CMJ (Countermovement Jump) Comparative PDF report feature that compares individual athlete CMJ metrics against **898 professional baseball players** from MLB/MiLB.

## What's New

### New API Endpoint
**POST /api/reports/generate-cmj-pdf**

This endpoint:
1. Fetches real athlete data from VALD Hub
2. Extracts their latest CMJ test
3. Compares 13 CMJ metrics against professional baseline
4. Generates a professional PDF report with percentile rankings

### 13 CMJ Metrics Analyzed
1. Jump Height
2. Eccentric Braking RFD
3. Force at Zero Velocity
4. Eccentric Peak Force
5. Concentric Impulse
6. Eccentric Peak Velocity
7. Concentric Peak Velocity
8. Eccentric Peak Power
9. Eccentric Peak Power / BM
10. Peak Power
11. Peak Power / BM
12. RSI-mod
13. Countermovement Depth

## How to Use

### From Your Existing App

Your AthleteSearch component already allows searching for athletes. To add CMJ PDF generation:

1. **Search for an athlete** using the existing search interface
2. **Call the new endpoint** when "View Report" is clicked:

```javascript
// In ReportViewer.jsx or a new component
const generateCMJPDF = async (athleteId, athleteName) => {
  try {
    const response = await axios.post('/api/reports/generate-cmj-pdf', {
      athleteId: athleteId,
      name: athleteName
    }, {
      responseType: 'blob'
    });

    // Download the PDF
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${athleteName.replace(' ', '_')}_CMJ_Report.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    if (error.response?.status === 404) {
      alert('No CMJ test data found for this athlete');
    } else {
      alert('Error generating PDF. Please try again.');
    }
  }
};
```

### Expected Responses

#### Success (200)
- Returns PDF file as binary data
- Headers include filename for download

#### Not Found (404)
- Athlete has no CMJ test data in VALD
- Error message: "No CMJ test data found for this athlete"

#### Bad Request (400)
- Missing required athleteId parameter

#### Server Error (500)
- Failed to connect to VALD or BigQuery
- Error generating PDF

## PDF Report Features

The generated PDF includes:

✅ **Athlete Profile**
- Name, Age, Sport, Position, Team/School
- Height, Body Mass
- Assessment Date

✅ **CMJ Performance Metrics**
- All 13 metrics with actual values and units
- Visual percentile bars (0-100%)
- Color-coded performance labels:
  - 🟢 **Elite** (≥90th percentile)
  - 🔵 **Above Average** (75-89th percentile)
  - 🟡 **Average** (25-74th percentile)
  - 🔴 **Below Average** (<25th percentile)

✅ **Professional Comparison**
- "vs 898 pro tests" label on each metric
- Percentile ranking against MLB/MiLB players
- Tests from last 2 years

## Testing

### Manual Test via API
```bash
POST http://localhost:5000/api/reports/generate-cmj-pdf
Content-Type: application/json

{
  "athleteId": "your-athlete-id-from-vald",
  "name": "Athlete Name"
}
```

### Find Athletes with CMJ Data

Not all athletes have CMJ tests. To find athletes with CMJ data:

1. Search through your VALD athletes
2. Try generating PDFs - the endpoint will tell you if CMJ data exists
3. Athletes who have performed CMJ tests will successfully generate PDFs

## Technical Details

### Data Flow
1. **VALD Hub API** → Fetch athlete profile and test data
2. **BigQuery** → Load professional athlete statistics (898 tests)
3. **Comparative Service** → Calculate percentiles using linear interpolation
4. **PDF Service** → Generate HTML and convert to PDF using Puppeteer
5. **Client** → Download PDF file

### Performance
- First request: ~3-5 seconds (loads pro stats from BigQuery)
- Subsequent requests: ~1-2 seconds (uses cached pro stats)
- PDF size: ~200-300 KB

### Dependencies
- ✅ VALD Hub API connection (for athlete data)
- ✅ BigQuery connection (for professional baselines)
- ✅ Puppeteer (for PDF generation)

## Troubleshooting

### "No CMJ test data found"
- This athlete hasn't completed a CMJ test yet
- Try a different athlete who has CMJ data

### "Failed to connect to VALD"
- Check VALD_API_KEY and VALD_API_SECRET in .env
- Verify VALD Hub API is accessible

### "Failed to load pro statistics"
- Check BigQuery credentials in .env
- Verify BIGQUERY_DATASET is set to "VALDrefDataCOPY"

### PDF generation fails
- Ensure Puppeteer is installed: `npm install puppeteer`
- Check server logs for detailed error messages

## Next Steps

To integrate this into your existing UI:

1. Add a "Generate CMJ Report" button to your ReportViewer or AthleteSearch component
2. Call the `/api/reports/generate-cmj-pdf` endpoint with the athlete's ID
3. Handle the PDF download and any error cases
4. Optional: Add a loading indicator during PDF generation

The endpoint is ready to use right now - you can start generating CMJ comparative PDFs for any athlete with CMJ test data in your VALD system!
