import React, { useState } from 'react';
import AthleteSearch from './components/AthleteSearch.jsx';
import TestSelection from './components/TestSelection.jsx';
import ReportViewer from './components/ReportViewer.jsx';
import './App.css';

function App() {
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [selectedTests, setSelectedTests] = useState(null);
  const [currentStep, setCurrentStep] = useState('search'); // 'search', 'test-selection', or 'report'

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

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <img src="/push-performance-logo.png" alt="Push Performance" className="app-logo" />
        </div>
        {currentStep !== 'search' && (
          <button className="back-button" onClick={handleBackToSearch}>
            ← Back to Search
          </button>
        )}
      </header>

      <main className="App-main">
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

      <footer className="App-footer">
        <p>Push Performance © {new Date().getFullYear()} | Professional Athletic Assessment</p>
      </footer>
    </div>
  );
}

export default App;