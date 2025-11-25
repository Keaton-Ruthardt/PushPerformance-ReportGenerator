-- BigQuery SQL to add hop_rsi_avg_best_5 column
-- This creates a new table with the regular RSI column added

-- Step 1: Create a new version of the table with hop_rsi_avg_best_5 calculated
-- Replace 'VALDrefDataCOPY' with your actual dataset name

CREATE OR REPLACE TABLE `vald-ref-data-copy.VALDrefDataCOPY.HJ_result_updated` AS
SELECT
  *,
  -- Calculate hop_rsi_avg_best_5 if it doesn't exist
  -- This is a placeholder - you'll need to recalculate from source data
  CASE
    WHEN hop_rsi_avg_best_5 IS NULL THEN
      -- If you have the individual RSI values, calculate average of best 5 here
      -- For now, this just preserves existing values
      hop_rsi_avg_best_5
    ELSE
      hop_rsi_avg_best_5
  END as hop_rsi_avg_best_5
FROM `vald-ref-data-copy.VALDrefDataCOPY.HJ_result_updated`;

-- Note: If hop_rsi_avg_best_5 column doesn't exist yet, you'll need to:
-- 1. First add the column using ALTER TABLE ADD COLUMN
-- 2. Then populate it with values from your data source

-- To add the column if it doesn't exist:
-- ALTER TABLE `vald-ref-data-copy.VALDrefDataCOPY.HJ_result_updated`
-- ADD COLUMN IF NOT EXISTS hop_rsi_avg_best_5 FLOAT64;
