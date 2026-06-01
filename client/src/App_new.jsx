import React, { useState } from 'react';
import AthleteSearch from './components/AthleteSearch.jsx';
import TestSelection from './components/TestSelection.jsx';
import ReportViewer from './components/ReportViewer.jsx';
import { Topbar, Stepper } from './components/Shell.jsx';

function App() {
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [selectedTests, setSelectedTests] = useState(null);
  const [currentStep, setCurrentStep] = useState('search');

  const handleSelectAthlete = (athlete) => {
    setSelectedAthlete(athlete);
    setCurrentStep('test-selection');
  };

  const handleTestSelection = (tests) => {
    setSelectedTests(tests);
    setCurrentStep('report');
  };

  const handleBackToSearch = () => {
    setSelectedAthlete(null);
    setSelectedTests(null);
    setCurrentStep('search');
  };

  const handleBackToTestSelection = () => {
    setSelectedTests(null);
    setCurrentStep('test-selection');
  };

  const stepIndex =
    currentStep === 'search' ? 0
    : currentStep === 'test-selection' ? 1
    : 2;

  const crumbs =
    currentStep === 'search' ? ['Assessments', 'New']
    : currentStep === 'test-selection' ? ['Assessments', selectedAthlete?.name || '', 'Tests']
    : ['Assessments', selectedAthlete?.name || '', 'Report'];

  return (
    <div className="app-shell">
      <Topbar crumbs={crumbs} athlete={stepIndex > 0 ? selectedAthlete : null} />
      <Stepper current={stepIndex} />

      <main style={{ flex: 1 }}>
        {currentStep === 'search' && (
          <AthleteSearch onSelectAthlete={handleSelectAthlete} />
        )}

        {currentStep === 'test-selection' && (
          <TestSelection
            athlete={selectedAthlete}
            onConfirmSelection={handleTestSelection}
            onBack={handleBackToSearch}
          />
        )}

        {currentStep === 'report' && (
          <ReportViewer
            athlete={selectedAthlete}
            selectedTests={selectedTests}
            onBack={handleBackToTestSelection}
          />
        )}
      </main>
    </div>
  );
}

export default App;
