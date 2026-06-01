import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { I } from './Shell.jsx';

const AthleteSearch = ({ onSelectAthlete }) => {
  const [mode, setMode] = useState('name');
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [hovered, setHovered] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const runSearch = async () => {
    if (!term.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const response = await axios.get(`/api/athletes/search?term=${encodeURIComponent(term)}&mode=${mode}`);
      if (response.data.success) {
        setResults(response.data.athletes);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Error searching athletes:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '40px 32px', paddingTop: 56 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div className="eyebrow">Step 01 · Athlete</div>
          <h1 className="h1" style={{ marginTop: 10, marginBottom: 6 }}>Find an athlete.</h1>
          <p className="muted" style={{ fontSize: 15, maxWidth: 560 }}>
            Pull the athlete's VALD profile to begin a force-plate assessment. Benchmarks are drawn from the MLB Professional population.
          </p>
        </div>
      </div>

      <div className="surface-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 64 }}>
            <I.search style={{ color: 'var(--ink-4)' }} />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder={mode === 'name' ? 'Search athletes by name…' : 'Athlete ID (e.g. VALD-8821)'}
              style={{
                border: 0, outline: 'none', width: '100%', fontSize: 18, background: 'transparent',
                fontFamily: mode === 'id' ? 'var(--mono)' : 'var(--sans)',
                letterSpacing: mode === 'id' ? '0' : '-0.01em',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 2, padding: '0 12px', borderLeft: '1px solid var(--line)', height: 64, alignItems: 'center' }}>
            {['name', 'id'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="btn btn-sm"
                style={{
                  height: 30,
                  background: mode === m ? 'var(--paper-2)' : 'transparent',
                  color: mode === m ? 'var(--ink)' : 'var(--ink-4)',
                  fontWeight: 600,
                }}
              >
                {m === 'name' ? 'By Name' : 'By ID'}
              </button>
            ))}
          </div>
          <div style={{ padding: '0 16px', borderLeft: '1px solid var(--line)', height: 64, display: 'flex', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={runSearch} disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
              <span className="kbd" style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: '#E8E5E0' }}>⏎</span>
            </button>
          </div>
        </div>
      </div>

      {hasSearched && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '32px 0 14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div className="h2" style={{ fontSize: 20 }}>
              {loading ? 'Searching…' : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}
            </div>
            {!loading && (
              <span className="muted" style={{ fontSize: 13 }}>
                matching <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>"{term}"</span> in{' '}
                <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>MLB Professional</span>
              </span>
            )}
          </div>
        </div>
      )}

      {hasSearched && !loading && results.length > 0 && (
        <div className="surface-card" style={{ overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '52px 1fr 120px',
            alignItems: 'center', padding: '10px 20px',
            background: 'var(--paper-2)', borderBottom: '1px solid var(--line)',
            fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--ink-4)', fontWeight: 700,
          }}>
            <div></div>
            <div>Athlete</div>
            <div style={{ textAlign: 'right' }}>Action</div>
          </div>
          {results.map((r, idx) => {
            const h = hovered === r.id;
            const initials = (r.name || '').split(' ').map((n) => n[0]).slice(0, 2).join('');
            return (
              <button
                key={r.id}
                onClick={() => onSelectAthlete({ ...r, tier: 'pro' })}
                onMouseEnter={() => setHovered(r.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'grid', gridTemplateColumns: '52px 1fr 120px',
                  alignItems: 'center', width: '100%', padding: '18px 20px', textAlign: 'left',
                  borderBottom: idx < results.length - 1 ? '1px solid var(--line)' : 'none',
                  background: h ? 'var(--paper-2)' : 'transparent',
                  border: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  transition: 'background .1s',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--ink)', color: 'var(--paper)',
                    display: 'grid', placeItems: 'center',
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                  }}>
                    {initials}
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{r.name}</div>
                  </div>
                  <div className="muted mono" style={{ fontSize: 11.5, marginTop: 2 }}>{r.id?.slice(0, 18)}</div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                  <span style={{
                    color: h ? 'var(--accent)' : 'var(--ink-5)',
                    transition: 'color .12s',
                    transform: h ? 'translateX(2px)' : 'none',
                  }}>
                    <I.arrow />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && (
        <div className="surface-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No athletes found</div>
          <div className="muted">Try a different name or ID.</div>
        </div>
      )}

      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-4)', fontSize: 12 }}>
        <I.info /> Results are pulled live from the VALD Hub database.
      </div>
    </div>
  );
};

export default AthleteSearch;
