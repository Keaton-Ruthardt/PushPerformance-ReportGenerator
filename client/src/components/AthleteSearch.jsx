import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AthleteSearch.css';

const AthleteSearch = ({ onSelectAthlete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [searchMode, setSearchMode] = useState('name'); // 'name' or 'id'
  const [hasSearched, setHasSearched] = useState(false);

  // Mock data for development - replace with actual VALD API call
  const mockAthletes = [
    { id: 'ATH001', name: 'John Smith', position: 'Pitcher', team: 'Team A' },
    { id: 'ATH002', name: 'Mike Johnson', position: 'Catcher', team: 'Team B' },
    { id: 'ATH003', name: 'David Williams', position: 'Shortstop', team: 'Team A' },
    { id: 'ATH004', name: 'James Brown', position: 'Outfielder', team: 'Team C' },
    { id: 'ATH005', name: 'Robert Davis', position: 'First Base', team: 'Team B' }
  ];

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    setHasSearched(true);
    try {
      // Use the real VALD API through our backend
      const response = await axios.get(`/api/athletes/search?term=${searchTerm}&mode=${searchMode}`);

      if (response.data.success) {
        setAthletes(response.data.athletes);
      } else {
        setAthletes([]);
      }

    } catch (error) {
      console.error('Error searching athletes:', error);

      // Fallback to mock data if API fails
      const filtered = mockAthletes.filter(athlete => {
        if (searchMode === 'name') {
          return athlete.name.toLowerCase().includes(searchTerm.toLowerCase());
        } else {
          return athlete.id.toLowerCase().includes(searchTerm.toLowerCase());
        }
      });
      setAthletes(filtered);

    } finally {
      setLoading(false);
    }
  };

  const handleSelectAthlete = (athlete) => {
    setSelectedAthlete(athlete);
    onSelectAthlete(athlete);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="athlete-search-container">
      <div className="search-header">
        <h2>Athlete Performance Assessment</h2>
        <p>Search and select an athlete to view their performance report</p>
      </div>

      <div className="search-controls">
        <div className="search-mode">
          <label>
            <input
              type="radio"
              value="name"
              checked={searchMode === 'name'}
              onChange={(e) => setSearchMode(e.target.value)}
            />
            Search by Name
          </label>
          <label>
            <input
              type="radio"
              value="id"
              checked={searchMode === 'id'}
              onChange={(e) => setSearchMode(e.target.value)}
            />
            Search by ID
          </label>
        </div>

        <div className="search-input-group">
          <input
            type="text"
            className="search-input"
            placeholder={searchMode === 'name' ? 'Enter athlete name...' : 'Enter athlete ID...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button
            className="search-button"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Searching for athletes...</p>
        </div>
      )}

      {!loading && athletes.length > 0 && (
        <div className="athlete-results">
          <h3>Search Results ({athletes.length})</h3>
          <div className="athlete-grid">
            {athletes.map(athlete => (
              <div
                key={athlete.id}
                className={`athlete-card ${selectedAthlete?.id === athlete.id ? 'selected' : ''}`}
                onClick={() => handleSelectAthlete(athlete)}
              >
                <div className="athlete-name">{athlete.name}</div>
                <div className="athlete-details">
                  <span className="athlete-id">ID: {athlete.id}</span>
                  {athlete.position && athlete.position !== 'N/A' && (
                    <span className="athlete-position">{athlete.position}</span>
                  )}
                  {athlete.team && athlete.team !== 'N/A' && (
                    <span className="athlete-team">{athlete.team}</span>
                  )}
                </div>
                <button className="select-button">
                  View Report →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && hasSearched && athletes.length === 0 && (
        <div className="no-results">
          <p>No athletes found matching "{searchTerm}"</p>
          <p>Try searching with a different name or ID</p>
        </div>
      )}
    </div>
  );
};

export default AthleteSearch;