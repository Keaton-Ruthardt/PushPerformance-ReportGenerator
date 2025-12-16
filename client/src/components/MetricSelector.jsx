import React, { useState } from 'react';
import './MetricSelector.css';

/**
 * MetricSelector Component
 * Allows users to select which metrics appear in spider/radar charts
 */
const MetricSelector = ({ testType, availableMetrics, selectedMetrics, onMetricsChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleMetric = (metricKey) => {
    const newSelection = selectedMetrics.includes(metricKey)
      ? selectedMetrics.filter(key => key !== metricKey)
      : [...selectedMetrics, metricKey];

    // Ensure at least 3 metrics are selected for a proper spider chart
    if (newSelection.length >= 3) {
      onMetricsChange(newSelection);
    }
  };

  const handleSelectAll = () => {
    onMetricsChange(availableMetrics.map(m => m.key));
  };

  const handleResetToDefaults = () => {
    const defaults = {
      cmj: ['jumpHeight', 'rsi', 'peakPowerBM', 'eccentricBrakingRFD', 'concentricPeakVelocity', 'eccentricPeakPowerBM'],
      squatJump: ['jumpHeight', 'forceAtPeakPower', 'concentricPeakVelocity', 'peakPower', 'peakPowerBM'],
      hopTest: ['rsi', 'jumpHeight', 'gct'],
      imtp: ['peakVerticalForce', 'peakForceBM', 'forceAt100ms', 'timeToPeakForce'],
      ppu: ['pushupHeight', 'eccentricPeakForce', 'concentricPeakForce', 'concentricRFD_L', 'concentricRFD_R', 'eccentricBrakingRFD']
    };
    onMetricsChange(defaults[testType] || availableMetrics.map(m => m.key));
  };

  return (
    <div className="metric-selector">
      <div className="metric-selector-header">
        <h4>Spider Chart Metrics</h4>
        <button
          className="toggle-selector-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? "Collapse metric selector" : "Expand metric selector"}
        >
          {isExpanded ? '▼' : '▶'} {selectedMetrics.length} of {availableMetrics.length} selected
        </button>
      </div>

      {isExpanded && (
        <div className="metric-selector-content">
          <div className="metric-selector-actions">
            <button
              className="action-btn select-all-btn"
              onClick={handleSelectAll}
              disabled={selectedMetrics.length === availableMetrics.length}
            >
              Select All
            </button>
            <button
              className="action-btn reset-btn"
              onClick={handleResetToDefaults}
            >
              Reset to Default
            </button>
          </div>

          <div className="metric-checkboxes">
            {availableMetrics.map((metric) => {
              const isSelected = selectedMetrics.includes(metric.key);
              const isDisabled = selectedMetrics.length === 3 && isSelected;

              return (
                <label
                  key={metric.key}
                  className={`metric-checkbox-label ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleMetric(metric.key)}
                    disabled={isDisabled}
                  />
                  <span className="metric-label-text">{metric.label}</span>
                </label>
              );
            })}
          </div>

          {selectedMetrics.length < 3 && (
            <div className="metric-selector-warning">
              ⚠️ Select at least 3 metrics for the spider chart
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MetricSelector;
