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
