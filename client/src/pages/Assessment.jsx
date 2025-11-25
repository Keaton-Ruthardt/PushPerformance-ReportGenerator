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
