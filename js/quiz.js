/**
 * Math For Fun — Quiz Engine
 *
 * Reads ?subject=<id> from the URL, fetches data/<id>.json,
 * applies per-subject theming, and runs the quiz.
 *
 * NOTE: fetch() requires an HTTP server — open with:
 *   python3 -m http.server
 * then visit http://localhost:8000/quiz.html?subject=addition
 *
 * File:// URLs will cause CORS errors on fetch().
 */

// ── Subject metadata (colours, labels, storage keys) ──────────
// These values are duplicated from data/subjects.json for quick
// access without an extra network request.
const SUBJECT_META = {
  addition:       { label: 'Addition',       subtitle: 'Surprising Sums Ahead!',         primaryColor: '#ea580c', gradientEnd: '#e11d48', storageKey: 'mathChampions_add' },
  subtraction:    { label: 'Subtraction',    subtitle: 'Watch Out for the Traps!',        primaryColor: '#7c3aed', gradientEnd: '#db2777', storageKey: 'mathChampions_sub' },
  multiplication: { label: 'Multiplication', subtitle: 'Surprising Results Ahead!',       primaryColor: '#2563eb', gradientEnd: '#7c3aed', storageKey: 'mathChampions_mul' },
  division:       { label: 'Division',       subtitle: 'Think Carefully!',                primaryColor: '#0891b2', gradientEnd: '#059669', storageKey: 'mathChampions_div' },
  fractions:      { label: 'Fractions & LCM',subtitle: 'Find the Common Ground!',        primaryColor: '#4f46e5', gradientEnd: '#7c3aed', storageKey: 'mathChampions'     },
  decimals:       { label: 'Decimals',       subtitle: 'Decimals Word Problems',          primaryColor: '#059669', gradientEnd: '#0891b2', storageKey: 'mathChampions_dec' },
  percentages:    { label: 'Percentages',    subtitle: 'Percentages Word Problems',       primaryColor: '#0ea5e9', gradientEnd: '#6366f1', storageKey: 'mathChampions_pct' },
};

// ── Parse subject from URL ─────────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const subjectId = params.get('subject') || 'fractions';
const meta    = SUBJECT_META[subjectId] || SUBJECT_META['fractions'];
const STORAGE_KEY = meta.storageKey;

// ── Apply theming via CSS custom properties ────────────────────
document.documentElement.style.setProperty('--primary', meta.primaryColor);
document.documentElement.style.setProperty('--primary-end', meta.gradientEnd);

// Apply gradient to quiz header directly (since it uses both colours)
const quizHeader = document.querySelector('.quiz-header');
if (quizHeader) {
  quizHeader.style.background = `linear-gradient(135deg, ${meta.primaryColor} 0%, ${meta.gradientEnd} 100%)`;
}

// ── Inject subject label into header ──────────────────────────
const titleEl    = document.getElementById('quiz-title');
const subtitleEl = document.getElementById('quiz-subtitle');
if (titleEl)    titleEl.textContent    = '🎉 Math For Fun';
if (subtitleEl) subtitleEl.textContent = `${meta.label} — ${meta.subtitle}`;

// ── Quiz state ─────────────────────────────────────────────────
let questions      = [];
let current        = 0;
let shuffledChoices = [];
let quizStartTime  = Date.now();
let quizQResults   = [];
let scoreCorrect   = 0;
let scoreWrong     = 0;
let scoreDone      = 0;
let timerInterval  = null;
let timerSeconds   = 0;

// ── localStorage helpers ───────────────────────────────────────
const EMPTY_STATS = () => ({ attempts: [], questions: {}, streak: { current: 0, best: 0, lastDate: null } });
function loadStats() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || EMPTY_STATS(); }
  catch { return EMPTY_STATS(); }
}
function saveStats(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

// ── Score UI ───────────────────────────────────────────────────
function updateScore() {
  const total = questions.length || 30;
  document.getElementById('score-correct').textContent = scoreCorrect;
  document.getElementById('score-wrong').textContent   = scoreWrong;
  document.getElementById('score-done').textContent    = scoreDone;
  document.getElementById('score-total').textContent   = total;
  document.getElementById('progress-bar').style.width  = (scoreDone / total * 100) + '%';
  document.getElementById('progress-label').textContent =
    current < total ? `Question ${current + 1} of ${total}` : 'All done!';
}

// ── Render one question ────────────────────────────────────────
function renderQuestion(idx) {
  const q = questions[idx];
  const total = questions.length;
  shuffledChoices = [...q.choices].sort(() => Math.random() - 0.5);
  document.getElementById('progress-label').textContent = `Question ${idx + 1} of ${total}`;

  const hintHtml = q.hint
    ? `<div class="q-hint">💡 Hint: ${q.hint}</div>`
    : '';

  document.getElementById('main').innerHTML = `
    <div class="card">
      <div class="card-top">
        <span class="q-counter">Question ${idx + 1} of ${total}</span>
        <span class="badge badge-${q.level}">${q.level}</span>
      </div>
      <div class="q-text">${q.text}</div>
      ${hintHtml}
      <div class="choices" id="choices">
        ${shuffledChoices.map((c, i) =>
          `<button class="choice-btn" id="btn-${i}" onclick="handleChoice(${i})">${c}</button>`
        ).join('')}
      </div>
      <div class="feedback"    id="feedback"></div>
      <div class="explanation" id="explanation"></div>
      <button class="next-btn" id="next-btn" onclick="goNext()">
        ${idx + 1 < total ? 'Next Question →' : 'See My Results'}
      </button>
    </div>`;
}

// ── Handle a choice ────────────────────────────────────────────
function handleChoice(btnIdx) {
  const q        = questions[current];
  const chosen   = shuffledChoices[btnIdx];
  const feedback = document.getElementById('feedback');
  const explEl   = document.getElementById('explanation');
  const nextBtn  = document.getElementById('next-btn');
  const btn      = document.getElementById(`btn-${btnIdx}`);

  const isEquivalent = q.equivalents && q.equivalents.includes(chosen);
  const isCorrect    = chosen === q.answer || isEquivalent;

  if (isCorrect) {
    quizQResults[current] = 'first';
    btn.classList.add('state-correct');
    disableAll();
    feedback.textContent = isEquivalent
      ? `🎉 Correct! ${chosen} equals ${q.answer} — great thinking!`
      : '🎉 Correct! Fantastic work!';
    feedback.className = 'feedback show correct';
    showExplanation(explEl, q.explanation);
    nextBtn.classList.add('show');
    scoreCorrect++;
    scoreDone++;
    updateScore();
  } else {
    quizQResults[current] = 'missed';
    btn.classList.add('state-wrong');
    disableAll();
    revealCorrect(q.answer);
    feedback.textContent = `❌ The correct answer is: ${q.answer}`;
    feedback.className = 'feedback show wrong';
    showExplanation(explEl, q.explanation);
    nextBtn.classList.add('show');
    scoreWrong++;
    scoreDone++;
    updateScore();
  }
}

// ── Helpers ────────────────────────────────────────────────────
function showExplanation(el, html) {
  el.innerHTML = `<div class="explanation-title">🧮 Here's how to solve it!</div><div class="explanation-body">${html}</div>`;
  el.className = 'explanation show';
}
function disableAll() { document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true); }
function revealCorrect(answer) {
  shuffledChoices.forEach((c, i) => {
    if (c === answer) document.getElementById(`btn-${i}`).classList.add('state-reveal');
  });
}
function goNext() {
  current++;
  if (current >= questions.length) showFinalScreen();
  else renderQuestion(current);
}

// ── Final screen ───────────────────────────────────────────────
function showFinalScreen() {
  stopTimer();
  saveAttempt();
  const total      = questions.length;
  document.getElementById('progress-label').textContent = 'All done!';
  const pct        = Math.round((scoreCorrect / total) * 100);
  const timeStr    = formatTime(timerSeconds);
  const isChampion = pct >= 90;
  const tallyTime  = `<div class="tally-box"><div class="num">${timeStr}</div><div class="lbl">Time</div></div>`;

  if (isChampion) {
    document.getElementById('main').innerHTML = `
      <div class="final-screen championship-wrap">
        <span class="trophy-cup">🏆</span>
        <div class="champion-title">MATH CHAMPION!</div>
        <div class="champion-subtitle">Incredible — you got ${scoreCorrect} out of ${total} correct!</div>
        <div class="final-tally">
          <div class="tally-box green"><div class="num">${scoreCorrect}</div><div class="lbl">Correct</div></div>
          <div class="tally-box red"><div class="num">${scoreWrong}</div><div class="lbl">Wrong</div></div>
          <div class="tally-box"><div class="num">${pct}%</div><div class="lbl">Score</div></div>
          ${tallyTime}
        </div>
        <button class="restart-btn" onclick="restartQuiz()">🔄 Play Again</button>
      </div>`;
    launchFireworks();
  } else {
    const emoji = pct >= 70 ? '⭐' : pct >= 50 ? '👍' : '💪';
    const msg   = pct >= 70 ? 'Great job! Keep practising!'
                : pct >= 50 ? 'Good effort! You can do even better!'
                : 'Keep going — practice makes perfect!';
    document.getElementById('main').innerHTML = `
      <div class="final-screen">
        <h2>${emoji} Quiz Complete!</h2>
        <p>${msg}</p>
        <div class="final-tally">
          <div class="tally-box green"><div class="num">${scoreCorrect}</div><div class="lbl">Correct</div></div>
          <div class="tally-box red"><div class="num">${scoreWrong}</div><div class="lbl">Wrong</div></div>
          <div class="tally-box"><div class="num">${pct}%</div><div class="lbl">Score</div></div>
          ${tallyTime}
        </div>
        <button class="restart-btn" onclick="restartQuiz()">🔄 Try Again</button>
      </div>`;
  }
}

// ── Fireworks ──────────────────────────────────────────────────
function launchFireworks() {
  const canvas = document.createElement('canvas');
  canvas.id = 'fireworks-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);
  const COLORS = ['#f59e0b','#ef4444','#8b5cf6','#3b82f6','#10b981','#f97316','#ec4899','#facc15'];
  const particles = [];
  function Particle(x, y) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 7 + 2;
    return { x, y, color,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      radius: Math.random() * 3 + 1.5, alpha: 1,
      decay: Math.random() * 0.018 + 0.008, gravity: 0.12 };
  }
  function burst(x, y) { for (let i = 0; i < 70; i++) particles.push(Particle(x, y)); }
  let fired = 0;
  const pos = () => [
    Math.random() * canvas.width  * 0.7 + canvas.width  * 0.15,
    Math.random() * canvas.height * 0.55 + canvas.height * 0.05,
  ];
  [0,300,600,900,1200,1600,2000,2400,2800,3200,3600,4000,4400,4800].forEach(d =>
    setTimeout(() => { const [x, y] = pos(); burst(x, y); fired++; }, d));
  let animId;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += p.gravity; p.x += p.vx; p.y += p.vy; p.alpha -= p.decay;
      if (p.alpha <= 0) { particles.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (fired < 14 || particles.length > 0) animId = requestAnimationFrame(animate);
    else { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); canvas.remove(); }
  }
  animate();
}

// ── Save attempt to localStorage ───────────────────────────────
function saveAttempt() {
  const stats = loadStats();
  const total = questions.length;
  const pct   = Math.round((scoreCorrect / total) * 100);
  const secs  = Math.round((Date.now() - quizStartTime) / 1000);
  const byLevel = { easy: 0, medium: 0, hard: 0 };
  quizQResults.forEach((r, i) => { if (r === 'first') byLevel[questions[i].level]++; });
  stats.attempts.push({ date: new Date().toISOString().slice(0, 10), score: scoreCorrect, pct, secs, byLevel });
  if (stats.attempts.length > 50) stats.attempts = stats.attempts.slice(-50);
  quizQResults.forEach((r, i) => {
    if (!r) return;
    const k = String(i);
    if (!stats.questions[k]) stats.questions[k] = { seen: 0, firstTry: 0, missed: 0 };
    stats.questions[k].seen++;
    if (r === 'first')  stats.questions[k].firstTry++;
    if (r === 'missed') stats.questions[k].missed++;
  });
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if      (stats.streak.lastDate === today)      { /* already practiced */ }
  else if (stats.streak.lastDate === yesterday)  { stats.streak.current++; }
  else                                           { stats.streak.current = 1; }
  stats.streak.best     = Math.max(stats.streak.best, stats.streak.current);
  stats.streak.lastDate = today;
  saveStats(stats);
}

// ── Progress panel ─────────────────────────────────────────────
function showProgressPanel() {
  const stats  = loadStats();
  const att    = stats.attempts;
  const total  = att.length;
  const bestPct = total ? Math.max(...att.map(a => a.pct)) : 0;
  const avgPct  = total ? Math.round(att.reduce((s, a) => s + a.pct, 0) / total) : 0;
  const streak  = stats.streak;
  const recent  = att.slice(-10);

  const barsHtml = recent.map(a =>
    `<div class="bar-col">
      <span class="bar-pct-lbl">${a.pct}%</span>
      <div class="bar-fill ${a.pct >= 90 ? 'bar-champion' : ''}" style="height:${a.pct}%"></div>
    </div>`).join('');

  const best = total ? att.reduce((b, a) => a.pct > b.pct ? a : b) : null;
  // Compute max per level from actual questions array
  const levelCounts = { easy: 0, medium: 0, hard: 0 };
  questions.forEach(q => { levelCounts[q.level] = (levelCounts[q.level] || 0) + 1; });

  const levelHtml = best ? ['easy', 'medium', 'hard'].map(lvl => {
    const max   = levelCounts[lvl] || 1;
    const got   = best.byLevel[lvl] || 0;
    const pct   = Math.round(got / max * 100);
    const color = lvl === 'easy' ? 'var(--easy)' : lvl === 'medium' ? 'var(--medium)' : 'var(--hard)';
    return `<div class="level-row">
      <span class="level-row-label" style="color:${color}">${lvl.charAt(0).toUpperCase() + lvl.slice(1)}</span>
      <div class="level-track"><div class="level-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="level-pct">${got}/${max}</span>
    </div>`;
  }).join('') : '';

  const weakQ = Object.entries(stats.questions)
    .filter(([, v]) => v.seen >= 2 && v.missed > 0)
    .sort(([, a], [, b]) => (b.missed / b.seen) - (a.missed / a.seen))
    .slice(0, 4);
  const weakHtml = weakQ.map(([idx, v]) => {
    const q     = questions[parseInt(idx)];
    const short = q.text.length > 65 ? q.text.substring(0, 65) + '…' : q.text;
    return `<li class="weak-item"><span style="flex:1">${short}</span><span class="miss-badge">missed ${v.missed}/${v.seen}</span></li>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.className = 'progress-panel';
  overlay.id        = 'progress-panel-overlay';
  overlay.innerHTML = `
    <div class="progress-panel-inner">
      <div class="panel-header">
        <span class="panel-title">📊 My Progress — ${meta.label}</span>
        <button class="panel-close" onclick="closeProgressPanel()">✕</button>
      </div>
      <div class="streak-card">
        <span class="streak-fire">🔥</span>
        <div>
          <div class="streak-num">${streak.current} day${streak.current !== 1 ? 's' : ''}</div>
          <div class="streak-lbl">Current streak &nbsp;·&nbsp; Best: ${streak.best} day${streak.best !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="s-num">${total}</div><div class="s-lbl">Quizzes</div></div>
        <div class="stat-card"><div class="s-num">${bestPct}%</div><div class="s-lbl">Best Score</div></div>
        <div class="stat-card"><div class="s-num">${avgPct}%</div><div class="s-lbl">Average</div></div>
      </div>
      ${total === 0 ? '<div class="empty-state">Complete your first quiz to see stats here! 🎯</div>' : ''}
      ${recent.length ? `<div class="panel-section-title">Recent Attempts</div><div class="bar-chart">${barsHtml}</div>` : ''}
      ${best ? `<div class="panel-section-title">Best Attempt — By Difficulty</div><div class="level-bars">${levelHtml}</div>` : ''}
      ${weakHtml ? `<div class="panel-section-title">Questions to Practise More</div><ul class="weak-list">${weakHtml}</ul>` : ''}
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeProgressPanel(); });
  document.body.appendChild(overlay);
}
function closeProgressPanel() { document.getElementById('progress-panel-overlay')?.remove(); }

// ── Timer ──────────────────────────────────────────────────────
function startTimer() {
  timerSeconds = 0;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => { timerSeconds++; }, 1000);
}
function stopTimer()     { clearInterval(timerInterval); }
function formatTime(s)   { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

// ── Restart ────────────────────────────────────────────────────
function restartQuiz() {
  current       = 0;
  scoreCorrect  = 0;
  scoreWrong    = 0;
  scoreDone     = 0;
  quizQResults  = new Array(questions.length).fill(null);
  quizStartTime = Date.now();
  updateScore();
  startTimer();
  renderQuestion(0);
}

// ── Boot: fetch questions then start ──────────────────────────
fetch(`data/${subjectId}.json`)
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then(data => {
    questions    = data;
    quizQResults = new Array(questions.length).fill(null);
    updateScore();
    startTimer();
    renderQuestion(0);
  })
  .catch(err => {
    document.getElementById('main').innerHTML = `
      <div class="card" style="text-align:center;padding:2rem;">
        <p style="font-size:1.1rem;color:#dc2626;font-weight:700;">⚠️ Could not load quiz data.</p>
        <p style="margin-top:0.8rem;color:#64748b;font-size:0.9rem;">
          This app needs an HTTP server. Run:<br>
          <code style="background:#f1f5f9;padding:0.2rem 0.5rem;border-radius:4px;">python3 -m http.server</code><br>
          then open <code>http://localhost:8000/quiz.html?subject=${subjectId}</code>
        </p>
        <p style="margin-top:0.6rem;color:#94a3b8;font-size:0.8rem;">Error: ${err.message}</p>
      </div>`;
  });
