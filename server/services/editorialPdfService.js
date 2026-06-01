import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Per-tenant logo cache (data URLs keyed by tenant.slug). Populated lazily on first render.
const TENANT_LOGO_CACHE = new Map();

// Per-render branding context. Mutated at the start of generateEditorialPdf and read by
// the page-render template literals via lexical scope. Safe across concurrent renders
// ONLY because generateEditorialPdf captures the rendered HTML (and footerTemplate) into
// local strings synchronously — before any await — so a later request's mutation cannot
// leak into an earlier request's captured output.
let currentLogoImg = '';
let currentFacilityName = '';

function buildLogoImg(tenant) {
  const fallback = `<div class="brand-logo" style="font-family:Arial,sans-serif;font-weight:900;font-size:14px;letter-spacing:0.06em;">${escapeHtml((tenant.facilityName || 'PERFORMANCE').toUpperCase())}</div>`;

  if (TENANT_LOGO_CACHE.has(tenant.slug)) {
    const cached = TENANT_LOGO_CACHE.get(tenant.slug);
    return cached
      ? `<img class="brand-logo" src="${cached}" alt="${escapeHtml(tenant.facilityName)}" />`
      : fallback;
  }

  try {
    const absLogoPath = path.resolve(__dirname, '..', '..', tenant.logoPath);
    const logoBuffer = fs.readFileSync(absLogoPath);
    const dataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    TENANT_LOGO_CACHE.set(tenant.slug, dataUrl);
    return `<img class="brand-logo" src="${dataUrl}" alt="${escapeHtml(tenant.facilityName)}" />`;
  } catch (err) {
    console.warn(`⚠️  Logo not found for tenant "${tenant.slug}" at ${tenant.logoPath} — falling back to text:`, err.message);
    TENANT_LOGO_CACHE.set(tenant.slug, null);
    return fallback;
  }
}

const TIER_LABELS = {
  pro: 'MLB Professional',
  college: 'College',
  high_school: 'High School',
  youth: 'Youth',
};

// ──────────────────────────────────────────────────────────────────────────────
// Test definitions (mirror client/src/components/ReportViewer.jsx)
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
    ],
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
  },
  imtp: {
    title: 'Isometric Mid-Thigh Pull',
    short: 'IMTP',
    description: 'Maximal isometric pull against a fixed bar at mid-thigh. Measures peak force and early-phase rate of force development.',
    metrics: [
      { key: 'peakVerticalForce', label: 'Peak Vertical Force', unit: 'N' },
      { key: 'peakForceBM',       label: 'Peak Force / BM',     unit: 'N/kg' },
      { key: 'forceAt100ms',      label: 'Force @ 100 ms',      unit: 'N' },
      { key: 'timeToPeakForce',   label: 'Time to Peak Force',  unit: 's', invert: true },
    ],
  },
  hopTest: {
    title: 'Hop Test',
    short: 'HOP',
    description: 'Repeated pogo hops measuring reactive strength (flight time / ground contact). A clean signal of stretch-shortening cycle quality.',
    metrics: [
      { key: 'rsi',         label: 'RSI',            unit: '' },
      { key: 'jumpHeight',  label: 'Jump Height',    unit: 'in' },
      { key: 'gct',         label: 'Ground Contact', unit: 's', invert: true },
    ],
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
  },
};

const COMP_KEY = { cmj: 'cmjComparison', squatJump: 'sjComparison', imtp: 'imtpComparison', hopTest: 'hopComparison', ppu: 'ppuComparison' };
const TESTS_KEY = { cmj: 'cmj', squatJump: 'squatJump', imtp: 'imtp', hopTest: 'hopTest', ppu: 'ppu' };

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function tierFromPct(p) {
  if (p === null || p === undefined || isNaN(p)) return null;
  if (p >= 85) return { key: 'elite', label: 'Elite' };
  if (p >= 65) return { key: 'above', label: 'Above Avg' };
  if (p >= 40) return { key: 'avg',   label: 'Average' };
  return { key: 'below', label: 'Below Avg' };
}

function fmtNumber(v, unit) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const abs = Math.abs(v);
  const d = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  const s = Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return unit ? `${s} ${unit}` : s;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

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

function getComposite(metrics) {
  const valid = metrics.map((m) => m.pct).filter((p) => p !== null && p !== undefined && !isNaN(p));
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

// ──────────────────────────────────────────────────────────────────────────────
// HTML pieces
// ──────────────────────────────────────────────────────────────────────────────
function renderPctBar(pct, withScale = false) {
  const p = Math.max(0, Math.min(100, pct ?? 0));
  return `
    <div class="pct-bar">
      <div class="zone z-below" style="width:40%"></div>
      <div class="zone z-avg"   style="width:25%"></div>
      <div class="zone z-above" style="width:20%"></div>
      <div class="zone z-elite" style="width:15%"></div>
      <div class="mid"></div>
      <div class="marker" style="left:${p}%"></div>
    </div>
    ${withScale ? `<div class="pct-bar-scale"><span>0</span><span>40</span><span>65</span><span>85</span><span>100</span></div>` : ''}
  `;
}

function renderTierPill(pct) {
  const t = tierFromPct(pct);
  if (!t) return '';
  return `<span class="pill ${t.key}"><span class="dot"></span>${t.label}</span>`;
}

function renderRadar(metrics, size = 380) {
  const safe = (metrics || []).filter((m) => m.pct !== null && m.pct !== undefined && !isNaN(m.pct));
  const n = safe.length;
  if (n < 3) return `<div style="height:${size}px;display:grid;place-items:center;color:var(--ink-4);font-size:9pt;">Not enough data for radar</div>`;
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

  const ringEls = rings.map((r) => `
    <circle cx="${cx}" cy="${cy}" r="${rMax * (r / 100)}" fill="none"
      stroke="${r === 50 ? 'var(--line-2)' : 'var(--line)'}"
      stroke-width="${r === 50 ? 1 : 0.75}" />
  `).join('');

  const spokes = safe.map((m, i) => {
    const [x, y] = pt(i, rMax);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)" stroke-width="0.75" />`;
  }).join('');

  const points = safe.map((m, i) => {
    const [x, y] = pt(i, rMax * (m.pct / 100));
    const t = tierFromPct(m.pct);
    return `
      <circle cx="${x}" cy="${y}" r="4.5" fill="#fff" stroke="var(--ink)" stroke-width="1.25" />
      <circle cx="${x}" cy="${y}" r="2.5" fill="var(--${t.key})" />
    `;
  }).join('');

  const splitLabel = (label) => {
    if (label.length <= 14) return [label];
    if (label.includes(' @ ')) {
      const [a, b] = label.split(' @ ');
      return [a, '@ ' + b];
    }
    const words = label.split(' ');
    if (words.length === 1) return [label];
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  };

  const labels = safe.map((m, i) => {
    const [lx, ly] = pt(i, rMax + 26);
    const a = (-Math.PI / 2) + (i * 2 * Math.PI / n);
    const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
    const lines = splitLabel(m.label);
    const labelTspans = lines.map((ln, idx) =>
      `<tspan x="${lx}" dy="${idx === 0 ? 0 : 14}">${escapeHtml(ln)}</tspan>`
    ).join('');
    const pctY = ly + (lines.length * 14);
    return `
      <text x="${lx}" y="${ly}" font-size="12" font-weight="600" fill="var(--ink-2)" text-anchor="${anchor}" dominant-baseline="middle" style="font-family:var(--sans);">${labelTspans}</text>
      <text x="${lx}" y="${pctY}" font-size="10" fill="var(--ink-4)" text-anchor="${anchor}" dominant-baseline="middle" style="font-family:var(--mono);">${Math.round(m.pct)}%ile</text>
    `;
  }).join('');

  return `
    <svg viewBox="-80 -30 ${size + 160} ${size + 70}" style="width:100%;height:auto;">
      ${ringEls}
      <circle cx="${cx}" cy="${cy}" r="${rMax * 0.5}" fill="none" stroke="var(--ink-4)" stroke-width="0.6" stroke-dasharray="2 3" opacity="0.5" />
      ${spokes}
      <path d="${popPath}" fill="var(--avg-soft)" fill-opacity="0.7" stroke="var(--avg)" stroke-width="1" stroke-dasharray="3 3" />
      <path d="${athletePath}" fill="var(--ink)" fill-opacity="0.08" stroke="var(--ink)" stroke-width="1.75" stroke-linejoin="round" />
      ${points}
      ${labels}
      <circle cx="${cx}" cy="${cy}" r="2" fill="var(--ink)" />
    </svg>
  `;
}

function renderSnapshotRadar(composites) {
  // composites: [{ key, label, short, pct }]
  const valid = composites.filter((c) => c.pct !== null && c.pct !== undefined);
  const n = valid.length;
  if (n < 3) return '';
  const size = 380;
  const cx = size / 2, cy = size / 2;
  const rMax = size * 0.42;
  const pt = (i, r) => {
    const a = (-Math.PI / 2) + (i * 2 * Math.PI / n);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const athletePath = valid.map((c, i) => {
    const [x, y] = pt(i, rMax * (c.pct / 100));
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z';
  const popR = rMax * 0.5;

  const rings = [0.2, 0.4, 0.6, 0.8, 1].map((f) => `
    <circle cx="${cx}" cy="${cy}" r="${rMax * f}" fill="none" stroke="var(--line)" stroke-width="0.75" />
  `).join('');

  const spokes = valid.map((c, i) => {
    const [x, y] = pt(i, rMax);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)" stroke-width="0.75" />`;
  }).join('');

  const points = valid.map((c, i) => {
    const [x, y] = pt(i, rMax * (c.pct / 100));
    const t = tierFromPct(c.pct);
    return `
      <circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="var(--ink)" stroke-width="1.4" />
      <circle cx="${x}" cy="${y}" r="3" fill="var(--${t.key})" />
    `;
  }).join('');

  const labels = valid.map((c, i) => {
    const [lx, ly] = pt(i, rMax + 28);
    const a = (-Math.PI / 2) + (i * 2 * Math.PI / n);
    const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
    return `
      <text x="${lx}" y="${ly}" font-size="14" font-weight="700" fill="var(--ink-2)" text-anchor="${anchor}" dominant-baseline="middle" style="font-family:var(--sans);letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(c.short)}</text>
      <text x="${lx}" y="${ly + 16}" font-size="12" fill="var(--ink-3)" text-anchor="${anchor}" dominant-baseline="middle" style="font-family:var(--mono);font-weight:600;">${c.pct}</text>
    `;
  }).join('');

  return `
    <svg viewBox="-70 -30 ${size + 140} ${size + 70}" style="width:100%;height:auto;">
      ${rings}
      <circle cx="${cx}" cy="${cy}" r="${popR}" fill="var(--avg-soft)" fill-opacity="0.55" stroke="var(--avg)" stroke-width="1" stroke-dasharray="3 3" />
      ${spokes}
      <path d="${athletePath}" fill="var(--ink)" fill-opacity="0.08" stroke="var(--ink)" stroke-width="1.75" stroke-linejoin="round" />
      ${points}
      ${labels}
      <circle cx="${cx}" cy="${cy}" r="2" fill="var(--ink)" />
    </svg>
  `;
}

function renderMetricsTable(metrics) {
  const rows = metrics.map((m) => {
    return `
      <tr>
        <td class="m-name">${escapeHtml(m.label)}</td>
        <td class="m-val">${escapeHtml(fmtNumber(m.value, m.unit))}</td>
        <td class="m-pct">${m.pct !== null && m.pct !== undefined ? Math.round(m.pct) : '—'}<span class="u">%ile</span></td>
        <td class="m-tier">${renderTierPill(m.pct)}</td>
      </tr>
    `;
  }).join('');
  return `
    <table class="metrics">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Athlete</th>
          <th class="right">Percentile</th>
          <th class="right">Tier</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderRecs(html, label) {
  if (!html || !html.trim()) return '';
  const paragraphs = html.split('\n').filter((p) => p.trim()).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
  return `
    <div class="recs keep">
      <div class="h3" style="margin-bottom:8px;">Trainer Recommendations${label ? ` — ${escapeHtml(label)}` : ''}</div>
      ${paragraphs}
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────────────────────
// Cover page
// ──────────────────────────────────────────────────────────────────────────────
function renderCoverPage(reportData, athleteName, tier, composites, overallComposite) {
  const tierLabel = TIER_LABELS[tier] || 'Athlete';
  const id = reportData.athleteId || reportData.athleteIdShort || '—';
  const idShort = id.toString().slice(0, 12);
  const info = reportData.athleteInfo || {};
  const today = new Date();
  const issuedDate = today.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const testCount = composites.length;
  const overallTier = tierFromPct(overallComposite);

  // Cover headline split: first / last name
  const nameParts = (athleteName || '').split(' ');
  const firstName = nameParts[0] || athleteName;
  const lastName = nameParts.slice(1).join(' ');

  // Build cover sonar paths from real composites (up to 6)
  const coverSonarSize = 600;
  const coverSonarRMax = 295;
  const sonarComposites = composites.slice(0, Math.max(3, composites.length));
  const sn = sonarComposites.length;
  let sonarAthletePath = '';
  let sonarPoints = '';
  if (sn >= 3) {
    sonarAthletePath = sonarComposites.map((c, i) => {
      const a = (-Math.PI / 2) + (i * 2 * Math.PI / sn);
      const r = coverSonarRMax * ((c.pct ?? 0) / 100);
      const x = coverSonarSize / 2 + r * Math.cos(a);
      const y = coverSonarSize / 2 + r * Math.sin(a);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ') + ' Z';
    sonarPoints = sonarComposites.map((c, i) => {
      const a = (-Math.PI / 2) + (i * 2 * Math.PI / sn);
      const r = coverSonarRMax * ((c.pct ?? 0) / 100);
      const x = coverSonarSize / 2 + r * Math.cos(a);
      const y = coverSonarSize / 2 + r * Math.sin(a);
      const t = tierFromPct(c.pct);
      return `
        <circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="var(--ink)" stroke-width="1.4"/>
        <circle cx="${x}" cy="${y}" r="3" fill="var(--${t.key})"/>
      `;
    }).join('');
  }

  return `
    <section class="page cover">
      <div class="cover-inner">
        <div class="cover-top">
          <div class="brand">
            ${currentLogoImg}
            <div class="brand-sep"></div>
            <div class="brand-sub">Performance Assessment</div>
          </div>
          <div class="cover-meta-right">
            REPORT No.
            <span class="mono">R-${today.getMonth() + 1}${String(today.getDate()).padStart(2, '0')}</span>
          </div>
        </div>

        <div class="cover-body">
          <svg class="cover-sonar" viewBox="0 0 ${coverSonarSize} ${coverSonarSize}">
            <g fill="none" stroke="var(--ink)" stroke-opacity="0.06">
              <circle cx="300" cy="300" r="60"/>
              <circle cx="300" cy="300" r="120"/>
              <circle cx="300" cy="300" r="180"/>
              <circle cx="300" cy="300" r="240"/>
              <circle cx="300" cy="300" r="295"/>
            </g>
            <circle cx="300" cy="300" r="150" fill="none" stroke="var(--avg)" stroke-opacity="0.5" stroke-width="1" stroke-dasharray="3 4"/>
            <circle cx="300" cy="300" r="150" fill="var(--avg-soft)" fill-opacity="0.35"/>
            <g stroke="var(--ink)" stroke-opacity="0.06" stroke-width="1">
              <line x1="300" y1="5" x2="300" y2="595"/>
              <line x1="5" y1="300" x2="595" y2="300"/>
              <line x1="93" y1="93" x2="507" y2="507"/>
              <line x1="93" y1="507" x2="507" y2="93"/>
            </g>
            ${sonarAthletePath ? `<path d="${sonarAthletePath}" fill="var(--ink)" fill-opacity="0.06" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>` : ''}
            ${sonarPoints}
          </svg>

          <div class="cover-eyebrow-row" style="position:relative; z-index:2;">
            <div class="eyebrow">Performance Assessment Report</div>
            <span class="pill ink">${escapeHtml(tierLabel)}</span>
            ${overallComposite !== null ? `<span class="pill accent">Composite ${overallComposite} %ile</span>` : ''}
          </div>

          <div style="position:relative; z-index:2;">
            <h1 class="cover-headline">
              ${escapeHtml(firstName)}${lastName ? `<br/>${escapeHtml(lastName)}` : ''}<span class="rule-slash">.</span>
            </h1>
            <div class="cover-subline">
              ${reportData.position && reportData.position !== 'N/A' ? `<b>${escapeHtml(reportData.position)}</b><span class="sep">/</span>` : ''}
              ${reportData.team && reportData.team !== 'N/A' ? `<span>${escapeHtml(reportData.team)}</span><span class="sep">/</span>` : ''}
              <span class="muted">${escapeHtml(tierLabel)}</span>
            </div>
          </div>

          <div class="cover-meta">
            <div class="cell">
              <div class="k">Age</div>
              <div class="v">${info.age || '—'}${info.age ? ` <span class="u">yrs</span>` : ''}</div>
            </div>
            <div class="cell">
              <div class="k">Height</div>
              <div class="v">${info.height || '—'}</div>
            </div>
            <div class="cell">
              <div class="k">Weight</div>
              <div class="v">${info.weight || '—'}</div>
            </div>
            <div class="cell">
              <div class="k">Tests</div>
              <div class="v">${testCount} <span class="u">incl.</span></div>
            </div>
            <div class="cell">
              <div class="k">Issued</div>
              <div class="v" style="font-size:13pt;">${escapeHtml(issuedDate)}</div>
            </div>
          </div>

          <div class="cover-bottom">
            <div class="cover-prepared">
              <div class="eyebrow" style="margin-bottom:6px;">Prepared by</div>
              <div><b>${escapeHtml(currentFacilityName)} Staff</b></div>
              <div class="muted">Performance Assessment Department</div>
              <div style="margin-top:10px; max-width: 5in;" class="muted">
                This report summarizes force-plate assessment results across ${testCount} standardized test${testCount === 1 ? '' : 's'},
                benchmarked against the ${escapeHtml(currentFacilityName)} ${escapeHtml(tierLabel)} population.
              </div>
            </div>
          </div>
        </div>
      </div>

    </section>
  `;
}

// ──────────────────────────────────────────────────────────────────────────────
// Snapshot page
// ──────────────────────────────────────────────────────────────────────────────
function renderSnapshotPage(reportData, athleteName, composites, overallComposite, pageNum, totalPages) {
  const idShort = (reportData.athleteId || '').toString().slice(0, 12);
  const overallTier = tierFromPct(overallComposite);
  const tierLabel = TIER_LABELS[reportData.tier] || 'Athlete';

  const kpiCards = composites.map((c) => {
    const tier = tierFromPct(c.pct);
    const dateStr = c.testDate ? new Date(c.testDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '';
    return `
      <div class="kpi">
        <div class="k-head">
          <div class="k-name">${escapeHtml(c.label)}</div>
          <div class="k-code">${escapeHtml(c.short)}</div>
        </div>
        <div class="k-big"><div class="num">${c.pct}</div><div class="u">%ile</div></div>
        ${renderPctBar(c.pct)}
        <div style="display:flex; justify-content:space-between; align-items:center;">
          ${renderTierPill(c.pct)}
          ${dateStr ? `<span class="k-date">${escapeHtml(dateStr)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <section class="page">
      <div class="page-head">
        <div class="brand">
          ${currentLogoImg}
          <div class="brand-sep"></div>
          <div class="brand-sub">Performance Snapshot</div>
        </div>
        <div class="cover-meta-right">
          <span class="mono" style="color:var(--ink-2); font-weight:600;">${escapeHtml(athleteName)}</span>
        </div>
      </div>

      <div class="page-body">
        <div class="page-title-row">
          <div>
            <div class="eyebrow">Page ${String(pageNum).padStart(2, '0')} · Summary</div>
            <h2 class="h2">Performance Snapshot</h2>
            <div class="test-desc">Composite percentiles across ${composites.length} force-plate assessment${composites.length === 1 ? '' : 's'}, benchmarked against the ${escapeHtml(tierLabel)} population. The snapshot radar below visualizes all test composites simultaneously.</div>
          </div>
          ${overallComposite !== null ? `
            <div style="text-align:right;">
              <div class="eyebrow">Overall Composite</div>
              <div style="display:flex; align-items:baseline; gap:6px; justify-content:flex-end; margin-top:4px;">
                <div style="font-family:var(--serif); font-weight:600; font-size:34pt; letter-spacing:-0.025em; line-height:1;">${overallComposite}</div>
                <div class="mono" style="font-size:9pt; color:var(--ink-4);">%ile</div>
              </div>
              ${overallTier ? `<div style="margin-top:4px;">${renderTierPill(overallComposite)}</div>` : ''}
            </div>
          ` : ''}
        </div>

        <div style="margin-top:14px;">
          <div class="kpi-grid">${kpiCards}</div>
        </div>

        <div class="radar-block" style="margin-top:16px; display:flex; flex-direction:column;">
          <div class="radar-legend">
            <div class="h3">Composite Snapshot</div>
            <div class="keys">
              <span><span class="sw" style="background:var(--ink);"></span>Athlete</span>
              <span><span class="sw" style="background:var(--avg-soft); border:1px dashed var(--avg);"></span>Pop. Avg</span>
            </div>
          </div>
          <div style="max-width: 2.85in; width:100%; margin: 0 auto;">
            ${renderSnapshotRadar(composites)}
          </div>
        </div>
      </div>

    </section>
  `;
}

// ──────────────────────────────────────────────────────────────────────────────
// Test detail page
// ──────────────────────────────────────────────────────────────────────────────
function renderTestPage(testKey, reportData, recs, athleteName, pageNum, totalPages, testIdx, testTotal, selectedRadarKeys) {
  const def = TEST_DEFS[testKey];
  const metrics = buildMetrics(testKey, reportData);
  const composite = getComposite(metrics);
  const compositeTier = tierFromPct(composite);
  const idShort = (reportData.athleteId || '').toString().slice(0, 12);
  const date = reportData?.[COMP_KEY[testKey]]?.testDate || reportData?.tests?.[TESTS_KEY[testKey]]?.testDate;
  const dateStr = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '';

  const radarKeys = selectedRadarKeys?.[testKey] || def.metrics.map((m) => m.key);
  const radarMetrics = metrics.filter((m) => radarKeys.includes(m.key));

  const eliteCount = metrics.filter((m) => m.pct >= 85).length;
  const belowCount = metrics.filter((m) => m.pct < 40).length;

  return `
    <section class="page">
      <div class="page-head">
        <div class="brand">
          ${currentLogoImg}
          <div class="brand-sep"></div>
          <div class="brand-sub">Test Detail · ${escapeHtml(def.title)}</div>
        </div>
        <div class="cover-meta-right">
          <span class="mono" style="color:var(--ink-2); font-weight:600;">${escapeHtml(athleteName)}</span>
        </div>
      </div>

      <div class="page-body">
        <div class="page-title-row">
          <div>
            <div class="eyebrow">Page ${String(pageNum).padStart(2, '0')} · Test ${testIdx} of ${testTotal}</div>
            <h2 class="h2">${escapeHtml(def.title)} <span style="color:var(--ink-5); font-weight:500;">/ ${escapeHtml(def.short)}</span></h2>
            <div class="test-desc">${escapeHtml(def.description)}</div>
          </div>
          <div style="text-align:right;">
            ${dateStr ? `<div class="eyebrow">Tested</div><div class="mono" style="font-size:11pt; color:var(--ink-2); font-weight:600; margin-top:2px;">${escapeHtml(dateStr)}</div>` : ''}
          </div>
        </div>

        ${composite !== null ? `
          <div class="composite-strip">
            <div>
              <div class="h3" style="margin-bottom:6px;">Composite Score</div>
              <div class="big-score">
                <div class="num">${composite}</div>
                <div class="u">%ile</div>
                ${renderTierPill(composite)}
              </div>
            </div>
            <div class="col-sep">
              <div class="h3" style="margin-bottom:8px;">Distribution vs Population</div>
              ${renderPctBar(composite, false)}
            </div>
            <div style="display:flex; gap:18px;">
              <div>
                <div class="eyebrow" style="font-size:7pt;">Elite</div>
                <div style="font-family:var(--serif); font-size:20pt; font-weight:600; line-height:1; margin-top:4px;">${eliteCount}<span class="mono muted" style="font-size:9pt; margin-left:3px;">/${metrics.length}</span></div>
              </div>
              <div>
                <div class="eyebrow" style="font-size:7pt;">Below Avg</div>
                <div style="font-family:var(--serif); font-size:20pt; font-weight:600; line-height:1; margin-top:4px; color:${belowCount > 0 ? 'var(--below)' : 'var(--ink)'};">${belowCount}<span class="mono muted" style="font-size:9pt; margin-left:3px;">/${metrics.length}</span></div>
              </div>
            </div>
          </div>
        ` : ''}

        <div class="two-col">
          <div>
            <div class="h3" style="margin-bottom:8px;">Detailed Metrics</div>
            ${metrics.length > 0 ? renderMetricsTable(metrics) : `<div class="text-block">No metric data available for this test.</div>`}
          </div>
          <div>
            <div class="h3" style="margin-bottom:8px;">Athlete vs Population</div>
            <div class="radar-block">
              <div class="radar-legend">
                <div class="keys">
                  <span><span class="sw" style="background:var(--ink);"></span>Athlete</span>
                  <span><span class="sw" style="background:var(--avg-soft); border:1px dashed var(--avg);"></span>Pop. Avg (50)</span>
                </div>
                <span class="mono muted" style="font-size:7pt;">SCALE · 0–100 %ILE</span>
              </div>
              ${renderRadar(radarMetrics, 320)}
            </div>
            ${recs && recs.trim() ? `<div style="margin-top:12px;">${renderRecs(recs, def.short)}</div>` : ''}
          </div>
        </div>
      </div>

    </section>
  `;
}

// ──────────────────────────────────────────────────────────────────────────────
// Single Leg CMJ asymmetry page
// ──────────────────────────────────────────────────────────────────────────────
function renderSingleLegPage(reportData, recs, athleteName, pageNum, testIdx, testTotal) {
  const left = reportData?.tests?.singleLegCMJ_Left;
  const right = reportData?.tests?.singleLegCMJ_Right;
  const idShort = (reportData.athleteId || '').toString().slice(0, 12);

  const calcAsymmetry = (l, r) => {
    if (l === null || l === undefined || r === null || r === undefined || l === 0 || r === 0) return null;
    return Math.abs(l - r) / ((l + r) / 2) * 100;
  };

  const rows = [
    { label: 'Jump Height (in)',           l: left?.jumpHeight,             r: right?.jumpHeight,             decimals: 2 },
    { label: 'Peak Power / BM (W/kg)',     l: left?.peakPowerBM,            r: right?.peakPowerBM,            decimals: 1 },
    { label: 'Concentric Peak Force (N)',  l: left?.concentricPeakForce,    r: right?.concentricPeakForce,    decimals: 0 },
    { label: 'Eccentric Peak Force (N)',   l: left?.eccentricPeakForce,     r: right?.eccentricPeakForce,     decimals: 0 },
    { label: 'Eccentric Braking RFD (N/s)', l: left?.eccentricBrakingRFD,   r: right?.eccentricBrakingRFD,    decimals: 0 },
    { label: 'RSI',                        l: left?.rsi,                    r: right?.rsi,                    decimals: 2 },
  ].map((row) => ({ ...row, asy: calcAsymmetry(row.l, row.r) }));

  const asyClass = (a) => a === null ? '' : a <= 5 ? 'elite' : a <= 10 ? 'avg' : 'below';
  const asyColor = (a) => a === null ? 'var(--ink-4)' : a <= 5 ? 'var(--elite)' : a <= 10 ? 'var(--avg)' : 'var(--below)';

  const cards = rows.map((r) => {
    const hasData = (r.l !== null && r.l !== undefined) || (r.r !== null && r.r !== undefined);
    if (!hasData) return '';
    return `
      <div class="sym-card">
        <div class="sym-lbl">${escapeHtml(r.label)}</div>
        <div class="sym-row">
          <div class="sym-side left">
            <div class="s-lbl">LEFT</div>
            <div class="s-val">${r.l !== null && r.l !== undefined ? Number(r.l).toFixed(r.decimals) : '—'}</div>
          </div>
          <div class="sym-div"></div>
          <div class="sym-side">
            <div class="s-lbl">RIGHT</div>
            <div class="s-val">${r.r !== null && r.r !== undefined ? Number(r.r).toFixed(r.decimals) : '—'}</div>
          </div>
        </div>
        <div class="sym-foot">
          <div class="muted" style="font-size:8pt;">Asymmetry</div>
          <div class="asy" style="color:${asyColor(r.asy)};">${r.asy !== null ? `${r.asy.toFixed(1)}%` : '—'}</div>
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  return `
    <section class="page">
      <div class="page-head">
        <div class="brand">
          ${currentLogoImg}
          <div class="brand-sep"></div>
          <div class="brand-sub">Test Detail · Single Leg CMJ</div>
        </div>
        <div class="cover-meta-right">
          <span class="mono" style="color:var(--ink-2); font-weight:600;">${escapeHtml(athleteName)}</span>
        </div>
      </div>

      <div class="page-body">
        <div class="page-title-row">
          <div>
            <div class="eyebrow">Page ${String(pageNum).padStart(2, '0')} · Test ${testIdx} of ${testTotal}</div>
            <h2 class="h2">Single Leg CMJ <span style="color:var(--ink-5); font-weight:500;">/ Symmetry</span></h2>
            <div class="test-desc">Unilateral jump testing to quantify L/R asymmetry. Targets are &lt;5% for each metric. Asymmetries above 10% warrant focused unilateral training.</div>
          </div>
        </div>

        <div class="sym-grid">${cards}</div>

        ${renderRecs(recs, 'SL CMJ')}
      </div>

    </section>
  `;
}

// ──────────────────────────────────────────────────────────────────────────────
// Initial Assessment + Training Plan pages
// ──────────────────────────────────────────────────────────────────────────────
function paragraphsHtml(text) {
  return String(text).split('\n').filter((p) => p.trim()).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
}

function renderFindingCard(f) {
  let body = '';

  if (f.type === 'deficiency-list') {
    const flagged = (f.deficiencies || []).filter((d) => f.result?.deficiencies?.[d.id]);
    if (flagged.length === 0) return '';
    body = `<div class="def-chips">${flagged.map((d) => `<span class="def-chip">${escapeHtml(d.label)}</span>`).join('')}</div>`;
  } else if (f.type === 'categorical') {
    const choice = (f.options || []).find((o) => o.id === f.result?.choice);
    if (!choice) return '';
    body = `<div class="cat-pill">${escapeHtml(choice.label)}</div>`;
  } else if (f.type === 'value-entry') {
    const filled = (f.fields || []).filter((fd) => {
      const v = f.result?.values?.[fd.id];
      return v !== '' && v !== null && v !== undefined;
    });
    if (filled.length === 0) return '';
    body = `<div class="val-grid">${filled.map((fd) => {
      const v = f.result.values[fd.id];
      const num = Number(v);
      const hasNorm = Array.isArray(fd.normal);
      const outOfRange = hasNorm && !isNaN(num) && (num < fd.normal[0] || num > fd.normal[1]);
      return `<div class="val-cell">
        <div class="val-lbl">${escapeHtml(fd.label)}</div>
        <div class="val-row">
          <span class="val-num${outOfRange ? ' out' : ''}">${escapeHtml(String(v))}</span>
          ${fd.unit ? `<span class="val-unit">${escapeHtml(fd.unit)}</span>` : ''}
        </div>
        ${hasNorm ? `<div class="val-norm">normal ${fd.normal[0]}–${fd.normal[1]}${fd.unit ? ' ' + escapeHtml(fd.unit) : ''}</div>` : ''}
      </div>`;
    }).join('')}</div>`;
  } else if (f.type === 'pass-fail') {
    const r = f.result?.result;
    if (r !== 'pass' && r !== 'fail') return '';
    body = `<div class="pf-stamp ${r}">${r === 'pass' ? 'PASS' : 'FAIL'}</div>`;
  }

  if (!body) return '';

  const notes = f.result?.notes && f.result.notes.trim();
  const notesBlock = notes ? `<div class="finding-notes">
    <div class="val-lbl">Notes</div>
    ${paragraphsHtml(notes)}
  </div>` : '';

  return `<div class="finding-card keep">
    <div class="finding-head">
      <div>
        <div class="finding-name">${escapeHtml(f.name)}</div>
        <div class="finding-meta">${escapeHtml(f.short)}${!f.coreDefault ? ' · ADDED' : ''}</div>
      </div>
    </div>
    ${body}
    ${notesBlock}
  </div>`;
}

function renderAssessmentPage(reportData, athleteName, pageNum) {
  const idShort = (reportData.athleteId || '').toString().slice(0, 12);
  const assessment = reportData.assessment || {};
  const intakeFields = assessment.intakeFields || [];
  const blockTag = (assessment.blockTag || '').trim();
  const findings = assessment.findings || [];
  const summary = (assessment.summary || '').trim();

  // Legacy fallback — old payload shape where only `initialAssessment` was sent.
  const hasNewShape = intakeFields.length > 0 || blockTag || findings.length > 0 || summary;
  if (!hasNewShape) {
    const ia = reportData.initialAssessment || {};
    const legacy = [
      { key: 'currentInjuries',     label: 'Current Status' },
      { key: 'injuryHistory',       label: 'Injury History' },
      { key: 'posturePresentation', label: 'Posture Presentation' },
      { key: 'movementAnalysis',    label: 'Movement Analysis' },
    ]
      .map((f) => (ia[f.key] && ia[f.key].trim())
        ? `<div class="text-block keep" style="margin-bottom:12px;"><h4>${escapeHtml(f.label)}</h4>${paragraphsHtml(ia[f.key])}</div>`
        : '')
      .filter(Boolean)
      .join('');
    if (!legacy) return '';
    return wrapAssessmentPage({ athleteName, idShort, pageNum, body: legacy });
  }

  const intakeBlockTag = blockTag ? `
    <div class="block-tag-card keep">
      <div class="bt-lbl">Block Tag</div>
      <div class="bt-val">${escapeHtml(blockTag)}</div>
    </div>
  ` : '';

  const intakeBlocks = intakeFields.length > 0 ? `
    <div class="intake-grid">
      ${intakeFields.map((f) => `
        <div class="text-block keep">
          <h4>${escapeHtml(f.label)}</h4>
          ${paragraphsHtml(f.value)}
        </div>
      `).join('')}
    </div>
  ` : '';

  const intakeSection = (blockTag || intakeFields.length > 0) ? `
    <div class="assess-section-head">Intake</div>
    ${intakeBlockTag}
    ${intakeBlocks}
  ` : '';

  const findingCards = findings.map(renderFindingCard).filter(Boolean).join('');
  const findingsSection = findingCards ? `
    <div class="assess-section-head">
      <span>Screen Findings</span>
      <span class="count">${findings.length} test${findings.length !== 1 ? 's' : ''} with findings</span>
    </div>
    ${findingCards}
  ` : '';

  const summarySection = summary ? `
    <div class="assess-section-head">Summary</div>
    <div class="text-block keep">
      ${paragraphsHtml(summary)}
    </div>
  ` : '';

  const body = `${intakeSection}${findingsSection}${summarySection}`;
  return wrapAssessmentPage({ athleteName, idShort, pageNum, body });
}

function wrapAssessmentPage({ athleteName, idShort, pageNum, body }) {
  return `
    <section class="page">
      <div class="page-head">
        <div class="brand">
          ${currentLogoImg}
          <div class="brand-sep"></div>
          <div class="brand-sub">Assessment</div>
        </div>
        <div class="cover-meta-right">
          <span class="mono" style="color:var(--ink-2); font-weight:600;">${escapeHtml(athleteName)}</span>
        </div>
      </div>

      <div class="page-body">
        <div class="page-title-row">
          <div>
            <div class="eyebrow">Page ${String(pageNum).padStart(2, '0')} · Intake & Screen</div>
            <h2 class="h2">Assessment Findings</h2>
            <div class="test-desc">Intake history and movement screen findings gathered before force-plate testing.</div>
          </div>
        </div>

        ${body}
      </div>

    </section>
  `;
}

function renderTrainingPlanPage(reportData, composites, athleteName, pageNum) {
  const goals = reportData.trainingGoals || {};
  const idShort = (reportData.athleteId || '').toString().slice(0, 12);
  const validComposites = composites.filter((c) => c.pct !== null && c.pct !== undefined);
  // Trainer-selected focus areas (by test key). Fall back to the 4 weakest if no selection sent (legacy payloads).
  const selectedKeys = Array.isArray(reportData.selectedFocusKeys) ? reportData.selectedFocusKeys : null;
  const focusAreas = selectedKeys
    ? validComposites.filter((c) => selectedKeys.includes(c.key)).sort((a, b) => a.pct - b.pct)
    : [...validComposites].sort((a, b) => a.pct - b.pct).slice(0, 4);

  const goalsText = goals.goals || '';
  const planText = goals.actionPlan || '';

  const focusCards = focusAreas.map((f) => `
    <div class="focus-card">
      <div>
        <div class="f-name">${escapeHtml(f.label)}</div>
        ${renderPctBar(f.pct)}
      </div>
      <div style="text-align:right;">
        <div class="mono" style="font-size:11pt; font-weight:700;">${f.pct}<span class="muted" style="font-size:8pt;">%ile</span></div>
        ${renderTierPill(f.pct)}
      </div>
    </div>
  `).join('');

  const goalsBlock = goalsText.trim() ? `
    <div class="text-block keep">
      <h4>Goals</h4>
      ${goalsText.split('\n').filter((p) => p.trim()).map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
    </div>
  ` : '';

  const planBlock = planText.trim() ? `
    <div class="text-block keep">
      <h4>Action Plan</h4>
      ${planText.split('\n').filter((p) => p.trim()).map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
    </div>
  ` : '';

  return `
    <section class="page">
      <div class="page-head">
        <div class="brand">
          ${currentLogoImg}
          <div class="brand-sep"></div>
          <div class="brand-sub">Training Plan</div>
        </div>
        <div class="cover-meta-right">
          <span class="mono" style="color:var(--ink-2); font-weight:600;">${escapeHtml(athleteName)}</span>
        </div>
      </div>

      <div class="page-body">
        <div class="page-title-row">
          <div>
            <div class="eyebrow">Page ${String(pageNum).padStart(2, '0')} · Action Plan</div>
            <h2 class="h2">Training Goals & Prescription</h2>
          </div>
        </div>

        ${focusAreas.length > 0 ? `
          <div style="margin-bottom:14px;">
            <div class="h3" style="margin-bottom:8px;">Focus Areas</div>
            <div class="focus-grid">${focusCards}</div>
          </div>
        ` : ''}

        <div class="two-col equal">
          ${goalsBlock}
          ${planBlock}
        </div>
      </div>

    </section>
  `;
}

// ──────────────────────────────────────────────────────────────────────────────
// Master HTML renderer
// ──────────────────────────────────────────────────────────────────────────────
function renderFullReport(reportData) {
  const athleteName = reportData.athlete || reportData.name || 'Athlete';
  const tier = reportData.tier || 'pro';

  // Build composites for tests that have data
  const composites = [];
  for (const [k, def] of Object.entries(TEST_DEFS)) {
    const metrics = buildMetrics(k, reportData);
    const pct = getComposite(metrics);
    if (pct !== null) {
      composites.push({
        key: k,
        label: def.title,
        short: def.short,
        pct,
        testDate: reportData?.[COMP_KEY[k]]?.testDate || reportData?.tests?.[TESTS_KEY[k]]?.testDate,
      });
    }
  }

  const overallComposite = composites.length > 0
    ? Math.round(composites.reduce((a, b) => a + b.pct, 0) / composites.length)
    : null;

  // Recommendations map for each test
  const recsMap = {
    cmj: reportData.cmjRecommendations || '',
    squatJump: reportData.sjRecommendations || '',
    imtp: reportData.imtpRecommendations || '',
    hopTest: reportData.hopRecommendations || '',
    ppu: reportData.ppuRecommendations || '',
  };

  // Build pages
  const pages = [];
  pages.push(renderCoverPage(reportData, athleteName, tier, composites, overallComposite));
  if (composites.length > 0) {
    pages.push(renderSnapshotPage(reportData, athleteName, composites, overallComposite, pages.length + 1));
  }

  // Assessment (intake + screen findings + summary). Empty content is skipped.
  const assessPage = renderAssessmentPage(reportData, athleteName, pages.length + 1);
  if (assessPage) pages.push(assessPage);

  // Test detail pages
  composites.forEach((c, i) => {
    pages.push(renderTestPage(c.key, reportData, recsMap[c.key], athleteName, pages.length + 1, pages.length + 1, i + 1, composites.length + (reportData.tests?.singleLegCMJ_Left || reportData.tests?.singleLegCMJ_Right ? 1 : 0), reportData.selectedMetrics));
  });

  // Single Leg CMJ asymmetry page
  if (reportData.tests?.singleLegCMJ_Left || reportData.tests?.singleLegCMJ_Right) {
    pages.push(renderSingleLegPage(reportData, reportData.slCmjRecommendations, athleteName, pages.length + 1, composites.length + 1, composites.length + 1));
  }

  // Training plan
  pages.push(renderTrainingPlanPage(reportData, composites, athleteName, pages.length + 1));

  return STYLES + pages.join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// Embedded styles (the design's full CSS)
// ──────────────────────────────────────────────────────────────────────────────
const STYLES = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Performance Assessment Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap" rel="stylesheet">
<style>
  :root{
    --paper:#FAF8F5; --paper-2:#F3EFE8; --paper-3:#EBE5DB;
    --line:#E2DBCF; --line-2:#D2C8B7;
    --ink:#141211; --ink-2:#2A2623; --ink-3:#4E4843; --ink-4:#7C746C; --ink-5:#A69C90;
    --accent:oklch(0.58 0.17 28);
    --accent-ink:oklch(0.48 0.19 28);
    --accent-soft:oklch(0.93 0.04 28);
    --elite:oklch(0.55 0.09 155);  --elite-soft:oklch(0.93 0.04 155);
    --above:oklch(0.62 0.09 135);  --above-soft:oklch(0.94 0.035 135);
    --avg:oklch(0.70 0.11 80);     --avg-soft:oklch(0.95 0.05 80);
    --below:oklch(0.60 0.14 28);   --below-soft:oklch(0.94 0.05 28);
    --sans:"Inter Tight", ui-sans-serif, system-ui, sans-serif;
    --mono:"JetBrains Mono", ui-monospace, monospace;
    --serif:"Fraunces", ui-serif, Georgia, serif;
  }
  @page{ size: Letter portrait; margin: 0; }
  *{box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact;}
  html,body{margin:0;padding:0;background:var(--paper);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;}
  body{font-size:10.5pt;line-height:1.45;letter-spacing:-0.005em;}
  .page{ width: 100%; min-height: 10.25in; background:var(--paper); position:relative; overflow:hidden; page-break-after: always; display:flex; flex-direction:column; padding: 1in 1in 0 1in; box-sizing: border-box; }
  .page:last-child{ page-break-after: auto; }

  .eyebrow{ font-size:8pt; text-transform:uppercase; letter-spacing:0.14em; color:var(--ink-4); font-weight:700; }
  .h1{ font-family:var(--serif); font-weight:600; font-size:26pt; line-height:1.05; letter-spacing:-0.02em; margin:0; }
  .h2{ font-family:var(--serif); font-weight:600; font-size:14pt; line-height:1.1; letter-spacing:-0.015em; margin:0;}
  .h3{ font-size:9pt; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-3); margin:0;}
  .mono{ font-family:var(--mono); font-variant-numeric: tabular-nums;}
  .muted{ color:var(--ink-4);}

  .pill{ display:inline-flex; align-items:center; gap:5px; min-height:20px; padding:3px 9px; border-radius:3px; font-size:7.5pt; font-weight:700; letter-spacing:0.02em; text-transform:uppercase; background:var(--paper-2); color:var(--ink-3); border:1px solid var(--line); vertical-align: middle; line-height:1; }
  .pill.ink{ background:var(--ink); color:var(--paper); border-color:transparent;}
  .pill.accent{ background:var(--accent); color:#fff; border-color:transparent;}
  .pill.elite{ background:var(--elite-soft); color:var(--elite); border-color:transparent;}
  .pill.above{ background:var(--above-soft); color:var(--above); border-color:transparent;}
  .pill.avg{   background:var(--avg-soft);   color:var(--avg);   border-color:transparent;}
  .pill.below{ background:var(--below-soft); color:var(--below); border-color:transparent;}
  .dot{ width:5px; height:5px; border-radius:50%; background:currentColor; display:inline-block;}

  .page-head{ display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; border-bottom:1px solid var(--line);}
  .brand{ display:flex; align-items:center; gap:9px;}
  .brand-logo{ height:24px; width:auto; color:var(--ink); display:block;}
  .brand-sep{ width:1px; height:14px; background:var(--line-2); margin:0 6px;}
  .brand-sub{ color:var(--ink-4); font-size:8pt; letter-spacing:0.03em; font-weight:500; text-transform:uppercase;}

  /* Native Puppeteer footerTemplate handles page footers — no .page-foot in body. */

  /* cover inherits .page padding for edge-bleed page with content inset */
  .cover-inner{ position:relative; flex:1; display:flex; flex-direction:column;}
  .cover-top{ display:flex; justify-content:space-between; align-items:center; padding-bottom:18px; border-bottom:1px solid var(--ink);}
  .cover-meta-right{ text-align:right; font-size:8pt; color:var(--ink-4); letter-spacing:0.04em;}
  .cover-meta-right .mono{ color:var(--ink-2); font-weight:600; font-size:9pt; display:block; margin-top:2px;}
  .cover-body{ flex:1; display:grid; grid-template-columns: 1fr; grid-template-rows: auto auto auto 1fr; gap: 18px; position:relative; padding-top: 48px;}
  .cover-body > .cover-bottom{ align-self: end;}
  .cover-eyebrow-row{ display:flex; align-items:center; gap:10px;}
  .cover-headline{ font-family:var(--serif); font-weight:600; font-size: 72pt; line-height:0.95; letter-spacing:-0.035em; color:var(--ink); margin: 6px 0 0; max-width: 6.5in; }
  .cover-headline .rule-slash{ color:var(--accent); font-weight:500;}
  .cover-subline{ margin-top:14px; font-size: 13pt; color:var(--ink-3); font-weight:500; letter-spacing:-0.005em; display:flex; align-items:center; gap:12px; flex-wrap:wrap;}
  .cover-subline .sep{ color:var(--line-2);}
  .cover-subline b{ color:var(--ink); font-weight:600;}
  .cover-sonar{ position:absolute; left:-1in; bottom:0.25in; width:4.5in; height:4.5in; pointer-events:none;}
  .cover-meta{ display:grid; grid-template-columns: repeat(5, 1fr); border-top:1px solid var(--line); border-bottom:1px solid var(--line); position:relative; z-index:2;}
  .cover-meta .cell{ padding: 14px 14px 14px 0; border-right: 1px solid var(--line);}
  .cover-meta .cell:last-child{ border-right:0; padding-right:0;}
  .cover-meta .k{ font-family:var(--mono); font-size:7.5pt; letter-spacing:0.1em; text-transform:uppercase; color:var(--ink-4); font-weight:600;}
  .cover-meta .v{ margin-top:6px; font-family:var(--serif); font-weight:600; font-size:15pt; letter-spacing:-0.01em; color:var(--ink);}
  .cover-meta .v .u{ font-family:var(--mono); font-size:8.5pt; font-weight:500; color:var(--ink-4); margin-left:2px;}
  .cover-bottom{ display:flex; justify-content:flex-end; align-items:flex-end; padding-top:14px; position:relative; z-index:2;}
  .cover-prepared{ font-size:9pt; color:var(--ink-3); line-height:1.5;}
  .cover-prepared b{ color:var(--ink); font-weight:700;}
  .cover-stamp{ display:inline-flex; flex-direction:column; align-items:flex-end; gap:6px;}

  .page-body{ flex:1; display:flex; flex-direction:column; padding-top:18px; padding-bottom:40px; min-height:0;}
  .page-title-row{ display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:10px;}
  .page-title-row .h2{ margin:0;}
  .page-title-row .eyebrow{ display:block; margin-bottom:4px;}

  .pct-bar{ position:relative; width:100%; height:9px; border-radius:4.5px; overflow:hidden; display:flex; background:var(--paper-2);}
  .pct-bar .zone{ height:100%;}
  .pct-bar .z-below{ background:var(--below-soft);}
  .pct-bar .z-avg{   background:var(--avg-soft);}
  .pct-bar .z-above{ background:var(--above-soft);}
  .pct-bar .z-elite{ background:var(--elite-soft);}
  .pct-bar .mid{ position:absolute; top:-2px; bottom:-2px; left:50%; width:1px; background:var(--ink-4); opacity:0.35;}
  .pct-bar .marker{ position:absolute; top:-3px; bottom:-3px; width:3px; background:var(--ink); border-radius:2px; transform:translateX(-50%);}
  .pct-bar-scale{ display:flex; justify-content:space-between; margin-top:3px; font-size:6pt; color:var(--ink-5); font-family:var(--mono); letter-spacing:0.04em;}

  .kpi-grid{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); grid-auto-rows:1fr; gap:12px;}
  .kpi{ border:1px solid var(--line); border-radius:6px; background:#fff; padding:14px 16px; display:flex; flex-direction:column; gap:9px; break-inside: avoid; min-height:158px;}
  .kpi .k-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:8px;}
  .kpi .k-name{ font-size:10pt; font-weight:700; letter-spacing:-0.005em; color:var(--ink); line-height:1.2; min-height:2.4em;}
  .kpi .k-code{ font-family:var(--mono); font-size:7.5pt; color:var(--ink-4); font-weight:600;}
  .kpi .k-big{ display:flex; align-items:baseline; gap:6px; margin-top:auto;}
  .kpi .k-big .num{ font-family:var(--serif); font-weight:600; font-size:33pt; letter-spacing:-0.02em; line-height:1;}
  .kpi .k-big .u{ font-family:var(--mono); font-size:8pt; color:var(--ink-4);}
  .kpi .k-date{ font-family:var(--mono); font-size:7.5pt; color:var(--ink-4);}

  table.metrics{ width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line); border-radius:5px; overflow:hidden;}
  table.metrics thead tr{ background:var(--paper-2); border-bottom:1px solid var(--line);}
  table.metrics th{ padding:8px 10px; font-size:7pt; text-transform:uppercase; letter-spacing:0.1em; color:var(--ink-4); font-weight:700; text-align:left;}
  table.metrics th.right{ text-align:right;}
  table.metrics tbody td{ padding:9px 10px; font-size:9pt; border-bottom:1px solid var(--line); vertical-align:middle;}
  table.metrics tbody tr:last-child td{ border-bottom:0;}
  table.metrics .m-name{ font-weight:600; color:var(--ink-2);}
  table.metrics .m-val{ font-family:var(--mono); font-weight:600; color:var(--ink);}
  table.metrics .m-pop{ font-family:var(--mono); color:var(--ink-4);}
  table.metrics .m-delta{ font-family:var(--mono); font-weight:600;}
  table.metrics .m-delta.up{ color:var(--elite);}
  table.metrics .m-delta.down{ color:var(--below);}
  table.metrics .m-pct{ font-family:var(--mono); font-weight:700; text-align:right; white-space:nowrap;}
  table.metrics .m-pct .u{ font-size:7pt; color:var(--ink-4); margin-left:2px; font-weight:500;}
  table.metrics .m-tier{ text-align:right;}

  .composite-strip{ border:1px solid var(--line); border-radius:5px; background:#fff; padding:10px 16px; display:grid; grid-template-columns: auto 1fr auto; gap:18px; align-items:center; margin-bottom:10px; break-inside:avoid;}
  .composite-strip .col-sep{ padding-left:18px; border-left:1px solid var(--line);}
  .composite-strip .big-score{ display:flex; align-items:baseline; gap:6px;}
  .composite-strip .big-score .num{ font-family:var(--serif); font-weight:600; font-size:22pt; line-height:1; letter-spacing:-0.025em;}
  .composite-strip .big-score .u{ font-family:var(--mono); font-size:8pt; color:var(--ink-4);}

  .radar-block{ border:1px solid var(--line); border-radius:5px; background:#fff; padding:14px; break-inside:avoid;}
  .radar-legend{ display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;}
  .radar-legend .keys{ display:flex; gap:14px; font-size:8pt; font-weight:600;}
  .radar-legend .sw{ display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:4px; vertical-align:middle;}

  .recs{ border:1px dashed var(--line-2); border-radius:5px; background:var(--paper); padding:14px 16px; break-inside:avoid;}
  .recs p{ margin:0 0 8px; font-size:9.5pt; line-height:1.55; color:var(--ink-2);}
  .recs p:last-child{ margin-bottom:0;}

  .snapshot-grid{ display:grid; grid-template-columns: 1.2fr 1fr; gap:16px; margin-top:14px; flex:1; min-height:0;}

  .sym-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px;}
  .sym-card{ border:1px solid var(--line); border-radius:5px; background:#fff; padding:14px 16px; break-inside:avoid;}
  .sym-card .sym-lbl{ font-family:var(--mono); font-size:7.5pt; letter-spacing:0.1em; text-transform:uppercase; color:var(--ink-4); font-weight:700; margin-bottom:10px;}
  .sym-card .sym-row{ display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:10px;}
  .sym-card .sym-side{ text-align:center;}
  .sym-card .sym-side.left{ text-align:right;}
  .sym-card .sym-side .s-lbl{ font-family:var(--mono); font-size:7pt; font-weight:700; color:var(--ink-4); letter-spacing:0.08em;}
  .sym-card .sym-side .s-val{ font-family:var(--serif); font-size:22pt; font-weight:600; letter-spacing:-0.015em; line-height:1; margin-top:3px;}
  .sym-card .sym-div{ width:1px; height:30px; background:var(--line);}
  .sym-card .sym-foot{ margin-top:12px; padding-top:10px; border-top:1px solid var(--line); display:flex; justify-content:space-between; align-items:center;}
  .sym-card .sym-foot .asy{ font-family:var(--mono); font-size:12pt; font-weight:700;}

  .focus-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px;}
  .focus-card{ border:1px solid var(--line); border-radius:4px; padding:10px 14px; display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center; background:#fff; break-inside:avoid;}
  .focus-card .f-name{ font-weight:600; font-size:9.5pt; margin-bottom:6px;}

  .text-block{ background:#fff; border:1px solid var(--line); border-radius:5px; padding:16px 18px;}
  .text-block h4{ font-family:var(--sans); font-size:9pt; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-3); margin:0 0 8px;}
  .text-block p{ margin:0 0 8px; font-size:9.5pt; line-height:1.55;}
  .text-block p:last-child{ margin-bottom:0;}

  .two-col{ display:grid; grid-template-columns:1fr 1.8fr; gap:18px; margin-bottom:14px; align-items:start;}
  .two-col.equal{ grid-template-columns:1fr 1fr;}

  .test-desc{ color:var(--ink-4); font-size:8.5pt; margin-top:3px; max-width:5.2in; line-height:1.35;}
  .keep{ break-inside:avoid; page-break-inside:avoid;}

  /* Assessment section */
  .assess-section-head{ font-family:var(--sans); font-size:9pt; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-3); margin:18px 0 8px; display:flex; align-items:baseline; justify-content:space-between;}
  .assess-section-head .count{ font-family:var(--mono); font-size:8.5pt; color:var(--ink-4); letter-spacing:0.04em;}

  .block-tag-card{ background:#fff; border:1px solid var(--line); border-radius:4px; padding:10px 14px; margin-bottom:10px; display:flex; gap:14px; align-items:center;}
  .block-tag-card .bt-lbl{ font-family:var(--mono); font-size:7.5pt; letter-spacing:0.1em; text-transform:uppercase; color:var(--ink-4); font-weight:700;}
  .block-tag-card .bt-val{ font-size:10pt; font-weight:600; color:var(--ink);}

  .intake-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px;}

  .finding-card{ background:#fff; border:1px solid var(--line); border-radius:5px; padding:12px 14px; margin-bottom:10px;}
  .finding-head{ display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:8px;}
  .finding-name{ font-weight:700; font-size:10pt; color:var(--ink); line-height:1.25;}
  .finding-meta{ font-family:var(--mono); font-size:7.5pt; letter-spacing:0.04em; color:var(--ink-4); margin-top:2px;}

  .def-chips{ display:flex; flex-wrap:wrap; gap:5px;}
  .def-chip{ font-size:8.5pt; padding:3px 8px; background:var(--below-soft); color:var(--below); border:1px solid var(--below); border-radius:3px; font-weight:500;}

  .cat-pill{ display:inline-block; padding:5px 12px; background:var(--ink); color:var(--paper); font-family:var(--mono); font-size:8.5pt; font-weight:700; letter-spacing:0.03em; border-radius:3px;}

  .val-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:8px;}
  .val-cell{ padding:8px 10px; border:1px solid var(--line-2); border-radius:4px; background:#fff;}
  .val-lbl{ font-family:var(--mono); font-size:7pt; letter-spacing:0.06em; text-transform:uppercase; color:var(--ink-4); font-weight:700; margin-bottom:3px;}
  .val-row{ display:flex; align-items:baseline; gap:3px;}
  .val-num{ font-family:var(--serif); font-size:17pt; font-weight:700; color:var(--ink); line-height:1;}
  .val-num.out{ color:var(--below);}
  .val-unit{ font-family:var(--mono); font-size:8.5pt; color:var(--ink-4);}
  .val-norm{ font-family:var(--mono); font-size:7pt; color:var(--ink-4); margin-top:2px;}

  .pf-stamp{ display:inline-block; padding:5px 14px; font-size:10pt; font-weight:700; letter-spacing:0.04em; border-radius:3px; border:1px solid;}
  .pf-stamp.pass{ background:var(--elite-soft); color:var(--elite); border-color:var(--elite);}
  .pf-stamp.fail{ background:var(--below-soft); color:var(--below); border-color:var(--below);}

  .finding-notes{ margin-top:10px; padding-top:8px; border-top:1px solid var(--line);}
  .finding-notes p{ margin:0 0 4px; font-size:9pt; line-height:1.5; color:var(--ink-2); white-space:pre-wrap;}
  .finding-notes p:last-child{ margin-bottom:0;}
</style>
</head>
<body>
`;

// ──────────────────────────────────────────────────────────────────────────────
// Public API: generate PDF
// ──────────────────────────────────────────────────────────────────────────────
export async function generateEditorialPdf(reportData, outputPath, tenant) {
  if (!tenant?.slug || !tenant?.facilityName) {
    throw new Error('generateEditorialPdf requires a tenant object with { slug, facilityName, logoPath }');
  }

  // Synchronous render block. Critical: no await between mutating the branding vars
  // and capturing html + footerTemplate. Once captured as local strings, those locals
  // are immune to any concurrent generateEditorialPdf call mutating the module-level
  // vars before this render's async puppeteer work completes.
  currentLogoImg = buildLogoImg(tenant);
  currentFacilityName = tenant.facilityName;
  const html = renderFullReport(reportData) + '</body></html>';
  const athleteName = reportData.athlete || reportData.name || 'Athlete';
  const footerTemplate = `
      <div style="-webkit-print-color-adjust: exact; print-color-adjust: exact; background: #FAF8F5; font-family: 'Inter Tight', Helvetica, Arial, sans-serif; font-size: 7pt; color: #7C746C; width: 100%; height: 100%; padding: 12px 1in 16px; box-sizing: border-box; display: flex; justify-content: space-between; align-items: center;">
        <div><span style="font-weight: 700; color: #4E4843; letter-spacing: 0.08em; text-transform: uppercase;">${escapeHtml(currentFacilityName)}</span>&nbsp;·&nbsp;Confidential</div>
        <div>${escapeHtml(athleteName)}</div>
        <div style="font-family: 'JetBrains Mono', monospace; letter-spacing: 0.1em;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>
      </div>
    `;

  let browser;
  try {
    console.log(`🚀 Launching headless browser for editorial PDF (tenant: ${tenant.slug})...`);
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluateHandle('document.fonts.ready');

    console.log('💾 Generating PDF...');
    await page.pdf({
      path: outputPath,
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: '0.75in', left: 0 },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate,
    });

    console.log('✅ PDF generated successfully:', outputPath);
  } catch (error) {
    console.error('❌ Error generating editorial PDF:', error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}
