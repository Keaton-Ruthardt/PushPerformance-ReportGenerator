import React from 'react';

export function tierFromPct(p) {
  if (p >= 85) return { key: 'elite', label: 'Elite' };
  if (p >= 65) return { key: 'above', label: 'Above Avg' };
  if (p >= 40) return { key: 'avg',   label: 'Average' };
  return { key: 'below', label: 'Below Avg' };
}

export function fmtNumber(v, unit) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const abs = Math.abs(v);
  const d = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  const s = Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return unit ? `${s} ${unit}` : s;
}

export function PercentileBar({ pct, compact = false }) {
  const p = Math.max(0, Math.min(100, pct ?? 0));
  const h = compact ? 8 : 10;
  const zones = [
    { w: 40, color: 'var(--below-soft)' },
    { w: 25, color: 'var(--avg-soft)' },
    { w: 20, color: 'var(--above-soft)' },
    { w: 15, color: 'var(--elite-soft)' },
  ];
  return (
    <div style={{ width: '100%' }}>
      <div style={{ position: 'relative', height: h, borderRadius: h / 2, overflow: 'hidden', display: 'flex', background: 'var(--paper-2)' }}>
        {zones.map((z, i) => (
          <div key={i} style={{ width: `${z.w}%`, background: z.color, height: '100%' }} />
        ))}
        <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'var(--ink-4)', opacity: 0.35 }} />
        {[40, 65, 85].map((x) => (
          <div key={x} style={{ position: 'absolute', left: `${x}%`, top: 0, bottom: 0, width: 1, background: 'rgba(0,0,0,0.05)' }} />
        ))}
        <div style={{ position: 'absolute', left: `${p}%`, top: -3, bottom: -3, width: 3, background: 'var(--ink)', borderRadius: 2, transform: 'translateX(-50%)' }} />
      </div>
      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9.5, color: 'var(--ink-5)', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
          <span>0</span><span>40</span><span>65</span><span>85</span><span>100</span>
        </div>
      )}
    </div>
  );
}

export function Radar({ metrics, size = 360 }) {
  const safe = (metrics || []).filter((m) => m.pct !== null && m.pct !== undefined && !isNaN(m.pct));
  const n = safe.length;
  if (n < 3) {
    return (
      <div style={{ height: size, display: 'grid', placeItems: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
        Need at least 3 metrics to render
      </div>
    );
  }
  const cx = size / 2, cy = size / 2;
  const rMax = size * 0.38;
  const rings = [20, 40, 60, 80, 100];
  const pt = (i, r) => {
    const a = (-Math.PI / 2) + (i * 2 * Math.PI / n);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const athletePath = safe.map((m, i) => {
    const [x, y] = pt(i, rMax * (m.pct / 100));
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z';
  const popPath = safe.map((m, i) => {
    const [x, y] = pt(i, rMax * 0.5);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z';

  const splitLabel = (label) => {
    if (label.length <= 14 && !label.includes('@')) return [label];
    if (label.includes('@')) {
      const [a, b] = label.split('@').map((s) => s.trim());
      return [a, '@ ' + b];
    }
    const words = label.split(' ');
    if (words.length <= 1) return [label];
    let mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  };

  const padX = 90, padY = 30, extraR = 36, extraB = 50;
  return (
    <svg viewBox={`${-padX} ${-padY} ${size + padX + extraR} ${size + padY + extraB}`} style={{ width: '100%', maxWidth: size + padX + extraR, height: 'auto' }}>
      {rings.map((r, i) => (
        <circle key={i} cx={cx} cy={cy} r={rMax * (r / 100)} fill="none"
          stroke={r === 50 ? 'var(--line-2)' : 'var(--line)'}
          strokeWidth={r === 50 ? 1 : 0.75} />
      ))}
      <circle cx={cx} cy={cy} r={rMax * 0.5} fill="none" stroke="var(--ink-4)" strokeWidth="0.6" strokeDasharray="2 3" opacity="0.5" />
      {safe.map((m, i) => {
        const [x, y] = pt(i, rMax);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth="0.75" />;
      })}
      <path d={popPath} fill="var(--avg-soft)" fillOpacity="0.7" stroke="var(--avg)" strokeWidth="1" strokeDasharray="3 3" />
      <path d={athletePath} fill="var(--ink)" fillOpacity="0.08" stroke="var(--ink)" strokeWidth="1.75" strokeLinejoin="round" />
      {safe.map((m, i) => {
        const [x, y] = pt(i, rMax * (m.pct / 100));
        const t = tierFromPct(m.pct);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={4.5} fill="#fff" stroke="var(--ink)" strokeWidth="1.25" />
            <circle cx={x} cy={y} r={2.5} fill={`var(--${t.key})`} />
          </g>
        );
      })}
      {safe.map((m, i) => {
        const [lx, ly] = pt(i, rMax + 22);
        const a = (-Math.PI / 2) + (i * 2 * Math.PI / n);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
        const lines = splitLabel(m.label);
        const lineHeight = 11;
        return (
          <g key={i}>
            {lines.map((line, j) => (
              <text key={j} x={lx} y={ly + (j - (lines.length - 1) / 2) * lineHeight} fontSize="10.5" fontWeight="600" fill="var(--ink-2)" textAnchor={anchor} dominantBaseline="middle" style={{ fontFamily: 'var(--sans)' }}>{line}</text>
            ))}
            <text x={lx} y={ly + lines.length * lineHeight - lineHeight / 2 + 4} fontSize="9.5" fill="var(--ink-4)" textAnchor={anchor} dominantBaseline="middle" style={{ fontFamily: 'var(--mono)' }}>{Math.round(m.pct)}%ile</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="2" fill="var(--ink)" />
    </svg>
  );
}

export function TierTag({ pct }) {
  if (pct === null || pct === undefined || isNaN(pct)) return null;
  const t = tierFromPct(pct);
  return <span className={`pill ${t.key}`}><span className="dot" />{t.label}</span>;
}

export function Kpi({ label, value, sub, accent }) {
  return (
    <div style={{ padding: '16px 18px', borderRight: '1px solid var(--line)', flex: 1, minWidth: 0 }}>
      <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: accent ? 'var(--accent)' : 'var(--ink)', fontFamily: 'var(--serif)' }}>{value || '—'}</div>
        {sub && <div className="muted mono" style={{ fontSize: 11 }}>{sub}</div>}
      </div>
    </div>
  );
}

function MetricRow({ m }) {
  return (
    <tr>
      <td style={{ padding: '14px 16px', fontWeight: 600, fontSize: 13, color: 'var(--ink-2)' }}>{m.label}</td>
      <td style={{ padding: '14px 16px' }} className="mono">
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{fmtNumber(m.value, m.unit)}</div>
      </td>
      <td style={{ padding: '14px 16px', minWidth: 220 }}>
        <PercentileBar pct={m.pct} compact />
      </td>
      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }} className="mono">
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{m.pct !== null && m.pct !== undefined ? Math.round(m.pct) : '—'}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>%ile</span>
      </td>
      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
        <TierTag pct={m.pct} />
      </td>
    </tr>
  );
}

export function MetricsTable({ metrics }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--line)' }}>
            {['Metric', 'Athlete', 'Distribution', 'Percentile', 'Tier'].map((h, i) => (
              <th key={i} style={{ padding: '10px 16px', textAlign: i >= 3 ? 'right' : 'left', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-4)', fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, i) => (
            <React.Fragment key={m.key || i}>
              <MetricRow m={m} />
              {i < metrics.length - 1 && <tr><td colSpan={5} style={{ borderBottom: '1px solid var(--line)' }} /></tr>}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
