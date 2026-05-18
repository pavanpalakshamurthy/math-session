/**
 * Math For Fun — Parent Dashboard Logic
 * Extracted from parents.html inline script.
 */

// ── Change this to your preferred 4-digit PIN ─────────────────
const PARENT_PIN = '1234';
// ─────────────────────────────────────────────────────────────

const SUBJECTS = [
  { key: 'mathChampions_add', label: 'Addition',       color: '#ea580c' },
  { key: 'mathChampions_sub', label: 'Subtraction',    color: '#7c3aed' },
  { key: 'mathChampions_mul', label: 'Multiplication', color: '#2563eb' },
  { key: 'mathChampions_div', label: 'Division',       color: '#0891b2' },
  { key: 'mathChampions',     label: 'Fractions',      color: '#4f46e5' },
  { key: 'mathChampions_dec', label: 'Decimals',       color: '#059669' },
  { key: 'mathChampions_pct', label: 'Percentages',    color: '#0ea5e9' },
];

// ── PIN ────────────────────────────────────────────────────────
let pinValue = '';

function pinPress(d) {
  if (pinValue.length >= 4) return;
  pinValue += d;
  updateDots();
  if (pinValue.length === 4) setTimeout(checkPin, 140);
}
function pinDelete() {
  pinValue = pinValue.slice(0, -1);
  updateDots();
}
function updateDots() {
  document.querySelectorAll('#pin-dots span').forEach((el, i) => {
    el.classList.toggle('filled', i < pinValue.length);
  });
}
function checkPin() {
  if (pinValue === PARENT_PIN) {
    sessionStorage.setItem('mathParentAuth', '1');
    showDashboard();
  } else {
    const card = document.getElementById('pin-card');
    const err  = document.getElementById('pin-error');
    card.classList.add('shake');
    err.classList.add('show');
    setTimeout(() => card.classList.remove('shake'), 400);
    setTimeout(() => err.classList.remove('show'), 2800);
    pinValue = '';
    updateDots();
  }
}
function logout() {
  sessionStorage.removeItem('mathParentAuth');
  document.getElementById('dashboard').style.display  = 'none';
  document.getElementById('pin-screen').style.display = 'flex';
  pinValue = '';
  updateDots();
}

// ── Data helpers ───────────────────────────────────────────────
function loadAll() {
  return SUBJECTS.map(s => {
    try {
      const raw = localStorage.getItem(s.key);
      const d   = raw ? JSON.parse(raw) : null;
      return { ...s, data: d || { attempts: [], questions: {}, streak: { current: 0, best: 0 } } };
    } catch { return { ...s, data: { attempts: [], questions: {}, streak: { current: 0, best: 0 } } }; }
  });
}
function fmtTime(s) {
  if (!s) return '0m';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Dashboard ──────────────────────────────────────────────────
function showDashboard() {
  document.getElementById('pin-screen').style.display = 'none';
  document.getElementById('dashboard').style.display  = 'block';
  buildDashboard();
}

function buildDashboard() {
  const subjects = loadAll();

  // Summary
  let totalQ = 0, totalSecs = 0, allPcts = [], bestStreak = 0;
  subjects.forEach(s => {
    const att = s.data.attempts || [];
    totalQ += att.length;
    att.forEach(a => { totalSecs += a.secs || 0; allPcts.push(a.pct || 0); });
    bestStreak = Math.max(bestStreak, s.data.streak?.best || 0);
  });
  const avgPct = allPcts.length ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : 0;

  // All attempts sorted by date for line chart
  let allAttempts = [];
  subjects.forEach(s => {
    (s.data.attempts || []).forEach(a => allAttempts.push({ ...a, subColor: s.color, subLabel: s.label }));
  });
  allAttempts.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const recentAtt = allAttempts.slice(-15);

  // Weak questions
  let weak = [];
  subjects.forEach(s => {
    Object.entries(s.data.questions || {}).forEach(([idx, v]) => {
      if (v.missed > 0) weak.push({ subLabel: s.label, subColor: s.color, idx: +idx, missed: v.missed, seen: v.seen });
    });
  });
  weak.sort((a, b) => b.missed / b.seen - a.missed / a.seen);
  weak = weak.slice(0, 6);

  const container = document.getElementById('dash-main');
  container.innerHTML = `
    <div class="section-title">Overview</div>
    <div class="stat-row">
      <div class="dash-stat-card"><div class="stat-val">${totalQ}</div><div class="stat-lbl">Quizzes Taken</div></div>
      <div class="dash-stat-card"><div class="stat-val">${avgPct}%</div><div class="stat-lbl">Overall Average</div></div>
      <div class="dash-stat-card"><div class="stat-val">${bestStreak}</div><div class="stat-lbl">Best Streak (days)</div></div>
      <div class="dash-stat-card"><div class="stat-val">${fmtTime(totalSecs)}</div><div class="stat-lbl">Time Practised</div></div>
    </div>

    <div class="section-gap"></div>
    <div class="section-title">Performance Charts</div>
    <div class="chart-row">
      <div class="chart-card">
        <div class="chart-card-title">Best Score by Subject</div>
        <canvas id="c-bar"></canvas>
        <div class="empty-chart" id="e-bar">No quiz data yet — start a quiz!</div>
      </div>
      <div class="chart-card">
        <div class="chart-card-title">Score Trend (last 15 attempts)</div>
        <canvas id="c-line"></canvas>
        <div class="empty-chart" id="e-line">No quiz data yet!</div>
        <div class="legend" id="line-legend"></div>
      </div>
    </div>

    <div class="section-gap"></div>
    <div class="section-title">By Subject</div>
    <div class="subject-grid" id="subject-grid"></div>

    ${weak.length ? `
    <div class="section-gap"></div>
    <div class="section-title">Questions to Practise More</div>
    <ul class="parents-weak-list" id="weak-list"></ul>` : ''}
  `;

  // Subject cards
  const grid = document.getElementById('subject-grid');
  subjects.forEach(s => {
    const att     = s.data.attempts || [];
    const best    = att.length ? Math.max(...att.map(a => a.pct || 0)) : null;
    const avg     = att.length ? Math.round(att.reduce((t, a) => t + (a.pct || 0), 0) / att.length) : null;
    const time    = att.reduce((t, a) => t + (a.secs || 0), 0);
    const bestAtt = att.length ? att.reduce((b, a) => a.pct > b.pct ? a : b) : null;

    const lvlBars = bestAtt ? ['easy', 'medium', 'hard'].map(lvl => {
      const max = lvl === 'easy' ? 5 : lvl === 'medium' ? 10 : 15;
      const got = bestAtt.byLevel?.[lvl] || 0;
      const pct = Math.round(got / max * 100);
      const col = lvl === 'easy' ? '#16a34a' : lvl === 'medium' ? '#d97706' : '#dc2626';
      return `<div class="diff-line">
        <span class="diff-label">${lvl.charAt(0).toUpperCase() + lvl.slice(1)}</span>
        <div class="diff-track"><div class="diff-fill" style="width:${pct}%;background:${col}"></div></div>
        <span class="diff-pct">${got}/${max}</span>
      </div>`;
    }).join('') : '';

    const card = document.createElement('div');
    card.className = 'subject-card';
    card.innerHTML = `
      <div class="subject-card-bar" style="background:${s.color}"></div>
      <div class="subject-card-body">
        <div class="subject-name" style="color:${s.color}">${s.label}</div>
        ${att.length === 0
          ? `<div class="not-started">Not started yet</div>`
          : `<div class="subject-stats">
               <div class="subject-stat"><div class="sv">${att.length}</div><div class="sl">Quizzes</div></div>
               <div class="subject-stat"><div class="sv" style="color:${s.color}">${best}%</div><div class="sl">Best</div></div>
               <div class="subject-stat"><div class="sv">${avg}%</div><div class="sl">Average</div></div>
               <div class="subject-stat"><div class="sv">${fmtTime(time)}</div><div class="sl">Time</div></div>
             </div>
             ${lvlBars ? `<div class="diff-row">${lvlBars}</div>` : ''}`
        }
      </div>`;
    grid.appendChild(card);
  });

  // Weak list
  if (weak.length) {
    const wl = document.getElementById('weak-list');
    weak.forEach(w => {
      const li = document.createElement('li');
      li.className = 'parents-weak-item';
      li.innerHTML = `
        <span class="weak-badge" style="background:${w.subColor}">${w.subLabel}</span>
        <span class="weak-num">Question ${w.idx + 1}</span>
        <span class="weak-miss">missed ${w.missed} / ${w.seen} attempts</span>`;
      wl.appendChild(li);
    });
  }

  // Charts after DOM settles
  requestAnimationFrame(() => {
    drawBar(subjects);
    drawLine(recentAtt);
  });
}

// ── Bar chart ──────────────────────────────────────────────────
function drawBar(subjects) {
  const canvas  = document.getElementById('c-bar');
  const hasData = subjects.some(s => s.data.attempts?.length);
  if (!hasData) {
    canvas.style.display = 'none';
    document.getElementById('e-bar').style.display = 'block';
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const CW  = canvas.parentElement.clientWidth - 48;
  const CH  = 240;
  canvas.style.cssText = `width:${CW}px;height:${CH}px;display:block;`;
  canvas.width  = CW * dpr;
  canvas.height = CH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const pL = 108, pR = 48, pT = 18, pB = 26;
  const w  = CW - pL - pR;
  const h  = CH - pT - pB;
  const bH = Math.floor(h / subjects.length) - 7;

  // Gridlines + x-axis labels
  ctx.font = '500 10px Segoe UI, system-ui, sans-serif';
  [0, 25, 50, 75, 100].forEach(pct => {
    const x = pL + (pct / 100) * w;
    ctx.strokeStyle = pct === 0 ? '#cbd5e1' : '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x, pT - 4); ctx.lineTo(x, pT + h); ctx.stroke();
    if (pct > 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(pct + '%', x, pT + h + 6);
    }
  });

  // 90% champion line
  const x90 = pL + 0.9 * w;
  ctx.strokeStyle = '#f59e0b88';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(x90, pT); ctx.lineTo(x90, pT + h); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#f59e0b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = '600 9px Segoe UI, system-ui, sans-serif';
  ctx.fillText('🏆 90%', x90, pT - 2);

  // Bars
  subjects.forEach((s, i) => {
    const att  = s.data.attempts || [];
    const best = att.length ? Math.max(...att.map(a => a.pct || 0)) : 0;
    const y    = pT + i * (bH + 7) + 3;

    ctx.font = '600 11px Segoe UI, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#475569';
    ctx.fillText(s.label, pL - 8, y + bH / 2);

    ctx.fillStyle = '#f1f5f9';
    rr(ctx, pL, y, w, bH, 4); ctx.fill();

    if (att.length === 0) {
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.font = '500 10px Segoe UI, system-ui, sans-serif';
      ctx.fillText('Not started', pL + 7, y + bH / 2);
      return;
    }

    const fw = Math.max(4, (best / 100) * w);
    ctx.fillStyle = s.color;
    rr(ctx, pL, y, fw, bH, 4); ctx.fill();

    ctx.font = '700 11px Segoe UI, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    if (fw > 36) {
      ctx.fillStyle = 'white';
      ctx.textAlign = 'right';
      ctx.fillText(best + '%', pL + fw - 7, y + bH / 2);
    } else {
      ctx.fillStyle = s.color;
      ctx.textAlign = 'left';
      ctx.fillText(best + '%', pL + fw + 5, y + bH / 2);
    }
  });
}

// ── Line chart ─────────────────────────────────────────────────
function drawLine(recent) {
  const canvas = document.getElementById('c-line');
  if (!recent.length) {
    canvas.style.display = 'none';
    document.getElementById('e-line').style.display = 'block';
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const CW  = canvas.parentElement.clientWidth - 48;
  const CH  = 240;
  canvas.style.cssText = `width:${CW}px;height:${CH}px;display:block;`;
  canvas.width  = CW * dpr;
  canvas.height = CH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const pL = 34, pR = 14, pT = 22, pB = 30;
  const w  = CW - pL - pR;
  const h  = CH - pT - pB;
  const n  = recent.length;

  const pts = recent.map((a, i) => ({
    x: pL + (n === 1 ? w / 2 : (i / (n - 1)) * w),
    y: pT + h - ((a.pct || 0) / 100) * h,
    pct: a.pct || 0, color: a.subColor, label: a.subLabel, date: a.date,
  }));

  // Y gridlines
  ctx.font = '500 10px Segoe UI, system-ui, sans-serif';
  [0, 25, 50, 75, 100].forEach(pct => {
    const y = pT + h - (pct / 100) * h;
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(pL + w, y); ctx.stroke();
    ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(pct + '%', pL - 5, y);
  });

  // 90% line
  const y90 = pT + h * 0.1;
  ctx.strokeStyle = '#f59e0b88'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(pL, y90); ctx.lineTo(pL + w, y90); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#f59e0b'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.font = '600 9px Segoe UI, system-ui, sans-serif';
  ctx.fillText('Champion 90%', pL + 3, y90 - 2);

  // Area fill
  if (pts.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pT + h);
    ctx.lineTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const cp = (pts[i - 1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(cp, pts[i - 1].y, cp, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.lineTo(pts[pts.length - 1].x, pT + h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pT, 0, pT + h);
    grad.addColorStop(0, 'rgba(79,70,229,0.12)');
    grad.addColorStop(1, 'rgba(79,70,229,0.01)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Lines (coloured per segment)
  for (let i = 1; i < pts.length; i++) {
    const cp = (pts[i - 1].x + pts[i].x) / 2;
    const lg = ctx.createLinearGradient(pts[i - 1].x, 0, pts[i].x, 0);
    lg.addColorStop(0, pts[i - 1].color);
    lg.addColorStop(1, pts[i].color);
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.bezierCurveTo(cp, pts[i - 1].y, cp, pts[i].y, pts[i].x, pts[i].y);
    ctx.strokeStyle = lg; ctx.lineWidth = 2.5; ctx.setLineDash([]);
    ctx.stroke();
  }

  // Dots
  pts.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = p.color; ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
  });

  // X labels
  ctx.fillStyle = '#94a3b8'; ctx.font = '500 9px Segoe UI, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  pts.forEach((p, i) => {
    if (i === 0 || i === pts.length - 1 || i % 4 === 0) {
      const lbl = recent[i].date ? recent[i].date.slice(5) : `#${i + 1}`;
      ctx.fillText(lbl, p.x, pT + h + 6);
    }
  });

  // Legend
  const seenLabels = new Set();
  const legendEl   = document.getElementById('line-legend');
  if (legendEl) {
    legendEl.innerHTML = recent
      .filter(a => { if (seenLabels.has(a.subLabel)) return false; seenLabels.add(a.subLabel); return true; })
      .map(a => `<div class="legend-item"><div class="legend-dot" style="background:${a.subColor}"></div>${a.subLabel}</div>`)
      .join('');
  }
}

// ── Rounded rect helper ────────────────────────────────────────
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

// ── Boot ───────────────────────────────────────────────────────
if (sessionStorage.getItem('mathParentAuth') === '1') {
  showDashboard();
}
