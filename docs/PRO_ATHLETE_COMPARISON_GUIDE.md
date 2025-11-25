# 🏆 Pro Athlete Comparison System - Complete Guide

## Overview

This system allows you to compare your athletes against **professional athlete benchmarks** by:
1. Fetching pro athlete data from VALD Hub
2. Calculating percentile ranges for all test metrics
3. Storing benchmarks in PostgreSQL
4. Ranking athletes against pro standards with color-coded insights

---

## 🎯 How It Works

### Step 1: Tag Pro Athletes in VALD Hub

Pro athletes must be identified in VALD Hub using one of these methods:

**Method A: Tags**
- Add tags like: `Pro`, `Professional`, `Elite`, `MLB`, `NFL`, etc.

**Method B: Groups**
- Create a group named: "Pro Athletes" or "Professionals"
- Add athletes to this group

**Method C: Categories**
- Create a category for professional athletes
- Organize pros under this category

### Step 2: Sync Pro Athlete Data

Run the sync script to fetch pro athlete test results and calculate percentiles:

```bash
cd "C:\Users\Jkeat\Push Performance\push-performance-app"
node sync-pro-athletes.js
```

**What This Does:**
1. Fetches all pro athletes from your VALD tenant
2. Gets their Force Deck test results (last 365 days)
3. Calculates 25th, 50th, and 75th percentiles for each metric
4. Stores percentile ranges in `percentile_ranges` table

**Output:**
```
🏆 Fetching pro athletes from VALD...
📊 Total profiles found: 150
✅ Pro athletes found: 45

📊 Fetching test results for pro athletes...
  ✅ John Doe: 12 tests
  ✅ Jane Smith: 8 tests
  ...

✅ Total tests collected: 487

📊 Calculating percentiles for all metrics...
  📈 CMJ
     jump_height: n=45, p50=38.50
     peak_power: n=45, p50=4250.00
     ...

💾 Storing percentile data in database...
✅ Stored 58 percentile records

🎉 Sync Complete!
Pro Athletes Processed: 45
Tests Analyzed: 487
Percentile Records Stored: 58
Duration: 12.34 seconds
```

### Step 3: Compare Athletes

Use the comparison service in your app:

```javascript
import { compareAthleteToProBenchmarks } from './server/services/athleteComparisonService.js';

// Athlete's test data
const testData = {
  jump_height: 35.5,
  peak_power: 4200,
  peak_force: 2100,
  rsi: 1.8,
};

// Compare against pro benchmarks
const comparison = await compareAthleteToProBenchmarks(testData, 'cmj');

// Results include:
// - Percentile ranking for each metric
// - Color coding (green/yellow/red)
// - Insights (strengths & areas for improvement)
```

---

## 📊 Percentile Ranking System

### Color Coding

| Percentile | Color | Label | Meaning |
|------------|-------|-------|---------|
| 75th - 100th | 🟢 Green | **Elite** | Top 25% of pros |
| 50th - 75th | 🟡 Light Green | **Above Average** | Better than half of pros |
| 25th - 50th | 🟡 Yellow | **Average** | Middle 50% of pros |
| 0 - 25th | 🔴 Red | **Needs Improvement** | Below pro baseline |

### Example Output

```
CMJ TEST - John Smith

jump_height:
  Value: 35.5 cm
  Percentile: 42nd (Average)
  Pro Range: 32.5 (25th) | 38.5 (50th) | 44.2 (75th)

peak_power:
  Value: 4200 watts
  Percentile: 78th (Elite)
  Pro Range: 3800 (25th) | 4100 (50th) | 4450 (75th)

Overall Test Ranking: 🏆 ABOVE AVERAGE

💡 Insights:
  💪 peak_power: Elite level (top 25% of pros)
  🎯 jump_height: Focus area - improve explosive power
```

---

## 🔄 Keeping Data Fresh

### Automated Sync (Recommended)

The backend server has a cron job configured to sync percentiles automatically:

```javascript
// In server/index.js
cron.schedule('0 3 * * *', () => {  // Daily at 3 AM
  syncPercentiles();
});
```

### Manual Sync

Run anytime to update with latest pro athlete data:

```bash
node sync-pro-athletes.js
```

**When to Sync:**
- Weekly: If pros compete regularly
- Monthly: If testing is less frequent
- After major competitions: To capture peak performance data

---

## 🗄️ Database Schema

### `percentile_ranges` Table

```sql
CREATE TABLE percentile_ranges (
    id SERIAL PRIMARY KEY,
    test_type VARCHAR(50) NOT NULL,        -- 'cmj', 'sj', 'imtp', etc.
    metric_name VARCHAR(100) NOT NULL,     -- 'jump_height', 'peak_power', etc.
    min_value DECIMAL(10, 3),              -- Minimum value in dataset
    max_value DECIMAL(10, 3),              -- Maximum value in dataset
    p25 DECIMAL(10, 3),                    -- 25th percentile
    p50 DECIMAL(10, 3),                    -- 50th percentile (median)
    p75 DECIMAL(10, 3),                    -- 75th percentile
    sample_size INTEGER,                   -- Number of pro athletes
    last_updated TIMESTAMP,                -- When this was calculated
    UNIQUE(test_type, metric_name)
);
```

### Query Examples

**Get percentile range for a specific metric:**
```sql
SELECT * FROM percentile_ranges
WHERE test_type = 'cmj' AND metric_name = 'jump_height';
```

**View all metrics for a test type:**
```sql
SELECT metric_name, p25, p50, p75, sample_size
FROM percentile_ranges
WHERE test_type = 'cmj'
ORDER BY metric_name;
```

**Check when data was last updated:**
```sql
SELECT test_type, MAX(last_updated) as last_sync
FROM percentile_ranges
GROUP BY test_type;
```

---

## 🎨 Integrating Into Reports

### PDF Report Enhancement

Update `pdfServiceV2.js` to show percentile rankings:

```javascript
// Get comparison for athlete's test
const comparison = await compareAthleteToProBenchmarks(testData, 'cmj');

// Add to PDF HTML
<div class="metric-row">
  <span>Jump Height: ${testData.jump_height} cm</span>
  <span class="${comparison.metrics.jump_height.color}">
    ${comparison.metrics.jump_height.percentile}th percentile
  </span>
</div>
```

### Dashboard Visualization

Show athlete progress over time:

```javascript
// Fetch athlete's historical tests
const historicalTests = await getAthleteTests(athleteId);

// Compare each test
const progressData = await Promise.all(
  historicalTests.map(test =>
    compareAthleteToProBenchmarks(test.data, test.testType)
  )
);

// Chart percentile rankings over time
<LineChart data={progressData} />
```

---

## 📈 Advanced Usage

### Sport-Specific Benchmarks

Modify the pro athlete filter to segment by sport:

```javascript
// In proAthleteService.js
export const fetchProAthletesBySport = async (sport) => {
  const allPros = await fetchProAthletes();

  return allPros.filter(athlete =>
    athlete.sport?.toLowerCase() === sport.toLowerCase() &&
    (athlete.tags?.includes('pro') || athlete.groups?.some(g => g.name.includes('Pro')))
  );
};
```

### Position-Specific Comparisons

Compare pitchers vs pitchers, outfielders vs outfielders:

```javascript
const pitcherBenchmarks = await calculatePercentilesForPosition('Baseball', 'Pitcher');
const comparison = compareToPositionBenchmarks(athleteData, pitcherBenchmarks);
```

### Custom Percentile Ranges

Use different percentiles (e.g., 10th, 90th):

```javascript
const getCustomPercentile = (values, percentile) => {
  const sorted = values.sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  return sorted[Math.floor(index)];
};
```

---

## 🐛 Troubleshooting

### Issue: No Pro Athletes Found

**Cause:** Athletes aren't tagged properly in VALD Hub

**Solution:**
1. Log into VALD Hub
2. Verify athletes have "Pro" or "Professional" tag
3. Or add them to a "Pro Athletes" group
4. Run sync again

### Issue: No Test Data

**Cause:** Pro athletes don't have recent Force Deck tests

**Solution:**
1. Check `daysBack` parameter (default: 365 days)
2. Increase range: `syncProAthletePercentiles(TENANT_ID, 730)` for 2 years
3. Verify pros have completed Force Deck tests in VALD

### Issue: Percentile Data Outdated

**Cause:** Sync hasn't run recently

**Solution:**
```bash
node sync-pro-athletes.js
```

Or check cron schedule in `server/index.js`

### Issue: Database Connection Error

**Cause:** PostgreSQL not running or wrong credentials

**Solution:**
1. Start PostgreSQL service
2. Verify `.env` database credentials
3. Test connection: `psql -U postgres -d push_performance`

---

## 📊 API Endpoints (Future)

### Get Percentile Data

```
GET /api/percentiles/:testType/:metricName
```

Response:
```json
{
  "testType": "cmj",
  "metricName": "jump_height",
  "p25": 32.5,
  "p50": 38.5,
  "p75": 44.2,
  "sampleSize": 45,
  "lastUpdated": "2025-01-15T03:00:00.000Z"
}
```

### Compare Athlete

```
POST /api/compare
```

Request:
```json
{
  "testType": "cmj",
  "testData": {
    "jump_height": 35.5,
    "peak_power": 4200
  }
}
```

Response:
```json
{
  "metrics": {
    "jump_height": {
      "percentile": 42,
      "label": "Average",
      "color": "yellow"
    },
    "peak_power": {
      "percentile": 78,
      "label": "Elite",
      "color": "green"
    }
  },
  "overallRank": "above_average",
  "insights": [...]
}
```

---

## 🚀 Next Steps

1. **Populate VALD with Pro Athletes**
   - Tag existing pros in VALD Hub
   - Import historical test data

2. **Run Initial Sync**
   ```bash
   node sync-pro-athletes.js
   ```

3. **Test Comparison**
   ```bash
   node test-athlete-comparison.js
   ```

4. **Integrate Into App**
   - Add percentile rankings to PDF reports
   - Show color-coded comparisons in dashboard
   - Create progress tracking charts

5. **Schedule Regular Syncs**
   - Verify cron job is running
   - Monitor `last_updated` timestamps
   - Adjust frequency based on data freshness needs

---

## 📞 Support

For questions or issues:
- Check `sync-pro-athletes.js` output for error messages
- Verify VALD API connectivity
- Review database logs
- Contact VALD support for API access issues

---

**Your percentile comparison system is ready to go! 🎉**
