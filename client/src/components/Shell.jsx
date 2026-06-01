import React from 'react';

export const I = {
  search: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  arrow: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  back: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 12H5M11 6l-6 6 6 6"/></svg>,
  check: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 4 4 10-10"/></svg>,
  plus: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  sliders: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" {...p}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>,
  info: (p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/></svg>,
};

export function Topbar({ crumbs = [], athlete }) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src="/push-performance-logo.png" alt="Push" className="brand-mark-img" />
        <div className="brand-sep" />
        <div className="brand-sub">Performance Assessment</div>
      </div>
      {crumbs.length > 0 && (
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-4)', fontSize: 12.5, marginLeft: 12 }}>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: 'var(--ink-5)' }}>/</span>}
              <span style={{ color: i === crumbs.length - 1 ? 'var(--ink-2)' : 'var(--ink-4)', fontWeight: i === crumbs.length - 1 ? 600 : 500 }}>{c}</span>
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="topbar-right">
        {athlete && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 14, borderRight: '1px solid var(--line)' }}>
            <span className="pill ghost"><span className="mono">{athlete.id?.slice(0, 8)}</span></span>
            <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{athlete.name}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="avatar">PT</div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontWeight: 600, color: 'var(--ink-2)', fontSize: 12.5 }}>Push Trainer</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>Performance Staff</div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function Stepper({ current }) {
  const steps = [
    { label: 'Select Athlete' },
    { label: 'Choose Tests' },
    { label: 'Review & Export' },
  ];
  return (
    <div className="stepper">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : '';
        return (
          <React.Fragment key={i}>
            <div className={`step ${state}`}>
              <div className="num">{i < current ? '✓' : (i + 1).toString().padStart(2, '0').slice(-1)}</div>
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={`step-line ${i < current ? 'done' : ''}`} />}
          </React.Fragment>
        );
      })}
      <div style={{ marginLeft: 32, paddingLeft: 24, borderLeft: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-4)', fontSize: 12 }}>
        <span className="mono">SESSION · {new Date().toISOString().slice(0, 10)}</span>
      </div>
    </div>
  );
}
