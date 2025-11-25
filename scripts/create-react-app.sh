#!/bin/bash

echo "🚀 Creating complete React frontend for Push Performance..."

cd client/src

# API Client
cat > api/client.js << 'ENDOFFILE'
import axios from 'axios';

const API_BASE_URL = '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const api = {
  login: (username, password) => apiClient.post('/auth/login', { username, password }),
  getAthletes: () => apiClient.post('/athletes'),
  createReport: (data) => apiClient.post('/reports', data),
  getReport: (id) => apiClient.get(`/reports/${id}`),
  generatePDF: async (data) => {
    const res = await apiClient.post('/pdf/generate', data, { responseType: 'blob' });
    return res.data;
  },
};
ENDOFFILE

# Auth Context
cat > context/AuthContext.jsx << 'ENDOFFILE'
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(userData);
    }
  }, [token]);

  const login = (authToken, userData) => {
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
ENDOFFILE

# Login Page
cat > pages/Login.jsx << 'ENDOFFILE'
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.login(username, password);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px', textAlign: 'center' }}>
          PUSH PERFORMANCE
        </h1>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '30px' }}>
          Assessment System Login
        </p>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
ENDOFFILE

# Dashboard
cat > pages/Dashboard.jsx << 'ENDOFFILE'
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'white' }}>PUSH PERFORMANCE</h1>
          <p style={{ color: '#e5e7eb', fontSize: '18px' }}>Welcome, {user?.username}</p>
        </div>
        <button className="btn btn-secondary" onClick={logout}>Logout</button>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>Quick Actions</h2>
        <div className="grid grid-2">
          <button
            className="btn btn-primary"
            onClick={() => navigate('/assessment')}
            style={{ padding: '30px', fontSize: '18px', height: 'auto' }}
          >
            ➕ Create New Assessment
          </button>
          <button
            className="btn btn-primary"
            onClick={() => alert('Athlete search coming soon!')}
            style={{ padding: '30px', fontSize: '18px', height: 'auto' }}
          >
            🔍 Search Athletes
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '15px' }}>Recent Assessments</h2>
        <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No recent assessments</p>
      </div>
    </div>
  );
}
ENDOFFILE

# Assessment Page (Basic)
cat > pages/Assessment.jsx << 'ENDOFFILE'
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Assessment() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    athleteId: '',
    athleteName: '',
    age: '',
    sport: '',
    position: '',
    schoolTeam: '',
    assessmentDate: new Date().toISOString().split('T')[0],
    height: '',
    bodyMass: '',
    currentInjuries: '',
    injuryHistory: '',
    posturePresentation: '',
    movementAnalysisSummary: '',
    trainingGoals: '',
    actionPlan: '',
  });

  const [tests, setTests] = useState([
    { testType: 'cmj', data: { jump_height: '', peak_power: '', peak_force: '' }, keyTakeaways: '' },
    { testType: 'sj', data: { jump_height: '', peak_power: '' }, keyTakeaways: '' },
    { testType: 'ht', data: { rsi: '', jump_height: '', contact_time: '' }, keyTakeaways: '' },
    { testType: 'slcmj', data: { left_jump_height: '', right_jump_height: '', asymmetry: '' }, keyTakeaways: '' },
    { testType: 'imtp', data: { peak_force: '', rfd: '' }, keyTakeaways: '' },
    { testType: 'ppu', data: { left_peak_force: '', right_peak_force: '', asymmetry: '' }, keyTakeaways: '' },
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const reportData = { ...formData, testResults: tests };
      await api.createReport(reportData);

      const pdfBlob = await api.generatePDF(reportData);
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formData.athleteName}_Assessment.pdf`;
      a.click();

      alert('Assessment saved and PDF generated!');
      navigate('/dashboard');
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'white' }}>New Assessment</h1>
        <button onClick={() => navigate('/dashboard')} style={{ color: 'white', marginTop: '10px' }}>← Back to Dashboard</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>Athlete Information</h2>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">Athlete ID</label>
              <input className="form-input" value={formData.athleteId} onChange={(e) => setFormData({...formData, athleteId: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Athlete Name</label>
              <input className="form-input" value={formData.athleteName} onChange={(e) => setFormData({...formData, athleteName: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Age</label>
              <input className="form-input" type="number" value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Sport</label>
              <input className="form-input" value={formData.sport} onChange={(e) => setFormData({...formData, sport: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Position</label>
              <input className="form-input" value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Team/School</label>
              <input className="form-input" value={formData.schoolTeam} onChange={(e) => setFormData({...formData, schoolTeam: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>Force Plate Tests (simplified)</h2>
          <p style={{ color: '#6b7280', marginBottom: '15px' }}>Enter test data for each test type:</p>
          {tests.map((test, idx) => (
            <div key={idx} style={{ marginBottom: '20px', padding: '15px', background: '#f9fafb', borderRadius: '8px' }}>
              <h3 style={{ fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase' }}>{test.testType}</h3>
              <textarea
                className="form-input"
                placeholder="Key takeaways..."
                value={test.keyTakeaways}
                onChange={(e) => {
                  const newTests = [...tests];
                  newTests[idx].keyTakeaways = e.target.value;
                  setTests(newTests);
                }}
                rows="2"
              />
            </div>
          ))}
        </div>

        <div className="card">
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>Assessment & Training</h2>
          <div className="form-group">
            <label className="form-label">Training Goals</label>
            <textarea className="form-input" value={formData.trainingGoals} onChange={(e) => setFormData({...formData, trainingGoals: e.target.value})} rows="4" />
          </div>
          <div className="form-group">
            <label className="form-label">Action Plan</label>
            <textarea className="form-input" value={formData.actionPlan} onChange={(e) => setFormData({...formData, actionPlan: e.target.value})} rows="4" />
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ fontSize: '18px', padding: '15px 40px' }}>
          {loading ? 'Generating...' : '💾 Save & Generate PDF'}
        </button>
      </form>
    </div>
  );
}
ENDOFFILE

echo "✅ All React components created!"
echo "🚀 Ready to run: npm run dev"
ENDOFFILE

chmod +x create-react-app.sh

bash create-react-app.sh

echo ""
echo "=========================="
echo "✅ REACT FRONTEND COMPLETE!"
echo "=========================="
echo ""
echo "📝 To start the frontend:"
echo "   cd client"
echo "   npm run dev"
echo ""
echo "🌐 Then visit: http://localhost:3000"
echo ""
