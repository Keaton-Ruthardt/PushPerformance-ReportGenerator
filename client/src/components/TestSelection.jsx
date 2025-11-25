import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TestSelection.css';

// Create axios instance with explicit backend URL
const apiClient = axios.create({
  baseURL: import.meta.env.DEV ? 'http://localhost:5000' : '',
  headers: { 'Content-Type': 'application/json' }
});

const TestSelection = ({ athlete, onConfirmSelection, onBack }) => {
  // Test selection component with flexible date selection
  const [allTests, setAllTests] = useState({});
  const [selectedTests, setSelectedTests] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllTests();
  }, [athlete]);

  const fetchAllTests = async () => {
    setLoading(true);
    try {
      // Log athlete object to see what we have
      console.log('🔍 TestSelection - Athlete object:', JSON.stringify(athlete, null, 2));
      console.log('🔍 TestSelection - Has profileIds?:', athlete.profileIds);
      console.log('🔍 TestSelection - profileIds length:', athlete.profileIds?.length);

      // If athlete has multiple profile IDs, pass them as query param to get tests from all APIs
      const profileIdsParam = athlete.profileIds && athlete.profileIds.length > 1
        ? `?profileIds=${athlete.profileIds.join(',')}`
        : '';

      console.log('🔍 TestSelection - Query param:', profileIdsParam);

      const response = await apiClient.get(`/api/athletes/${athlete.id}/tests/all${profileIdsParam}`);

      if (response.data.success) {
        setAllTests(response.data.tests);

        // Auto-select the most recent test for each type
        const autoSelected = {};
        Object.keys(response.data.tests).forEach(testType => {
          const tests = response.data.tests[testType];
          if (tests && tests.length > 0) {
            // Sort by date descending and select the first (most recent)
            const sorted = [...tests].sort((a, b) =>
              new Date(b.recordedDateUtc || b.testDate) - new Date(a.recordedDateUtc || a.testDate)
            );
            autoSelected[testType] = sorted[0].testId || sorted[0].id;
          }
        });
        setSelectedTests(autoSelected);
      }
    } catch (error) {
      console.error('Error fetching tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSelection = (testType, testId) => {
    setSelectedTests(prev => ({
      ...prev,
      [testType]: testId
    }));
  };

  const handleTestTypeToggle = (testType) => {
    setSelectedTests(prev => {
      const newSelected = { ...prev };
      if (newSelected[testType]) {
        // Remove this test type from selection
        delete newSelected[testType];
      } else {
        // Add this test type - select the most recent test
        const tests = allTests[testType] || [];
        if (tests.length > 0) {
          const sorted = [...tests].sort((a, b) =>
            new Date(b.recordedDateUtc || b.testDate) - new Date(a.recordedDateUtc || a.testDate)
          );
          newSelected[testType] = sorted[0].testId || sorted[0].id;
        }
      }
      return newSelected;
    });
  };

  const handleConfirm = () => {
    // Filter out tests marked as 'SKIP'
    const testsToInclude = Object.entries(selectedTests).reduce((acc, [testType, testId]) => {
      if (testId && testId !== 'SKIP') {
        acc[testType] = testId;
      }
      return acc;
    }, {});

    onConfirmSelection(testsToInclude);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';

    // Handle different date formats from VALD
    let date;
    if (dateString.includes('T')) {
      // ISO format: 2024-11-04T10:30:00Z
      date = new Date(dateString);
    } else if (dateString.includes('-')) {
      // Date only: 2024-11-04
      date = new Date(dateString + 'T00:00:00');
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      return dateString; // Return original if can't parse
    }

    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const testTypeLabels = {
    cmj: 'Countermovement Jump (CMJ)',
    squatJump: 'Squat Jump (SJ)',
    imtp: 'Isometric Mid-Thigh Pull (IMTP)',
    singleLegCMJ: 'Single Leg CMJ',
    hopTest: 'Hop Test',
    plyoPushUp: 'Plyometric Push-Up'
  };

  // Order for displaying test types
  const testTypeOrder = ['cmj', 'squatJump', 'imtp', 'singleLegCMJ', 'hopTest', 'plyoPushUp'];

  if (loading) {
    return (
      <div className="test-selection-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading available tests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="test-selection-container">
      <div className="test-selection-header">
        <h2>Select Tests for {athlete.name}</h2>
        <p>Choose which test date you want to use for each test type</p>
      </div>

      <div className="test-types-grid">
        {testTypeOrder.map(testType => {
          const tests = allTests[testType] || [];
          const hasTests = tests.length > 0;

          return (
            <div key={testType} className={`test-type-card ${!hasTests ? 'no-tests-card' : ''}`}>
              <h3>{testTypeLabels[testType] || testType}</h3>

              {!hasTests ? (
                <div className="no-tests-message">
                  <p>No tests taken for this athlete</p>
                </div>
              ) : (
                <div className="test-dropdown-container">
                  <label htmlFor={`${testType}-select`} className="dropdown-label">
                    Select Test Date ({tests.length} test{tests.length !== 1 ? 's' : ''} available)
                  </label>
                  <select
                    id={`${testType}-select`}
                    className="test-date-dropdown"
                    value={selectedTests[testType] || 'SKIP'}
                    onChange={(e) => handleTestSelection(testType, e.target.value)}
                  >
                    <option value="SKIP" style={{ fontStyle: 'italic' }}>
                      Skip this test (don't include in report)
                    </option>
                    {tests.map((test, index) => {
                      const testId = test.testId || test.id || `${testType}-${index}`;
                      const dateStr = formatDate(test.recordedDateUtc || test.testDate || test.TestDate || test.date);

                      // Build option text with additional info
                      let optionText = dateStr;

                      // Show limb info for Single Leg CMJ sessions
                      if (test.limbsAvailable) {
                        optionText += ` (${test.limbsAvailable})`;
                      } else if (test.limb) {
                        optionText += ` (${test.limb} Leg)`;
                      }
                      if (test.jumpHeight) {
                        optionText += ` - Jump: ${test.jumpHeight}cm`;
                      }
                      if (test.JUMP_HEIGHT_IMP_MOM_Trial_cm) {
                        optionText += ` - Jump: ${test.JUMP_HEIGHT_IMP_MOM_Trial_cm.toFixed(1)}cm`;
                      }

                      return (
                        <option key={testId} value={testId}>
                          {optionText}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="test-selection-actions">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <button
          className="confirm-btn"
          onClick={handleConfirm}
          disabled={Object.values(selectedTests).every(testId => !testId || testId === 'SKIP')}
        >
          Generate Report →
        </button>
      </div>
    </div>
  );
};

export default TestSelection;
