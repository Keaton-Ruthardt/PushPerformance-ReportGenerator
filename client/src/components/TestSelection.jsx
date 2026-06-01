import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { I } from './Shell.jsx';

const apiClient = axios.create({
  baseURL: import.meta.env.DEV ? 'http://localhost:5000' : '',
  headers: { 'Content-Type': 'application/json' }
});

const TEST_TYPES = [
  { key: 'cmj',          name: 'Countermovement Jump',  short: 'CMJ',    desc: 'Lower-body power, braking & propulsive strategy' },
  { key: 'squatJump',    name: 'Squat Jump',            short: 'SJ',     desc: 'Concentric-only lower-body power' },
  { key: 'imtp',         name: 'Isometric Mid-Thigh Pull', short: 'IMTP', desc: 'Maximal force production and early-phase RFD' },
  { key: 'singleLegCMJ', name: 'Single Leg CMJ',        short: 'SL CMJ', desc: 'Unilateral power & limb symmetry' },
  { key: 'hopTest',      name: 'Hop Test',              short: 'HOP',    desc: 'Reactive strength' },
  { key: 'plyoPushUp',   name: 'Plyometric Push-Up',    short: 'PPU',    desc: 'Upper-body explosive strength' },
];

const formatDate = (dateString) => {
  if (!dateString) return 'No date';
  let date = dateString.includes('T') ? new Date(dateString)
    : dateString.includes('-') ? new Date(dateString + 'T00:00:00')
    : new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

const TestSelection = ({ athlete, onConfirmSelection, onBack }) => {
  const [allTests, setAllTests] = useState({});
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAllTests(); }, [athlete]);

  const fetchAllTests = async () => {
    setLoading(true);
    try {
      const profileIdsParam = athlete.profileIds && athlete.profileIds.length > 1
        ? `?profileIds=${athlete.profileIds.join(',')}`
        : '';
      const response = await apiClient.get(`/api/athletes/${athlete.id}/tests/all${profileIdsParam}`);
      if (response.data.success) {
        setAllTests(response.data.tests);
        const auto = {};
        Object.keys(response.data.tests).forEach((testType) => {
          const tests = response.data.tests[testType];
          if (tests && tests.length > 0) {
            const sorted = [...tests].sort((a, b) =>
              new Date(b.recordedDateUtc || b.testDate) - new Date(a.recordedDateUtc || a.testDate)
            );
            auto[testType] = sorted[0].testId || sorted[0].id;
          }
        });
        setSelected(auto);
      }
    } catch (e) {
      console.error('Error fetching tests:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleType = (key) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        const list = allTests[key] || [];
        if (list.length > 0) {
          const sorted = [...list].sort((a, b) =>
            new Date(b.recordedDateUtc || b.testDate) - new Date(a.recordedDateUtc || a.testDate)
          );
          next[key] = sorted[0].testId || sorted[0].id;
        }
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const testsToInclude = Object.entries(selected).reduce((acc, [k, v]) => {
      if (v && v !== 'SKIP') acc[k] = v;
      return acc;
    }, {});
    onConfirmSelection(testsToInclude);
  };

  const count = Object.keys(selected).length;

  if (loading) {
    return (
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '60px 32px', textAlign: 'center' }}>
        <div className="muted">Loading available tests…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '44px 32px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div className="eyebrow">Step 02 · Tests</div>
          <h1 className="h1" style={{ marginTop: 10, marginBottom: 6 }}>Assemble the report.</h1>
          <p className="muted" style={{ fontSize: 15, maxWidth: 620 }}>
            Pick one session per force-plate test. Most recent dates are preselected — deselect any test to exclude it from the report.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono muted" style={{ fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Assessing</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>{athlete.name}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {athlete.position && athlete.position !== 'N/A' ? athlete.position : '—'} ·{' '}
            {athlete.team && athlete.team !== 'N/A' ? athlete.team : '—'} ·{' '}
            <span className="mono">{athlete.id?.slice(0, 8)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {TEST_TYPES.map((t) => {
          const list = allTests[t.key] || [];
          const has = list.length > 0;
          const isOn = !!selected[t.key];

          return (
            <div
              key={t.key}
              className="surface-card"
              style={{
                padding: '18px 20px',
                opacity: has ? 1 : 0.55,
                borderColor: isOn ? 'var(--ink)' : 'var(--line)',
                transition: 'border-color .12s',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <button
                  onClick={() => has && toggleType(t.key)}
                  disabled={!has}
                  aria-pressed={isOn}
                  style={{
                    width: 22, height: 22, borderRadius: 4, marginTop: 2,
                    border: `1.5px solid ${isOn ? 'var(--ink)' : 'var(--line-2)'}`,
                    background: isOn ? 'var(--ink)' : '#fff',
                    color: 'var(--paper)',
                    display: 'grid', placeItems: 'center', flex: 'none',
                    cursor: has ? 'pointer' : 'not-allowed',
                  }}
                >
                  {isOn && <I.check />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{t.name}</div>
                    <span className="mono muted" style={{ fontSize: 11 }}>{t.short}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{t.desc}</div>

                  {has ? (
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span className="label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 600 }}>
                        Test Session · {list.length} available
                      </span>
                      <select
                        disabled={!isOn}
                        value={selected[t.key] || (list[0]?.testId || list[0]?.id || '')}
                        onChange={(e) => setSelected((s) => ({ ...s, [t.key]: e.target.value }))}
                        style={{
                          opacity: isOn ? 1 : 0.55,
                          height: 40, padding: '0 32px 0 12px',
                          background: '#fff',
                          border: '1px solid var(--line-2)', borderRadius: 4,
                          outline: 'none',
                          appearance: 'none',
                          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%237C746C' stroke-width='1.4' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 12px center',
                        }}
                      >
                        {list.map((x, idx) => {
                          const id = x.testId || x.id || `${t.key}-${idx}`;
                          const date = formatDate(x.recordedDateUtc || x.testDate || x.TestDate || x.date);
                          const limb = x.limbsAvailable ? ` (${x.limbsAvailable})` : x.limb ? ` (${x.limb} Leg)` : '';
                          return (
                            <option key={id} value={id}>{date}{limb}</option>
                          );
                        })}
                      </select>
                    </div>
                  ) : (
                    <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--paper-2)', borderRadius: 4, fontSize: 12.5, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <I.info /> No sessions on file for this athlete.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
        <button className="btn btn-ghost" onClick={onBack}><I.back /> Back to search</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            <span className="mono" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{count}</span> of 6 tests included
          </span>
          <button
            className="btn btn-primary"
            disabled={count === 0}
            onClick={handleConfirm}
            style={{ opacity: count === 0 ? 0.4 : 1 }}
          >
            Generate Report <I.arrow />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestSelection;
