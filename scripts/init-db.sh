#!/bin/bash

# Initialize database schema via Docker

docker exec push-performance-db psql -U postgres -d push_performance <<'EOF'
-- Push Performance Assessment Report Database Schema

-- Table to store percentile ranges for pro athletes
CREATE TABLE IF NOT EXISTS percentile_ranges (
    id SERIAL PRIMARY KEY,
    test_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    min_value DECIMAL(10, 3),
    max_value DECIMAL(10, 3),
    p25 DECIMAL(10, 3),
    p50 DECIMAL(10, 3),
    p75 DECIMAL(10, 3),
    sample_size INTEGER,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(test_type, metric_name)
);

-- Table to store assessment reports
CREATE TABLE IF NOT EXISTS assessment_reports (
    id SERIAL PRIMARY KEY,
    athlete_id VARCHAR(100) NOT NULL,
    athlete_name VARCHAR(255) NOT NULL,
    age INTEGER,
    sport VARCHAR(100),
    position VARCHAR(100),
    school_team VARCHAR(255),
    assessment_date DATE,
    height VARCHAR(20),
    body_mass DECIMAL(10, 2),
    current_injuries TEXT,
    injury_history TEXT,
    posture_presentation TEXT,
    movement_analysis_summary TEXT,
    training_goals TEXT,
    action_plan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to store force plate test results with key takeaways
CREATE TABLE IF NOT EXISTS test_results (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES assessment_reports(id) ON DELETE CASCADE,
    test_type VARCHAR(50) NOT NULL,
    test_data JSONB NOT NULL,
    key_takeaways TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_assessment_reports_athlete_id ON assessment_reports(athlete_id);
CREATE INDEX IF NOT EXISTS idx_test_results_report_id ON test_results(report_id);
CREATE INDEX IF NOT EXISTS idx_percentile_ranges_test_type ON percentile_ranges(test_type);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
\$\$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_assessment_reports_updated_at ON assessment_reports;
CREATE TRIGGER update_assessment_reports_updated_at BEFORE UPDATE
    ON assessment_reports FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EOF

echo "Database schema initialized successfully!"
