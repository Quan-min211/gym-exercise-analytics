/**
 * progress.js — Progress Charts page logic
 *
 * Reads workout data from localStorage (fitdata_workout_logs).
 * Renders:
 *   1. Volume & Sets charts (line / bar — Chart.js)
 *   2. PR Timeline per exercise (line chart)
 *   3. Consistency heatmap (custom SVG/DOM — GitHub calendar style)
 *   4. Muscle volume distribution (bar + donut — Chart.js)
 */

import { getWorkoutLogs, estimate1RM, getAllPRs } from './workout-logger.js';
import { renderMuscleHeatmap } from './muscle-map.js';


// ---------------------------------------------------------------------------
// Chart.js global defaults (Iron Plate theme)
// ---------------------------------------------------------------------------

const ROOT = document.documentElement;
const cssVar = (name) => getComputedStyle(ROOT).getPropertyValue(name).trim();

function applyChartDefaults() {
  if (!window.Chart) return;
  const { Chart } = window;

  Chart.defaults.color          = cssVar('--color-text-muted') || '#8892a4';
  Chart.defaults.borderColor    = cssVar('--color-border')     || '#2a2f3d';
  Chart.defaults.font.family    = cssVar('--font-body')        || 'Inter, sans-serif';
  Chart.defaults.font.size      = 11;
  Chart.defaults.plugins.legend.labels.boxWidth  = 10;
  Chart.defaults.plugins.legend.labels.padding   = 14;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(17,19,24,0.92)';
  Chart.defaults.plugins.tooltip.titleColor      = '#ffffff';
  Chart.defaults.plugins.tooltip.bodyColor       = '#8892a4';
  Chart.defaults.plugins.tooltip.borderColor     = cssVar('--color-border') || '#2a2f3d';
  Chart.defaults.plugins.tooltip.borderWidth     = 1;
  Chart.defaults.plugins.tooltip.padding         = 10;
  Chart.defaults.plugins.tooltip.cornerRadius    = 8;
}

const ACCENT       = '#D32F2F';
const ACCENT_LIGHT = 'rgba(211,47,47,0.15)';
const AMBER        = '#FFC107';
const AMBER_LIGHT  = 'rgba(255,193,7,0.15)';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toDateStr(iso) { return iso ? iso.slice(0, 10) : ''; }

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function filterByPeriod(logs, period) {
  if (period === 'all') return logs;
  const cutoff = daysAgo(Number(period));
  return logs.filter(l => new Date(l.date) >= cutoff);
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

function initTabs() {
  const tabs   = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t   => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => p.classList.remove('is-active'));

      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');

      const target = document.getElementById(btn.getAttribute('aria-controls'));
      if (target) target.classList.add('is-active');
    });
  });
}

// ---------------------------------------------------------------------------
// Period pill wiring (shared across tabs)
// ---------------------------------------------------------------------------

const _activePeriod = { volume: 30, sets: 30, muscles: 30, 'heatmap-muscles': 30 };

function initPeriodPills() {
  document.querySelectorAll('.period-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const chartKey = pill.dataset.chart;
      const period   = pill.dataset.period;

      // Update active state within the same group
      pill.closest('.period-pills')
          .querySelectorAll('.period-pill')
          .forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');

      _activePeriod[chartKey] = period;

      if (chartKey === 'volume') renderVolumeChart();
      if (chartKey === 'sets')   renderSetsChart();
      if (chartKey === 'muscles') renderMuscleCharts();
      if (chartKey === 'heatmap-muscles') renderMuscleVolumeHeatmap();
    });
  });
}

// ---------------------------------------------------------------------------
// Chart instances (kept so we can destroy/re-create)
// ---------------------------------------------------------------------------

const _charts = {};

function destroyChart(key) {
  if (_charts[key]) { _charts[key].destroy(); delete _charts[key]; }
}

// ---------------------------------------------------------------------------
// 1. Volume Chart (line)
// ---------------------------------------------------------------------------

function renderVolumeChart() {
  destroyChart('volume');
  const logs = filterByPeriod(getWorkoutLogs(), _activePeriod.volume);

  const canvas = document.getElementById('volume-chart');
  if (!canvas || !window.Chart) return;

  if (logs.length === 0) {
    showEmpty(canvas, 'No data for this period.');
    return;
  }

  const sorted = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = sorted.map(l => fmtDate(l.date));
  const data   = sorted.map(l => l.totalVolume || 0);

  // Running cumulative max (for area reference)
  const maxVol = Math.max(...data);

  _charts.volume = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Volume (kg)',
        data,
        borderColor: ACCENT,
        backgroundColor: (ctx) => {
          const grad = ctx.chart.ctx.createLinearGradient(0, 0, 0, 280);
          grad.addColorStop(0, 'rgba(211,47,47,0.35)');
          grad.addColorStop(1, 'rgba(211,47,47,0.00)');
          return grad;
        },
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: data.length > 30 ? 2 : 4,
        pointHoverRadius: 6,
        pointBackgroundColor: ACCENT,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { maxTicksLimit: 10 },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          beginAtZero: true,
          ticks: {
            callback: v => v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${v}kg`,
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.y.toLocaleString()} kg`,
            afterLabel: ctx => {
              const session = sorted[ctx.dataIndex];
              return ` ${session.totalSets} sets · ${session.title || 'Workout'}`;
            },
          },
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 2. Sets Chart (bar)
// ---------------------------------------------------------------------------

function renderSetsChart() {
  destroyChart('sets');
  const logs = filterByPeriod(getWorkoutLogs(), _activePeriod.sets);

  const canvas = document.getElementById('sets-chart');
  if (!canvas || !window.Chart) return;

  if (logs.length === 0) { showEmpty(canvas, 'No data.'); return; }

  const sorted = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = sorted.map(l => fmtDate(l.date));
  const data   = sorted.map(l => l.totalSets || 0);

  _charts.sets = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Sets',
        data,
        backgroundColor: ACCENT_LIGHT,
        borderColor: ACCENT,
        borderWidth: 1.5,
        borderRadius: 4,
        hoverBackgroundColor: ACCENT,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} sets` } },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 3. PR Timeline
// ---------------------------------------------------------------------------

function initPRSelect() {
  const select = document.getElementById('pr-exercise-select');
  if (!select) return;

  // Collect all unique exercises from logs
  const logs = getWorkoutLogs();
  const exMap = new Map();

  logs.forEach(session => {
    (session.exercises || []).forEach(ex => {
      if (ex.exerciseId && !exMap.has(ex.exerciseId)) {
        exMap.set(ex.exerciseId, ex.exerciseName || ex.exerciseId);
      }
    });
  });

  if (exMap.size === 0) {
    select.innerHTML = '<option value="">No exercises logged yet</option>';
    return;
  }

  const sorted = [...exMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  select.innerHTML = '<option value="">— Choose an exercise —</option>' +
    sorted.map(([id, name]) => `<option value="${id}">${name}</option>`).join('');

  select.addEventListener('change', () => renderPRChart(select.value));

  // Also render PR Hall Leaderboard table
  renderPRHall();
}

let _currentPRSort = '1rm';
let _prHallInited = false;

function renderPRHall() {
  const tbody = document.getElementById('pr-hall-tbody');
  const empty = document.getElementById('pr-hall-empty');
  const searchInput = document.getElementById('pr-hall-search');
  if (!tbody) return;

  const allPRs = getAllPRs();

  if (!_prHallInited) {
    _prHallInited = true;
    if (searchInput) {
      searchInput.addEventListener('input', () => renderPRHall());
    }
    document.querySelectorAll('[data-pr-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-pr-sort]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        _currentPRSort = btn.dataset.prSort;
        renderPRHall();
      });
    });
  }

  const query = (searchInput?.value || '').trim().toLowerCase();
  let filtered = allPRs;
  if (query) {
    filtered = allPRs.filter(p =>
      p.exerciseName.toLowerCase().includes(query) ||
      (p.target && p.target.toLowerCase().includes(query)) ||
      (p.bodyPart && p.bodyPart.toLowerCase().includes(query))
    );
  }

  // Sort
  if (_currentPRSort === '1rm') {
    filtered.sort((a, b) => b.bestEst1RM - a.bestEst1RM);
  } else if (_currentPRSort === 'date') {
    filtered.sort((a, b) => new Date(b.best1RMDate || b.maxWeightDate || 0) - new Date(a.best1RMDate || a.maxWeightDate || 0));
  } else if (_currentPRSort === 'name') {
    filtered.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = filtered.map((pr, idx) => {
    const rank = idx + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
    const dateStr = pr.best1RMDate ? fmtDate(pr.best1RMDate) : fmtDate(pr.maxWeightDate);
    const link = pr.exerciseId ? `<a href="/exercise.html?id=${pr.exerciseId}" class="text-accent" style="text-decoration:none;font-weight:bold;">${pr.exerciseName}</a>` : `<strong>${pr.exerciseName}</strong>`;

    return `
      <tr>
        <td class="pr-rank-cell">${medal}</td>
        <td>${link}</td>
        <td><span class="tag tag-neutral" style="font-size:10px;">${pr.target || pr.bodyPart || '—'}</span></td>
        <td><strong>${pr.maxWeight} kg</strong> <small class="text-muted">× ${pr.maxWeightReps} reps</small></td>
        <td class="pr-1rm-val">⚡ ${pr.bestEst1RM} kg</td>
        <td class="text-muted" style="font-size:12px;">${dateStr}</td>
        <td class="text-muted">${pr.totalSessions}</td>
      </tr>
    `;
  }).join('');
}


function renderPRChart(exerciseId) {
  destroyChart('pr');
  const prEmpty  = document.getElementById('pr-empty');
  const prGrid   = document.getElementById('pr-summary-grid');
  const canvas   = document.getElementById('pr-chart');

  if (!exerciseId) {
    if (prEmpty)  prEmpty.style.display  = '';
    if (prGrid)   prGrid.style.display   = 'none';
    return;
  }

  // Collect all sets for this exercise across all sessions
  const logs = getWorkoutLogs();
  const points = []; // { date, best1RM, bestWeight, bestReps }

  logs.forEach(session => {
    (session.exercises || []).forEach(ex => {
      if (ex.exerciseId !== exerciseId) return;
      let best1RM = 0, bestWeight = 0, bestReps = 0;
      (ex.sets || []).forEach(s => {
        const w  = parseFloat(s.weight) || 0;
        const r  = parseInt(s.reps, 10) || 0;
        const rm = estimate1RM(w, r);
        if (rm > best1RM) { best1RM = rm; bestWeight = w; bestReps = r; }
      });
      if (best1RM > 0) {
        points.push({ date: session.date, best1RM, bestWeight, bestReps });
      }
    });
  });

  if (points.length === 0) {
    if (prEmpty) prEmpty.style.display = '';
    if (prGrid)  prGrid.style.display  = 'none';
    return;
  }

  const sorted = points.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Compute running PR (only show when a new record is set)
  let runningMax = 0;
  const prPoints = sorted.map(p => {
    if (p.best1RM > runningMax) { runningMax = p.best1RM; return p.best1RM; }
    return null;
  });

  // Update summary cards
  const overallBest    = sorted.reduce((m, p) => p.best1RM > m.best1RM ? p : m, sorted[0]);
  const overallMaxW    = sorted.reduce((m, p) => p.bestWeight > m.bestWeight ? p : m, sorted[0]);

  if (prGrid) {
    prGrid.style.display = '';
    document.getElementById('pr-best-1rm').textContent      = `${overallBest.best1RM} kg`;
    document.getElementById('pr-best-1rm-date').textContent = fmtDate(overallBest.date);
    document.getElementById('pr-max-weight').textContent    = `${overallMaxW.bestWeight} kg`;
    document.getElementById('pr-max-weight-date').textContent = `${overallMaxW.bestReps} reps · ${fmtDate(overallMaxW.date)}`;
    const uniqueSessions = new Set(sorted.map(p => toDateStr(p.date))).size;
    document.getElementById('pr-sessions-count').textContent = uniqueSessions;
  }
  if (prEmpty) prEmpty.style.display = 'none';

  const labels = sorted.map(p => fmtDate(p.date));
  const data1RM = sorted.map(p => p.best1RM);

  _charts.pr = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Best 1RM (Est.)',
          data: data1RM,
          borderColor: ACCENT,
          backgroundColor: (ctx) => {
            const grad = ctx.chart.ctx.createLinearGradient(0, 0, 0, 280);
            grad.addColorStop(0, 'rgba(211,47,47,0.3)');
            grad.addColorStop(1, 'rgba(211,47,47,0.0)');
            return grad;
          },
          borderWidth: 2.5,
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: ACCENT,
        },
        {
          label: 'New PR set',
          data: prPoints,
          borderColor: 'transparent',
          backgroundColor: AMBER,
          pointRadius: prPoints.map(v => v !== null ? 7 : 0),
          pointHoverRadius: 9,
          pointStyle: 'triangle',
          showLine: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' } },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          beginAtZero: false,
          ticks: { callback: v => `${v} kg` },
        },
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            filter: item => item.datasetIndex === 0 || prPoints.some(v => v !== null),
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.datasetIndex === 1 && ctx.parsed.y === null) return null;
              if (ctx.datasetIndex === 1) return ` 🏆 New PR: ${ctx.parsed.y} kg`;
              return ` ${ctx.dataset.label}: ${ctx.parsed.y} kg`;
            },
          },
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 4. Consistency Heatmap (GitHub-style)
// ---------------------------------------------------------------------------

function renderHeatmap() {
  const container = document.getElementById('heatmap-container');
  const emptyEl   = document.getElementById('heatmap-empty');
  if (!container) return;

  const logs = getWorkoutLogs();

  // Build a map: dateStr → total volume that day
  const volumeByDay = new Map();
  logs.forEach(session => {
    const d = toDateStr(session.date);
    if (!d) return;
    volumeByDay.set(d, (volumeByDay.get(d) || 0) + (session.totalVolume || 0));
  });

  if (volumeByDay.size === 0) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  // Build streak info
  updateStreakBanner(volumeByDay);

  // Build 52-week grid (364 days + today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 363);
  // Align to Sunday
  startDate.setDate(startDate.getDate() - startDate.getDay());

  // Find max volume for relative intensity
  const maxVol = Math.max(...volumeByDay.values());

  // Week columns
  const totalDays = Math.ceil((today - startDate) / 86400000) + 1;
  const totalWeeks = Math.ceil(totalDays / 7);

  // Track month labels
  const monthLabels = [];
  let prevMonth = -1;
  let weekIdx   = 0;

  // Build DOM
  const outer = document.createElement('div');
  outer.className = 'heatmap-outer';

  // Day labels (Mon, Wed, Fri)
  const dayLabels = document.createElement('div');
  dayLabels.className = 'heatmap-day-labels';
  dayLabels.setAttribute('aria-hidden', 'true');
  ['', 'Mon', '', 'Wed', '', 'Fri', ''].forEach(d => {
    const lbl = document.createElement('span');
    lbl.className = 'hm-day-label';
    lbl.textContent = d;
    dayLabels.appendChild(lbl);
  });

  const innerWrap = document.createElement('div');
  innerWrap.style.display = 'flex';
  innerWrap.style.flexDirection = 'column';

  // Month row (built as we iterate weeks)
  const monthRow = document.createElement('div');
  monthRow.className = 'heatmap-months';
  monthRow.setAttribute('aria-hidden', 'true');

  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';

  let cursor = new Date(startDate);

  for (let w = 0; w < totalWeeks; w++) {
    // Month label
    const mn = cursor.getMonth();
    const monthLbl = document.createElement('span');
    monthLbl.className = 'hm-month-label';
    monthLbl.style.width = '16px';
    monthLbl.style.display = 'inline-block';
    if (mn !== prevMonth) {
      monthLbl.textContent = cursor.toLocaleString('en', { month: 'short' });
      prevMonth = mn;
    }
    monthRow.appendChild(monthLbl);

    const weekCol = document.createElement('div');
    weekCol.className = 'heatmap-week';

    for (let d = 0; d < 7; d++) {
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';

      const isFuture = cursor > today;
      if (isFuture) {
        cell.style.visibility = 'hidden';
      } else {
        const dateStr = cursor.toISOString().slice(0, 10);
        const vol = volumeByDay.get(dateStr) || 0;

        if (vol === 0) {
          cell.classList.add('hm-0');
        } else {
          const ratio = vol / maxVol;
          if (ratio < 0.25)      cell.classList.add('hm-1');
          else if (ratio < 0.50) cell.classList.add('hm-2');
          else if (ratio < 0.75) cell.classList.add('hm-3');
          else                   cell.classList.add('hm-4');
        }

        const volStr  = vol > 0 ? `${vol.toLocaleString()} kg` : 'Rest day';
        const dateStr2 = cursor.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        cell.setAttribute('title', `${dateStr2}: ${volStr}`);
        cell.setAttribute('aria-label', `${dateStr2}: ${volStr}`);
      }

      weekCol.appendChild(cell);
      cursor.setDate(cursor.getDate() + 1);
    }

    grid.appendChild(weekCol);
  }

  innerWrap.appendChild(monthRow);
  innerWrap.appendChild(grid);
  outer.appendChild(dayLabels);
  outer.appendChild(innerWrap);

  container.innerHTML = '';
  container.appendChild(outer);
}

function updateStreakBanner(volumeByDay) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasWorkout = (d) => {
    const str = d.toISOString().slice(0, 10);
    return (volumeByDay.get(str) || 0) > 0;
  };

  // Current streak
  let streak = 0;
  let check = new Date(today);
  while (hasWorkout(check)) {
    streak++;
    check.setDate(check.getDate() - 1);
  }

  // Longest streak
  const allDates = [...volumeByDay.keys()].filter(k => volumeByDay.get(k) > 0).sort();
  let longestStreak = 0, cur = 0;
  allDates.forEach((d, i) => {
    if (i === 0) { cur = 1; return; }
    const prev = new Date(allDates[i - 1]);
    prev.setDate(prev.getDate() + 1);
    if (prev.toISOString().slice(0, 10) === d) {
      cur++;
    } else {
      cur = 1;
    }
    if (cur > longestStreak) longestStreak = cur;
  });
  if (cur > longestStreak) longestStreak = cur;
  if (allDates.length === 1) longestStreak = 1;

  // This month
  const thisMonthStr = today.toISOString().slice(0, 7);
  const thisMonth = allDates.filter(d => d.startsWith(thisMonthStr)).length;

  // Total unique days
  const totalDays = allDates.length;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('streak-count',    streak);
  setEl('streak-longest',  longestStreak);
  setEl('streak-this-month', thisMonth);
  setEl('streak-total-days', totalDays);

  // Animate fire emoji based on streak
  const fire = document.querySelector('.streak-fire');
  if (fire) {
    fire.textContent = streak >= 7 ? '🔥🔥' : streak >= 3 ? '🔥' : streak > 0 ? '⚡' : '💤';
  }
}

// ---------------------------------------------------------------------------
// 5. Muscle / Split Charts
// ---------------------------------------------------------------------------

function renderMuscleCharts() {
  destroyChart('muscles');
  destroyChart('split');

  const logs = filterByPeriod(getWorkoutLogs(), _activePeriod.muscles);
  const muscleVol  = new Map(); // target → total volume
  const bodyPartCount = new Map(); // body_part → session count

  logs.forEach(session => {
    const bodyPartsInSession = new Set();
    (session.exercises || []).forEach(ex => {
      // Volume by target muscle
      const target = ex.target || ex.bodyPart || 'Other';
      const exVol  = (ex.sets || []).reduce((sum, s) => {
        return sum + (parseFloat(s.weight) || 0) * (parseInt(s.reps, 10) || 0);
      }, 0);
      muscleVol.set(target, (muscleVol.get(target) || 0) + exVol);

      // Count body parts per session (not per exercise to avoid double-counting)
      if (ex.bodyPart) bodyPartsInSession.add(ex.bodyPart);
    });
    bodyPartsInSession.forEach(bp => {
      bodyPartCount.set(bp, (bodyPartCount.get(bp) || 0) + 1);
    });
  });

  // ── Muscle volume bar chart ──
  const musclesCanvas = document.getElementById('muscles-chart');
  if (musclesCanvas && window.Chart && muscleVol.size > 0) {
    const sorted = [...muscleVol.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const labels  = sorted.map(([k]) => k);
    const data    = sorted.map(([, v]) => Math.round(v));

    _charts.muscles = new window.Chart(musclesCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Volume (kg)',
          data,
          backgroundColor: data.map((_, i) => i === 0 ? ACCENT : ACCENT_LIGHT),
          borderColor: ACCENT,
          borderWidth: 1.5,
          borderRadius: 5,
          hoverBackgroundColor: ACCENT,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { callback: v => v >= 1000 ? `${(v/1000).toFixed(1)}t` : `${v}` },
          },
          y: { grid: { display: false } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x.toLocaleString()} kg` } },
        },
      },
    });
  } else if (musclesCanvas) {
    showEmpty(musclesCanvas, 'No muscle data for this period.');
  }

  // ── Split donut chart ──
  const splitCanvas  = document.getElementById('split-chart');
  const splitLegend  = document.getElementById('split-legend');
  if (splitCanvas && window.Chart && bodyPartCount.size > 0) {
    const entries = [...bodyPartCount.entries()].sort((a, b) => b[1] - a[1]);
    const labels  = entries.map(([k]) => k);
    const data    = entries.map(([, v]) => v);
    const palette = [
      ACCENT,
      AMBER,
      '#4FC3F7',
      '#81C784',
      '#CE93D8',
      '#F48FB1',
      '#80DEEA',
      '#FFCC02',
      '#FF7043',
      '#AED581',
    ];

    _charts.split = new window.Chart(splitCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: palette.slice(0, labels.length),
          borderColor: 'var(--color-bg-deep, #111318)',
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed} sessions`,
            },
          },
        },
      },
    });

    // Custom legend
    if (splitLegend) {
      splitLegend.innerHTML = entries.map(([label, count], i) => `
        <div style="display:flex;align-items:center;gap:8px;font-size:0.75rem;">
          <span style="width:10px;height:10px;border-radius:2px;background:${palette[i]};flex-shrink:0;display:inline-block;"></span>
          <span style="color:var(--color-text-secondary)">${label}</span>
          <span style="color:var(--color-text-muted);margin-left:auto">${count}</span>
        </div>`).join('');
    }
  }

  // Also render Anatomical Muscle Volume Heatmap
  renderMuscleVolumeHeatmap();
}

// ---------------------------------------------------------------------------
// 6. Anatomical Muscle Volume Heatmap (SVG Body Map)
// ---------------------------------------------------------------------------

function renderMuscleVolumeHeatmap() {
  const container = document.getElementById('muscle-volume-heatmap-svg');
  if (!container) return;

  const period = _activePeriod['heatmap-muscles'] || 30;
  const logs = filterByPeriod(getWorkoutLogs(), period);
  const volumeMap = {}; // muscleKey -> { volume, sets }

  function addVol(id, vol, sets = 1) {
    if (!volumeMap[id]) volumeMap[id] = { volume: 0, sets: 0 };
    volumeMap[id].volume += vol;
    volumeMap[id].sets += sets;
  }

  logs.forEach(session => {
    (session.exercises || []).forEach(ex => {
      const target = (ex.target || '').toLowerCase();
      const bp = (ex.bodyPart || '').toLowerCase();
      const exVol = (ex.sets || []).reduce((sum, s) => sum + (parseFloat(s.weight) || 0) * (parseInt(s.reps, 10) || 0), 0);
      const exSets = (ex.sets || []).length || 1;

      if (target.includes('pectorals') || target.includes('chest') || bp === 'chest') {
        addVol('chest', exVol, exSets);
      }
      if (target.includes('biceps')) {
        addVol('biceps', exVol, exSets);
      }
      if (target.includes('triceps')) {
        addVol('triceps', exVol, exSets);
      }
      if (target.includes('delts') || target.includes('shoulders') || bp === 'shoulders') {
        addVol('delts-front', exVol * 0.6, exSets);
        addVol('delts-back', exVol * 0.4, exSets);
      }
      if (target.includes('lats') || target.includes('upper back')) {
        addVol('lats', exVol * 0.6, exSets);
        addVol('upper-back', exVol * 0.4, exSets);
      }
      if (target.includes('traps') || bp === 'neck') {
        addVol('traps', exVol, exSets);
        addVol('neck', exVol * 0.3, exSets);
      }
      if (target.includes('abs') || target.includes('waist') || bp === 'waist') {
        addVol('abs', exVol * 0.7, exSets);
        addVol('obliques', exVol * 0.3, exSets);
      }
      if (target.includes('glutes')) {
        addVol('glutes', exVol, exSets);
      }
      if (target.includes('quads') || (bp === 'upper legs' && !target.includes('hamstrings') && !target.includes('glutes'))) {
        addVol('quads', exVol, exSets);
      }
      if (target.includes('hamstrings')) {
        addVol('hamstrings', exVol, exSets);
      }
      if (target.includes('calves') || bp === 'lower legs') {
        addVol('calves-front', exVol * 0.5, exSets);
        addVol('calves-back', exVol * 0.5, exSets);
      }
      if (target.includes('spine') || target.includes('lower back') || bp === 'back') {
        addVol('lower-back', exVol * 0.6, exSets);
        addVol('spine', exVol * 0.4, exSets);
      }
      if (target.includes('forearms') || bp === 'lower arms') {
        addVol('forearms-front', exVol * 0.5, exSets);
        addVol('forearms-back', exVol * 0.5, exSets);
      }
    });
  });

  const onHover = (info) => {
    const nameEl = document.getElementById('hovered-muscle-name');
    const volEl = document.getElementById('hovered-muscle-vol');
    const setsEl = document.getElementById('hovered-muscle-sets');
    if (nameEl) nameEl.textContent = info.label;
    if (volEl) volEl.textContent = `${Math.round(info.volume).toLocaleString()} kg`;
    if (setsEl) setsEl.textContent = `${info.sets} sets`;
  };

  renderMuscleHeatmap('muscle-volume-heatmap-svg', volumeMap, onHover);

  // Check Imbalance / Recovery Alerts
  const alertEl = document.getElementById('muscle-imbalance-alert');
  const msgEl = document.getElementById('imbalance-message');
  if (alertEl && msgEl) {
    const chestVol = (volumeMap['chest']?.volume || 0);
    const backVol = (volumeMap['lats']?.volume || 0) + (volumeMap['upper-back']?.volume || 0);
    const legVol = (volumeMap['quads']?.volume || 0) + (volumeMap['hamstrings']?.volume || 0) + (volumeMap['glutes']?.volume || 0);
    const coreVol = (volumeMap['abs']?.volume || 0) + (volumeMap['obliques']?.volume || 0);

    const totalV = chestVol + backVol + legVol + coreVol;

    if (totalV > 0) {
      const neglected = [];
      if (legVol === 0) neglected.push('Lower Body (Quads / Hamstrings)');
      if (backVol === 0) neglected.push('Back & Lats');
      if (chestVol === 0) neglected.push('Chest / Push');
      if (coreVol === 0) neglected.push('Core / Abs');

      if (neglected.length > 0) {
        alertEl.style.display = 'flex';
        msgEl.innerHTML = `You haven't logged volume for <strong>${neglected.join(', ')}</strong> in this period. Training all movement planes ensures structural balance and joint health.`;
      } else {
        alertEl.style.display = 'flex';
        msgEl.innerHTML = `<strong>Balanced training:</strong> Your logged volume is distributed across push, pull, core, and lower body. Great job on maintaining symmetry!`;
      }
    } else {
      alertEl.style.display = 'none';
    }
  }
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function showEmpty(canvas, msg) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.style.display = 'none';
  const p = document.createElement('p');
  p.style.cssText = 'text-align:center;color:var(--color-text-muted);padding:var(--space-12);font-size:var(--text-sm);';
  p.textContent = msg;
  canvas.parentNode.insertBefore(p, canvas.nextSibling);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  applyChartDefaults();
  initTabs();
  initPeriodPills();

  // Render Tab 1 immediately
  renderVolumeChart();
  renderSetsChart();

  // Lazy-render other tabs on first activation
  let prInited      = false;
  let heatmapInited = false;
  let musclesInited = false;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.getAttribute('aria-controls');
      if (panel === 'tab-pr' && !prInited) {
        prInited = true;
        initPRSelect();
      }
      if (panel === 'tab-heatmap' && !heatmapInited) {
        heatmapInited = true;
        renderHeatmap();
      }
      if (panel === 'tab-muscles' && !musclesInited) {
        musclesInited = true;
        renderMuscleCharts();
      }
    });
  });

  // Re-render on data change
  window.addEventListener('workout-logs-changed', () => {
    renderVolumeChart();
    renderSetsChart();
    if (prInited)      initPRSelect();
    if (heatmapInited) renderHeatmap();
    if (musclesInited) renderMuscleCharts();
  });

  // Re-apply defaults when theme changes
  window.addEventListener('theme-changed', () => {
    applyChartDefaults();
    renderVolumeChart();
    renderSetsChart();
  });
});
