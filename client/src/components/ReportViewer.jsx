import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { I } from './Shell.jsx';
import { PercentileBar, Radar, TierTag, MetricsTable } from './Viz.jsx';
import MetricSelector from './MetricSelector';

// ──────────────────────────────────────────────────────────────────────────────
// Test type metadata
// ──────────────────────────────────────────────────────────────────────────────
const TEST_DEFS = {
  cmj: {
    title: 'Countermovement Jump',
    short: 'CMJ',
    description: 'Vertical jump from a standing start with a countermovement. Captures propulsive power, eccentric braking, and reactive strategy.',
    metrics: [
      { key: 'jumpHeight',           label: 'Jump Height',           unit: 'in' },
      { key: 'rsi',                  label: 'RSI',                   unit: '' },
      { key: 'peakPowerBM',          label: 'Peak Power / BM',       unit: 'W/kg' },
      { key: 'eccentricBrakingRFD',  label: 'Ecc Braking RFD',       unit: 'N/s' },
      { key: 'concentricPeakVelocity', label: 'Con Peak Velocity',   unit: 'm/s' },
      { key: 'eccentricPeakPowerBM', label: 'Ecc Peak Power / BM',   unit: 'W/kg' },
      { key: 'forceAtZeroVelocity',  label: 'Force @ Zero Velocity', unit: 'N' },
      { key: 'eccentricPeakForce',   label: 'Ecc Peak Force',        unit: 'N' },
      { key: 'concentricImpulse',    label: 'Concentric Impulse',    unit: 'Ns' },
      { key: 'eccentricPeakVelocity', label: 'Ecc Peak Velocity',    unit: 'm/s' },
      { key: 'eccentricPeakPower',   label: 'Ecc Peak Power',        unit: 'W' },
      { key: 'peakPower',            label: 'Peak Power',            unit: 'W' },
      { key: 'countermovementDepth', label: 'Countermovement Depth', unit: 'cm' },
    ],
    defaultRadar: ['jumpHeight', 'rsi', 'peakPowerBM', 'eccentricBrakingRFD', 'concentricPeakVelocity', 'eccentricPeakPowerBM'],
  },
  squatJump: {
    title: 'Squat Jump',
    short: 'SJ',
    description: 'Concentric-only vertical jump from a paused quarter-squat. Isolates propulsive power without the stretch-shortening cycle.',
    metrics: [
      { key: 'jumpHeight',             label: 'Jump Height',          unit: 'in' },
      { key: 'forceAtPeakPower',       label: 'Force @ Peak Power',   unit: 'N' },
      { key: 'concentricPeakVelocity', label: 'Con Peak Velocity',    unit: 'm/s' },
      { key: 'peakPower',              label: 'Peak Power',           unit: 'W' },
      { key: 'peakPowerBM',            label: 'Peak Power / BW',      unit: 'W/kg' },
    ],
    defaultRadar: ['jumpHeight', 'forceAtPeakPower', 'concentricPeakVelocity', 'peakPower', 'peakPowerBM'],
  },
  imtp: {
    title: 'Isometric Mid-Thigh Pull',
    short: 'IMTP',
    description: 'Maximal isometric pull against a fixed bar at mid-thigh. Measures peak force and early-phase rate of force development.',
    metrics: [
      { key: 'peakVerticalForce', label: 'Peak Vertical Force',  unit: 'N' },
      { key: 'peakForceBM',       label: 'Peak Force / BM',       unit: 'N/kg' },
      { key: 'forceAt100ms',      label: 'Force @ 100 ms',        unit: 'N' },
      { key: 'timeToPeakForce',   label: 'Time to Peak Force',    unit: 's', invert: true },
    ],
    defaultRadar: ['peakVerticalForce', 'peakForceBM', 'forceAt100ms', 'timeToPeakForce'],
  },
  hopTest: {
    title: 'Hop Test',
    short: 'HOP',
    description: 'Repeated pogo hops measuring reactive strength (flight time / ground contact). A clean signal of stretch-shortening cycle quality.',
    metrics: [
      { key: 'rsi',         label: 'RSI',                unit: '' },
      { key: 'jumpHeight',  label: 'Jump Height',        unit: 'in' },
      { key: 'gct',         label: 'Ground Contact',     unit: 's', invert: true },
    ],
    defaultRadar: ['rsi', 'jumpHeight', 'gct'],
  },
  ppu: {
    title: 'Plyometric Push-Up',
    short: 'PPU',
    description: 'Explosive push-up off dual force plates. Quantifies upper-body force, RFD, and left/right symmetry.',
    metrics: [
      { key: 'pushupHeight',         label: 'Push-Up Height',  unit: 'in' },
      { key: 'eccentricPeakForce',   label: 'Ecc Peak Force',  unit: 'N' },
      { key: 'concentricPeakForce',  label: 'Con Peak Force',  unit: 'N' },
      { key: 'concentricRFD_L',      label: 'Con RFD (L)',     unit: 'N/s' },
      { key: 'concentricRFD_R',      label: 'Con RFD (R)',     unit: 'N/s' },
      { key: 'eccentricBrakingRFD',  label: 'Ecc Braking RFD', unit: 'N/s' },
    ],
    defaultRadar: ['pushupHeight', 'eccentricPeakForce', 'concentricPeakForce', 'concentricRFD_L', 'concentricRFD_R', 'eccentricBrakingRFD'],
  },
};

const COMP_KEY = { cmj: 'cmjComparison', squatJump: 'sjComparison', imtp: 'imtpComparison', hopTest: 'hopComparison', ppu: 'ppuComparison' };
const TESTS_KEY = { cmj: 'cmj', squatJump: 'squatJump', imtp: 'imtp', hopTest: 'hopTest', ppu: 'ppu' };

function buildMetrics(testKey, reportData) {
  const def = TEST_DEFS[testKey];
  const compKey = COMP_KEY[testKey];
  const testsKey = TESTS_KEY[testKey];
  const comp = reportData?.[compKey]?.metrics;
  const test = reportData?.tests?.[testsKey];
  if (!def || !comp || !test) return [];

  return def.metrics
    .map((m) => {
      const c = comp[m.key];
      const value = test[m.key] ?? c?.value;
      if (value === undefined || value === null || c === undefined) return null;
      return {
        key: m.key,
        label: m.label,
        value,
        pop: c.proMean ?? c.populationMean,
        pct: c.percentile,
        unit: m.unit,
        invert: m.invert || false,
      };
    })
    .filter(Boolean);
}

// ──────────────────────────────────────────────────────────────────────────────
function AthleteHeader({ athlete, info, setInfo }) {
  const initials = (athlete.name || '').split(' ').map((n) => n[0]).slice(0, 2).join('');
  return (
    <div
      className="surface-card"
      style={{ padding: '22px 26px', marginBottom: 24, borderRadius: 6, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center' }}
    >
      <div style={{ width: 72, height: 72, borderRadius: 6, background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 700, letterSpacing: '0.02em', fontFamily: 'var(--serif)' }}>
        {initials}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div className="mono muted" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Performance Assessment Report</div>
          <span className="pill" style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'transparent', height: 'auto', padding: '4px 10px', lineHeight: 1.3 }}>MLB Professional</span>
        </div>
        <div className="h1" style={{ fontSize: 32, marginBottom: 4 }}>{athlete.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--ink-3)', fontSize: 13 }}>
          {athlete.position && athlete.position !== 'N/A' && <><span><b>{athlete.position}</b></span><span style={{ color: 'var(--line-2)' }}>·</span></>}
          {athlete.team && athlete.team !== 'N/A' && <span>{athlete.team}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', borderLeft: '1px solid var(--line)' }}>
        <KpiInput label="Age"    value={info.age}    onChange={(v) => setInfo({ ...info, age: v })} placeholder="—" />
        <KpiInput label="Height" value={info.height} onChange={(v) => setInfo({ ...info, height: v })} placeholder="—" />
        <KpiInput label="Weight" value={info.weight} onChange={(v) => setInfo({ ...info, weight: v })} placeholder="—" />
      </div>
    </div>
  );
}

function KpiInput({ label, value, onChange, placeholder }) {
  return (
    <div style={{ padding: '16px 18px', borderRight: '1px solid var(--line)', flex: 1, minWidth: 0 }}>
      <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          marginTop: 4, fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 700,
          letterSpacing: '-0.02em', color: 'var(--ink)', background: 'transparent',
          border: 'none', outline: 'none', width: '100%',
        }}
      />
    </div>
  );
}

function ReportTabs({ tabs, active, setActive }) {
  return (
    <div style={{ borderBottom: '1px solid var(--line)', marginBottom: 28, position: 'relative' }}>
      <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
        {tabs.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              style={{
                position: 'relative', padding: '14px 18px', border: 0, background: 'transparent',
                fontSize: 13, fontWeight: 600, letterSpacing: '0.005em', whiteSpace: 'nowrap',
                color: on ? 'var(--ink)' : 'var(--ink-4)', cursor: 'pointer',
                borderBottom: on ? '2px solid var(--ink)' : '2px solid transparent', marginBottom: -1,
              }}
            >
              <span className="mono" style={{ fontSize: 10.5, color: on ? 'var(--accent)' : 'var(--ink-5)', marginRight: 8, letterSpacing: '0.05em' }}>
                {String(t.idx).padStart(2, '0')}
              </span>
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RecTextarea({ value, onChange, placeholder }) {
  return (
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={6}
      style={{
        width: '100%', padding: '10px 12px', background: '#fff',
        border: '1px solid var(--line-2)', borderRadius: 4,
        outline: 'none', resize: 'vertical', lineHeight: 1.5,
        fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)',
      }}
    />
  );
}

function CompositeStrip({ metrics }) {
  if (!metrics || metrics.length === 0) return null;
  const validPcts = metrics.map((m) => m.pct).filter((p) => p !== null && p !== undefined && !isNaN(p));
  if (validPcts.length === 0) return null;
  const composite = Math.round(validPcts.reduce((a, b) => a + b, 0) / validPcts.length);
  const eliteCount = metrics.filter((m) => m.pct >= 85).length;
  const belowCount = metrics.filter((m) => m.pct < 40).length;

  return (
    <div className="surface-card" style={{ padding: '18px 22px', marginBottom: 24, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 28, alignItems: 'center' }}>
      <div>
        <div className="mono muted" style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Composite Score</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>{composite}</div>
          <div className="muted mono" style={{ fontSize: 12 }}>%ile</div>
          <TierTag pct={composite} />
        </div>
      </div>
      <div style={{ paddingLeft: 28, borderLeft: '1px solid var(--line)' }}>
        <div className="mono muted" style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Distribution vs Population</div>
        <PercentileBar pct={composite} />
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        <div>
          <div className="mono muted" style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Elite Metrics</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 4 }}>
            {eliteCount}<span className="muted mono" style={{ fontSize: 12, marginLeft: 4 }}>/ {metrics.length}</span>
          </div>
        </div>
        <div>
          <div className="mono muted" style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Below Avg</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 4, color: belowCount > 0 ? 'var(--below)' : 'var(--ink)' }}>
            {belowCount}<span className="muted mono" style={{ fontSize: 12, marginLeft: 4 }}>/ {metrics.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TestTab({ testKey, reportData, recs, setRecs, selectedRadarKeys, setSelectedRadarKeys }) {
  const def = TEST_DEFS[testKey];
  const metrics = useMemo(() => buildMetrics(testKey, reportData), [testKey, reportData]);
  const date = reportData?.[COMP_KEY[testKey]]?.testDate || reportData?.tests?.[TESTS_KEY[testKey]]?.testDate;
  const radarMetrics = metrics.filter((m) => selectedRadarKeys.includes(m.key));

  if (!metrics || metrics.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Test · {def.short}</div>
          <div className="h2">{def.title}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4, maxWidth: 560 }}>{def.description}</div>
        </div>
        <div className="surface-card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-4)' }}>
          No comparative data available for this test (insufficient population sample).
        </div>
      </div>
    );
  }

  const availableMetricsForSelector = def.metrics.map((m) => ({
    key: m.key,
    label: m.label,
    available: metrics.some((mm) => mm.key === m.key),
  }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Test · {def.short}</div>
          <div className="h2">{def.title}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4, maxWidth: 560 }}>{def.description}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {date && <span className="pill ghost"><span className="mono">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</span></span>}
        </div>
      </div>

      <CompositeStrip metrics={metrics} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 24, marginBottom: 28, alignItems: 'stretch' }}>
        <div>
          <div className="h3" style={{ marginBottom: 10, color: 'var(--ink-3)' }}>Detailed Metrics</div>
          <MetricsTable metrics={metrics} />
        </div>
        <div>
          <div className="h3" style={{ marginBottom: 10, color: 'var(--ink-3)' }}>Athlete vs Population</div>
          <div className="surface-card" style={{ padding: '18px 18px 10px', height: 'calc(100% - 28px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 14, fontSize: 11.5, fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: 'var(--ink)', borderRadius: 2 }} />Athlete</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: 'var(--avg-soft)', border: '1px dashed var(--avg)', borderRadius: 2 }} />Pop. Avg (50)</span>
              </div>
              <span className="mono muted" style={{ fontSize: 10.5 }}>SCALE · 0–100 %ILE</span>
            </div>
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '4px 0' }}>
              <Radar metrics={radarMetrics} size={380} />
            </div>
            <div style={{ marginTop: 8 }}>
              <MetricSelector
                testType={testKey}
                availableMetrics={availableMetricsForSelector.filter((m) => m.available)}
                selectedMetrics={selectedRadarKeys}
                onMetricsChange={setSelectedRadarKeys}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="h3" style={{ color: 'var(--ink-3)' }}>Trainer Recommendations</div>
        </div>
        <RecTextarea
          value={recs}
          onChange={setRecs}
          placeholder={`Prescribe training focus for ${def.short}: exercises, volume, progression, reassessment window…`}
        />
      </div>
    </div>
  );
}

function SingleLegTab({ reportData, recs, setRecs }) {
  const left = reportData?.tests?.singleLegCMJ_Left;
  const right = reportData?.tests?.singleLegCMJ_Right;

  const calcAsymmetry = (l, r) => {
    if (!l || !r || l === 0 || r === 0) return null;
    return Math.abs(l - r) / ((l + r) / 2) * 100;
  };

  const rows = [
    { label: 'Jump Height (in)',          l: left?.jumpHeight,          r: right?.jumpHeight,          decimals: 2 },
    { label: 'Peak Power / BM (W/kg)',    l: left?.peakPowerBM,         r: right?.peakPowerBM,         decimals: 1 },
    { label: 'Concentric Peak Force (N)', l: left?.concentricPeakForce, r: right?.concentricPeakForce, decimals: 0 },
    { label: 'Eccentric Peak Force (N)',  l: left?.eccentricPeakForce,  r: right?.eccentricPeakForce,  decimals: 0 },
    { label: 'Eccentric Braking RFD (N/s)', l: left?.eccentricBrakingRFD, r: right?.eccentricBrakingRFD, decimals: 0 },
    { label: 'RSI',                       l: left?.rsi,                 r: right?.rsi,                 decimals: 2 },
  ].map((row) => ({ ...row, asy: calcAsymmetry(row.l, row.r) }));

  const asyColor = (a) => a === null ? 'var(--ink-4)' : a <= 5 ? 'var(--elite)' : a <= 10 ? 'var(--avg)' : 'var(--below)';

  if (!left && !right) {
    return (
      <div>
        <div style={{ marginBottom: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Test · SL CMJ</div>
          <div className="h2">Single Leg CMJ — Symmetry</div>
        </div>
        <div className="surface-card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-4)' }}>
          No single-leg CMJ data available for this athlete.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Test · SL CMJ</div>
        <div className="h2">Single Leg CMJ — Symmetry</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4, maxWidth: 560 }}>
          Unilateral jump testing to quantify L/R asymmetry. Targets are &lt;5% for each metric.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        {rows.map((r) => {
          const hasData = (r.l !== null && r.l !== undefined) || (r.r !== null && r.r !== undefined);
          return (
            <div key={r.label} className="surface-card" style={{ padding: '18px 20px', opacity: hasData ? 1 : 0.55 }}>
              <div className="mono muted" style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 12 }}>{r.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono muted" style={{ fontSize: 10.5, fontWeight: 600 }}>LEFT</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)' }}>{r.l !== null && r.l !== undefined ? Number(r.l).toFixed(r.decimals) : '—'}</div>
                </div>
                <div style={{ width: 1, height: 36, background: 'var(--line)' }} />
                <div>
                  <div className="mono muted" style={{ fontSize: 10.5, fontWeight: 600 }}>RIGHT</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)' }}>{r.r !== null && r.r !== undefined ? Number(r.r).toFixed(r.decimals) : '—'}</div>
                </div>
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="muted" style={{ fontSize: 11.5 }}>Asymmetry</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: asyColor(r.asy) }}>
                  {r.asy !== null ? `${r.asy.toFixed(1)}%` : '—'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="h3" style={{ color: 'var(--ink-3)', marginBottom: 10 }}>Trainer Recommendations</div>
      <RecTextarea value={recs} onChange={setRecs} placeholder="Address asymmetries and unilateral output…" />
    </div>
  );
}

function InitialAssessmentTab({ assessment, setAssessment }) {
  const fields = [
    { key: 'currentInjuries',    label: 'Current Injuries',           placeholder: 'Active injuries, pain points, or movement restrictions to be aware of…' },
    { key: 'injuryHistory',      label: 'Injury History',             placeholder: 'Prior surgeries, recurring injuries, or chronic issues…' },
    { key: 'posturePresentation',label: 'Posture Presentation',       placeholder: 'Static posture findings: pelvic tilt, shoulder position, foot strike, etc.' },
    { key: 'movementAnalysis',   label: 'Movement Analysis Summary',  placeholder: 'Observations from movement screen: deficits, compensations, asymmetries…' },
  ];
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Intake</div>
        <div className="h2">Initial Assessment</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4, maxWidth: 640 }}>
          Trainer notes on injury status, posture, and movement quality. Flows into the report PDF.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 600, marginBottom: 6 }}>{f.label}</div>
            <RecTextarea
              value={assessment[f.key]}
              onChange={(v) => setAssessment({ ...assessment, [f.key]: v })}
              placeholder={f.placeholder}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TrainingPlanTab({ goals, setGoals, allComposites, focusKeys, setFocusKeys }) {
  const keys = focusKeys || [];
  const toggleFocus = (key) => {
    setFocusKeys(keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);
  };
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Action Plan</div>
        <div className="h2">Training Goals & Prescription</div>
      </div>
      <div className="surface-card" style={{ padding: '20px 22px', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, gap: 12 }}>
          <div className="h3" style={{ color: 'var(--ink-3)' }}>Focus Areas</div>
          <span className="pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', borderColor: 'transparent' }}>
            <span className="dot" />Customizable
          </span>
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
          Select which tests to feature as focus areas on the report. The weakest tests are preselected — toggle any test to include or exclude it.
        </div>
        {allComposites.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {allComposites.map((f) => {
              const on = keys.includes(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => toggleFocus(f.key)}
                  aria-pressed={on}
                  style={{
                    display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center',
                    padding: '12px 14px', borderRadius: 4, textAlign: 'left', width: '100%', cursor: 'pointer',
                    border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                    background: on ? 'var(--paper-2)' : '#fff',
                    transition: 'border-color .12s, background .12s',
                  }}
                >
                  <span style={{
                    width: 20, height: 20, borderRadius: 4, flex: 'none',
                    border: `1.5px solid ${on ? 'var(--ink)' : 'var(--line-2)'}`,
                    background: on ? 'var(--ink)' : '#fff', color: 'var(--paper)',
                    display: 'grid', placeItems: 'center',
                  }}>
                    {on && <I.check />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{f.label}</div>
                    <PercentileBar pct={f.pct} compact />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{Math.round(f.pct)}<span className="muted" style={{ fontSize: 10 }}>%ile</span></div>
                    <TierTag pct={f.pct} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 13 }}>No test composites available to feature.</div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 600, marginBottom: 6 }}>Goals</div>
          <RecTextarea value={goals.goals} onChange={(v) => setGoals({ ...goals, goals: v })} placeholder="Concrete, measurable outcomes…" />
        </div>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', fontWeight: 600, marginBottom: 6 }}>Action Plan</div>
          <RecTextarea value={goals.actionPlan} onChange={(v) => setGoals({ ...goals, actionPlan: v })} placeholder="Weekly structure, key sessions, reassessment date…" />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
const ReportViewer = ({ athlete, selectedTests, onBack }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('assessment');

  const [info, setInfo] = useState({ age: '', height: '', weight: '' });
  const [assessment, setAssessment] = useState({ currentInjuries: '', injuryHistory: '', posturePresentation: '', movementAnalysis: '' });
  const [recs, setRecs] = useState({ cmj: '', sj: '', imtp: '', hop: '', slcmj: '', ppu: '' });
  const [goals, setGoals] = useState({ goals: '', actionPlan: '' });
  const [focusKeys, setFocusKeys] = useState(null); // null = not yet initialized; array once composites load

  const [selectedRadarKeys, setSelectedRadarKeys] = useState({
    cmj: TEST_DEFS.cmj.defaultRadar,
    squatJump: TEST_DEFS.squatJump.defaultRadar,
    imtp: TEST_DEFS.imtp.defaultRadar,
    hopTest: TEST_DEFS.hopTest.defaultRadar,
    ppu: TEST_DEFS.ppu.defaultRadar,
  });

  useEffect(() => { if (athlete) fetchReportData(); }, [athlete, selectedTests]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/reports/generate', {
        athleteId: athlete.id,
        profileIds: athlete.profileIds || [athlete.id],
        name: athlete.name,
        position: athlete.position,
        selectedTests: selectedTests || {},
      });
      setReportData(response.data.data);

      const data = response.data.data;
      const weight = data?.tests?.cmj?.weight || data?.tests?.imtp?.weight;
      let age = '';
      if (athlete?.dateOfBirth) {
        try {
          const birthDate = new Date(athlete.dateOfBirth);
          const today = new Date();
          const calculatedAge = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
          if (calculatedAge > 0 && calculatedAge < 120) age = String(calculatedAge);
        } catch (e) { /* ignore */ }
      }
      setInfo({ age, height: '', weight: weight ? `${Math.round(weight * 2.20462)} lbs` : '' });
    } catch (e) {
      console.error('Error fetching report:', e);
    } finally {
      setLoading(false);
    }
  };

  const compositesByTest = useMemo(() => {
    if (!reportData) return {};
    const out = {};
    ['cmj', 'squatJump', 'imtp', 'hopTest', 'ppu'].forEach((k) => {
      const m = buildMetrics(k, reportData);
      const valid = m.map((x) => x.pct).filter((p) => p !== null && p !== undefined && !isNaN(p));
      if (valid.length > 0) out[k] = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
    });
    return out;
  }, [reportData]);

  // All test composites, sorted weakest-first (candidates for focus areas)
  const allComposites = useMemo(() => {
    return Object.entries(compositesByTest)
      .map(([k, pct]) => ({ label: TEST_DEFS[k].title, pct, key: k }))
      .sort((a, b) => a.pct - b.pct);
  }, [compositesByTest]);

  // Default focus-area selection = the 4 weakest tests. Only set once, when composites first load.
  useEffect(() => {
    if (focusKeys === null && allComposites.length > 0) {
      setFocusKeys(allComposites.slice(0, 4).map((c) => c.key));
    }
  }, [allComposites, focusKeys]);

  const selectedFocusAreas = useMemo(() => {
    if (!focusKeys) return [];
    return allComposites.filter((c) => focusKeys.includes(c.key));
  }, [allComposites, focusKeys]);

  const tabs = useMemo(() => {
    if (!reportData) return [{ id: 'assessment', idx: 1, label: 'Assessment' }];
    const list = [{ id: 'assessment', label: 'Assessment' }];
    if (reportData.tests?.cmj)            list.push({ id: 'cmj',    label: 'CMJ' });
    if (reportData.tests?.squatJump)      list.push({ id: 'sj',     label: 'Squat Jump' });
    if (reportData.tests?.imtp)           list.push({ id: 'imtp',   label: 'IMTP' });
    if (reportData.tests?.hopTest)        list.push({ id: 'hop',    label: 'Hop Test' });
    if (reportData.tests?.singleLegCMJ_Left || reportData.tests?.singleLegCMJ_Right) list.push({ id: 'slcmj', label: 'Single Leg CMJ' });
    if (reportData.tests?.ppu)            list.push({ id: 'ppu',    label: 'Plyometric Push-Up' });
    list.push({ id: 'plan', label: 'Training Plan' });
    return list.map((t, i) => ({ ...t, idx: i + 1 }));
  }, [reportData]);

  useEffect(() => {
    if (reportData && !tabs.some((t) => t.id === activeTab)) setActiveTab(tabs[0]?.id || 'assessment');
  }, [reportData, tabs, activeTab]);

  const generatePDF = async () => {
    setSaving(true);
    setGeneratingProgress(0);
    try {
      const reportPayload = {
        ...reportData,
        athleteInfo: info,
        initialAssessment: assessment,
        cmjRecommendations: recs.cmj,
        sjRecommendations: recs.sj,
        hopRecommendations: recs.hop,
        imtpRecommendations: recs.imtp,
        slCmjRecommendations: recs.slcmj,
        ppuRecommendations: recs.ppu,
        trainingGoals: goals,
        selectedFocusKeys: focusKeys || [],
        selectedFocusAreas,
        selectedMetrics: {
          cmj: selectedRadarKeys.cmj,
          squatJump: selectedRadarKeys.squatJump,
          imtp: selectedRadarKeys.imtp,
          hopTest: selectedRadarKeys.hopTest,
          ppu: selectedRadarKeys.ppu,
        },
      };

      const progressInterval = setInterval(() => {
        setGeneratingProgress((p) => (p >= 90 ? p : p + 3));
      }, 2000);

      const response = await axios.post('/api/reports/generate-pdf', reportPayload, { responseType: 'blob' });
      clearInterval(progressInterval);
      setGeneratingProgress(100);

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${athlete.name.replace(' ', '_')}_report_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error('Error generating PDF:', e);
      alert('Error generating PDF. Please try again.');
    } finally {
      setSaving(false);
      setGeneratingProgress(0);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '60px 32px', textAlign: 'center' }}>
        <div className="muted">Generating report…</div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '60px 32px', textAlign: 'center' }}>
        <div className="muted">Unable to load report.</div>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'assessment': return <InitialAssessmentTab assessment={assessment} setAssessment={setAssessment} />;
      case 'cmj': return <TestTab testKey="cmj" reportData={reportData} recs={recs.cmj} setRecs={(v) => setRecs({ ...recs, cmj: v })}
        selectedRadarKeys={selectedRadarKeys.cmj} setSelectedRadarKeys={(k) => setSelectedRadarKeys({ ...selectedRadarKeys, cmj: k })} />;
      case 'sj': return <TestTab testKey="squatJump" reportData={reportData} recs={recs.sj} setRecs={(v) => setRecs({ ...recs, sj: v })}
        selectedRadarKeys={selectedRadarKeys.squatJump} setSelectedRadarKeys={(k) => setSelectedRadarKeys({ ...selectedRadarKeys, squatJump: k })} />;
      case 'imtp': return <TestTab testKey="imtp" reportData={reportData} recs={recs.imtp} setRecs={(v) => setRecs({ ...recs, imtp: v })}
        selectedRadarKeys={selectedRadarKeys.imtp} setSelectedRadarKeys={(k) => setSelectedRadarKeys({ ...selectedRadarKeys, imtp: k })} />;
      case 'hop': return <TestTab testKey="hopTest" reportData={reportData} recs={recs.hop} setRecs={(v) => setRecs({ ...recs, hop: v })}
        selectedRadarKeys={selectedRadarKeys.hopTest} setSelectedRadarKeys={(k) => setSelectedRadarKeys({ ...selectedRadarKeys, hopTest: k })} />;
      case 'ppu': return <TestTab testKey="ppu" reportData={reportData} recs={recs.ppu} setRecs={(v) => setRecs({ ...recs, ppu: v })}
        selectedRadarKeys={selectedRadarKeys.ppu} setSelectedRadarKeys={(k) => setSelectedRadarKeys({ ...selectedRadarKeys, ppu: k })} />;
      case 'slcmj': return <SingleLegTab reportData={reportData} recs={recs.slcmj} setRecs={(v) => setRecs({ ...recs, slcmj: v })} />;
      case 'plan': return <TrainingPlanTab goals={goals} setGoals={setGoals} allComposites={allComposites} focusKeys={focusKeys} setFocusKeys={setFocusKeys} />;
      default: return null;
    }
  };

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', padding: '32px 32px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}><I.back /> Back</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-accent"
            onClick={generatePDF}
            disabled={saving}
          >
            {saving ? `Generating… ${generatingProgress}%` : 'Export PDF'}
          </button>
        </div>
      </div>

      <AthleteHeader athlete={athlete} info={info} setInfo={setInfo} />
      <ReportTabs tabs={tabs} active={activeTab} setActive={setActiveTab} />
      {renderTab()}
    </div>
  );
};

export default ReportViewer;
