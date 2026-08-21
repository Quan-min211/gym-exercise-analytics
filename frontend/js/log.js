/**
 * log.js — Workout Logger Page Controller
 *
 * Handles:
 *   - Active workout session tracker with live timer & auto-save draft
 *   - Exercise search & addition to active session
 *   - Dynamic set rows with weight, reps, RPE, done state, and PR hints
 *   - Workout history list with expandable details, re-do workout, delete
 *   - Overview stats (Volume, Workouts, Sets, Weekly consistency)
 *   - CSV & JSON import/export
 *   - Pre-loading exercises from URL query param `?add=exercise_id`
 */

import { $, $$, api, debounce, el } from './app.js';
import {
  calculateSessionVolume,
  clearAllWorkoutLogs,
  deleteWorkoutLog,
  estimate1RM,
  exportLogsCSV,
  exportLogsJSON,
  getActiveSession,
  getExercisePR,
  getWorkoutLogs,
  getWorkoutStats,
  importLogsJSON,
  saveActiveSession,
  saveWorkoutLog,
} from './workout-logger.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let activeWorkout = null;
let timerInterval = null;
let timerSeconds = 0;
let searchQuery = '';

// ---------------------------------------------------------------------------
// Timer helpers
// ---------------------------------------------------------------------------

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function startTimer(initialSeconds = 0) {
  stopTimer();
  timerSeconds = initialSeconds;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
    if (activeWorkout) {
      activeWorkout.durationMinutes = Math.max(1, Math.round(timerSeconds / 60));
      saveActiveSession(activeWorkout);
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const display = $('#workout-timer-display');
  if (display) {
    display.textContent = formatTimer(timerSeconds);
  }
}

// ---------------------------------------------------------------------------
// Active Session Logic
// ---------------------------------------------------------------------------

function initActiveSession() {
  const draft = getActiveSession();
  if (draft && draft.exercises && draft.exercises.length > 0) {
    activeWorkout = draft;
    timerSeconds = (draft.durationMinutes || 0) * 60;
  } else {
    activeWorkout = createBlankSession();
  }
  renderActiveSession();
}

function createBlankSession() {
  const now = new Date();
  return {
    id: null,
    title: `Workout ${now.toLocaleDateString()}`,
    date: now.toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
    durationMinutes: 0,
    notes: '',
    exercises: [],
  };
}

function renderActiveSession() {
  const container = $('#active-exercises-list');
  const emptyHint = $('#active-empty-hint');
  const titleInput = $('#workout-title-input');
  const dateInput = $('#workout-date-input');
  const notesInput = $('#workout-notes-input');

  if (titleInput) titleInput.value = activeWorkout.title || '';
  if (dateInput) {
    dateInput.value = activeWorkout.date ? activeWorkout.date.slice(0, 16) : new Date().toISOString().slice(0, 16);
  }
  if (notesInput) notesInput.value = activeWorkout.notes || '';

  if (!container) return;
  container.innerHTML = '';

  if (!activeWorkout.exercises || activeWorkout.exercises.length === 0) {
    if (emptyHint) emptyHint.style.display = 'block';
    updateActiveSummary();
    return;
  }

  if (emptyHint) emptyHint.style.display = 'none';

  activeWorkout.exercises.forEach((exItem, exIndex) => {
    const card = renderExerciseCard(exItem, exIndex);
    container.appendChild(card);
  });

  updateActiveSummary();
}

function renderExerciseCard(exItem, exIndex) {
  const card = el('article', { class: 'active-ex-card', 'data-ex-idx': exIndex });

  // Header
  const header = el('header', { class: 'active-ex-header' });
  const titleGroup = el('div', { class: 'active-ex-title-group' });

  const nameLink = el('a', {
    href: `/exercise.html?id=${exItem.exerciseId}`,
    class: 'active-ex-name',
    text: exItem.exerciseName,
    target: '_blank',
    title: 'View exercise instructions',
  });

  const metaText = el('span', {
    class: 'active-ex-meta',
    text: `${exItem.target || ''} • ${exItem.equipment || ''}`,
  });

  titleGroup.appendChild(nameLink);
  titleGroup.appendChild(metaText);

  // PR Badge if exists
  const pr = getExercisePR(exItem.exerciseId);
  if (pr && pr.maxWeight > 0) {
    const prBadge = el('span', {
      class: 'pr-mini-badge',
      text: `🏆 PR: ${pr.maxWeight}kg`,
      title: `Best: ${pr.maxWeight}kg x ${pr.maxWeightReps} reps`,
    });
    titleGroup.appendChild(prBadge);
  }

  const removeExBtn = el('button', {
    type: 'button',
    class: 'btn-icon text-muted',
    title: 'Remove exercise from session',
    html: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  });
  removeExBtn.addEventListener('click', () => {
    activeWorkout.exercises.splice(exIndex, 1);
    saveActiveSession(activeWorkout);
    renderActiveSession();
  });

  header.appendChild(titleGroup);
  header.appendChild(removeExBtn);
  card.appendChild(header);

  // Sets Table
  const tableWrap = el('div', { class: 'active-sets-table-wrap' });
  const table = el('table', { class: 'active-sets-table', 'aria-label': `Sets for ${exItem.exerciseName}` });

  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col" style="width: 48px;">Set</th>
        <th scope="col">Weight (kg)</th>
        <th scope="col">Reps</th>
        <th scope="col">RPE</th>
        <th scope="col" style="width: 50px; text-align: center;">Done</th>
        <th scope="col" style="width: 40px;"></th>
      </tr>
    </thead>
  `;

  const tbody = el('tbody');

  (exItem.sets || []).forEach((setObj, setIndex) => {
    const tr = el('tr', { class: setObj.completed ? 'set-completed' : '' });

    // Set #
    const tdNum = el('td', { class: 'set-num-cell', text: setIndex + 1 });

    // Weight input
    const tdWeight = el('td');
    const inputWeight = el('input', {
      type: 'number',
      class: 'set-input',
      min: '0',
      max: '1000',
      step: '0.5',
      placeholder: '0',
      value: setObj.weight ?? '',
    });
    inputWeight.addEventListener('input', (e) => {
      setObj.weight = parseFloat(e.target.value) || 0;
      saveActiveSession(activeWorkout);
      updateActiveSummary();
    });
    tdWeight.appendChild(inputWeight);

    // Reps input
    const tdReps = el('td');
    const inputReps = el('input', {
      type: 'number',
      class: 'set-input',
      min: '0',
      max: '500',
      placeholder: '0',
      value: setObj.reps ?? '',
    });
    inputReps.addEventListener('input', (e) => {
      setObj.reps = parseInt(e.target.value, 10) || 0;
      saveActiveSession(activeWorkout);
      updateActiveSummary();
    });
    tdReps.appendChild(inputReps);

    // RPE input
    const tdRpe = el('td');
    const inputRpe = el('input', {
      type: 'number',
      class: 'set-input',
      min: '1',
      max: '10',
      step: '0.5',
      placeholder: '-',
      value: setObj.rpe ?? '',
    });
    inputRpe.addEventListener('input', (e) => {
      setObj.rpe = e.target.value ? parseFloat(e.target.value) : null;
      saveActiveSession(activeWorkout);
    });
    tdRpe.appendChild(inputRpe);

    // Done checkbox
    const tdDone = el('td', { style: 'text-align: center;' });
    const checkDone = el('input', {
      type: 'checkbox',
      class: 'set-check',
      'aria-label': `Mark set ${setIndex + 1} completed`,
    });
    checkDone.checked = !!setObj.completed;
    checkDone.addEventListener('change', (e) => {
      setObj.completed = e.target.checked;
      tr.classList.toggle('set-completed', setObj.completed);
      saveActiveSession(activeWorkout);
    });
    tdDone.appendChild(checkDone);

    // Delete set
    const tdDel = el('td', { style: 'text-align: center;' });
    const delBtn = el('button', {
      type: 'button',
      class: 'btn-icon-sm text-muted',
      title: 'Delete this set',
      html: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    });
    delBtn.addEventListener('click', () => {
      exItem.sets.splice(setIndex, 1);
      saveActiveSession(activeWorkout);
      renderActiveSession();
    });
    tdDel.appendChild(delBtn);

    tr.appendChild(tdNum);
    tr.appendChild(tdWeight);
    tr.appendChild(tdReps);
    tr.appendChild(tdRpe);
    tr.appendChild(tdDone);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  card.appendChild(tableWrap);

  // Footer: Add Set button
  const cardFooter = el('footer', { class: 'active-ex-footer' });
  const addSetBtn = el('button', {
    type: 'button',
    class: 'btn btn-ghost btn-sm',
    text: '+ Add Set',
  });
  addSetBtn.addEventListener('click', () => {
    const prevSet = exItem.sets[exItem.sets.length - 1];
    exItem.sets.push({
      setNum: exItem.sets.length + 1,
      weight: prevSet ? prevSet.weight : 0,
      reps: prevSet ? prevSet.reps : 10,
      rpe: prevSet ? prevSet.rpe : null,
      completed: false,
    });
    saveActiveSession(activeWorkout);
    renderActiveSession();
  });

  cardFooter.appendChild(addSetBtn);
  card.appendChild(cardFooter);

  return card;
}

function updateActiveSummary() {
  const { volume, totalSets } = calculateSessionVolume(activeWorkout.exercises);
  const volEl = $('#active-volume-display');
  const setsEl = $('#active-sets-display');
  if (volEl) volEl.textContent = `${volume.toLocaleString()} kg`;
  if (setsEl) setsEl.textContent = `${totalSets} sets`;
}

// ---------------------------------------------------------------------------
// Search & Add Exercises Autocomplete
// ---------------------------------------------------------------------------

function setupExerciseSearch() {
  const input = $('#search-exercise-input');
  const results = $('#search-exercise-results');
  if (!input || !results) return;

  input.addEventListener('input', debounce(async (e) => {
    const q = e.target.value.trim();
    if (q.length < 2) {
      results.innerHTML = '';
      results.classList.remove('is-open');
      return;
    }

    try {
      const data = await api.get('/exercises/search', { q, page_size: 6 });
      results.innerHTML = '';
      if (!data.items || data.items.length === 0) {
        results.innerHTML = '<li class="p-3 text-muted text-sm">No exercises found</li>';
        results.classList.add('is-open');
        return;
      }

      data.items.forEach(item => {
        const li = el('li', { class: 'autocomplete-item' });
        const btn = el('button', {
          type: 'button',
          class: 'autocomplete-btn',
          html: `
            <img src="/${item.image}" alt="" class="autocomplete-thumb" loading="lazy">
            <div class="autocomplete-info">
              <strong class="autocomplete-name">${item.name}</strong>
              <small class="autocomplete-meta">${item.target} • ${item.equipment}</small>
            </div>
          `,
        });

        btn.addEventListener('click', () => {
          addExerciseToActiveSession(item);
          input.value = '';
          results.innerHTML = '';
          results.classList.remove('is-open');
        });

        li.appendChild(btn);
        results.appendChild(li);
      });

      results.classList.add('is-open');
    } catch (err) {
      console.error('Search error:', err);
    }
  }, 250));

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove('is-open');
    }
  });
}

function addExerciseToActiveSession(exerciseData) {
  if (!activeWorkout.exercises) activeWorkout.exercises = [];

  const existing = activeWorkout.exercises.find(e => e.exerciseId === exerciseData.id);
  if (existing) {
    existing.sets.push({
      setNum: existing.sets.length + 1,
      weight: 0,
      reps: 10,
      rpe: null,
      completed: false,
    });
  } else {
    activeWorkout.exercises.push({
      exerciseId: exerciseData.id,
      exerciseName: exerciseData.name,
      bodyPart: exerciseData.body_part || exerciseData.body_part_name || '',
      equipment: exerciseData.equipment || exerciseData.equipment_name || '',
      target: exerciseData.target || exerciseData.target_muscle_name || '',
      sets: [
        { setNum: 1, weight: 0, reps: 10, rpe: null, completed: false },
        { setNum: 2, weight: 0, reps: 10, rpe: null, completed: false },
        { setNum: 3, weight: 0, reps: 10, rpe: null, completed: false },
      ],
    });
  }

  saveActiveSession(activeWorkout);
  renderActiveSession();
}

// ---------------------------------------------------------------------------
// Workout History & Stats Rendering
// ---------------------------------------------------------------------------

function renderStatsOverview() {
  const stats = getWorkoutStats();
  const totalWorkoutsEl = $('#stat-total-workouts');
  const totalVolumeEl = $('#stat-total-volume');
  const totalSetsEl = $('#stat-total-sets');
  const weekWorkoutsEl = $('#stat-week-workouts');

  if (totalWorkoutsEl) totalWorkoutsEl.textContent = stats.totalWorkouts;
  if (totalVolumeEl) totalVolumeEl.textContent = `${stats.totalVolume.toLocaleString()} kg`;
  if (totalSetsEl) totalSetsEl.textContent = stats.totalSets;
  if (weekWorkoutsEl) weekWorkoutsEl.textContent = stats.workoutsThisWeek;
}

function renderHistoryList() {
  const container = $('#workout-history-list');
  const emptyState = $('#history-empty-state');
  if (!container) return;

  const logs = getWorkoutLogs();
  let filtered = logs;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = logs.filter(l => {
      const matchTitle = l.title?.toLowerCase().includes(q);
      const matchNotes = l.notes?.toLowerCase().includes(q);
      const matchEx = (l.exercises || []).some(e => e.exerciseName?.toLowerCase().includes(q) || e.target?.toLowerCase().includes(q));
      return matchTitle || matchNotes || matchEx;
    });
  }

  container.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  filtered.forEach(session => {
    const sessionCard = renderHistoryCard(session);
    container.appendChild(sessionCard);
  });
}

function renderHistoryCard(session) {
  const card = el('article', { class: 'history-card' });
  const dateObj = new Date(session.date || session.createdAt);

  const header = el('header', { class: 'history-card-header' });
  const headerLeft = el('div', { class: 'history-header-left' });

  const title = el('h3', { class: 'history-title', text: session.title });
  const timeTag = el('time', {
    class: 'history-date',
    datetime: session.date,
    text: dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  });

  headerLeft.appendChild(title);
  headerLeft.appendChild(timeTag);

  const headerRight = el('div', { class: 'history-header-right' });
  const volumePill = el('span', { class: 'history-pill', text: `⚡ ${session.totalVolume.toLocaleString()} kg` });
  const setsPill = el('span', { class: 'history-pill', text: `🔢 ${session.totalSets} sets` });
  if (session.durationMinutes > 0) {
    const durPill = el('span', { class: 'history-pill', text: `⏱️ ${session.durationMinutes}m` });
    headerRight.appendChild(durPill);
  }

  headerRight.appendChild(volumePill);
  headerRight.appendChild(setsPill);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);
  card.appendChild(header);

  // Notes if any
  if (session.notes) {
    const notesP = el('p', { class: 'history-notes', text: `“${session.notes}”` });
    card.appendChild(notesP);
  }

  // Exercises breakdown details
  const details = el('details', { class: 'history-details' });
  const summary = el('summary', { class: 'history-summary' });
  const exCount = (session.exercises || []).length;
  summary.innerHTML = `<span>View ${exCount} exercise${exCount !== 1 ? 's' : ''} breakdown</span>`;
  details.appendChild(summary);

  const exList = el('div', { class: 'history-ex-list mt-3' });

  (session.exercises || []).forEach(ex => {
    const exBox = el('div', { class: 'history-ex-box' });
    const exHeader = el('div', { class: 'history-ex-box-header' });
    exHeader.innerHTML = `<strong>${ex.exerciseName}</strong> <small class="text-muted">${ex.target || ''}</small>`;
    exBox.appendChild(exHeader);

    const table = el('table', { class: 'history-sets-table' });
    table.innerHTML = `
      <thead>
        <tr>
          <th>Set</th>
          <th>Weight</th>
          <th>Reps</th>
          <th>RPE</th>
          <th>Est. 1RM</th>
        </tr>
      </thead>
    `;
    const tbody = el('tbody');
    (ex.sets || []).forEach((s, idx) => {
      const tr = el('tr');
      const est = estimate1RM(s.weight, s.reps);
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${s.weight} kg</td>
        <td>${s.reps}</td>
        <td>${s.rpe ?? '—'}</td>
        <td class="text-accent">${est > 0 ? est + ' kg' : '—'}</td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    exBox.appendChild(table);
    exList.appendChild(exBox);
  });

  details.appendChild(exList);
  card.appendChild(details);

  // Footer Actions
  const footer = el('footer', { class: 'history-footer' });

  const redoBtn = el('button', {
    type: 'button',
    class: 'btn btn-ghost btn-sm',
    text: '🔄 Re-do Workout',
    title: 'Load these exercises into active session',
  });
  redoBtn.addEventListener('click', () => {
    if (confirm('Load this workout template into your active session?')) {
      activeWorkout = {
        id: null,
        title: session.title,
        date: new Date().toISOString().slice(0, 16),
        durationMinutes: 0,
        notes: '',
        exercises: JSON.parse(JSON.stringify(session.exercises || [])).map(e => ({
          ...e,
          sets: (e.sets || []).map((s, i) => ({
            setNum: i + 1,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            completed: false,
          })),
        })),
      };
      saveActiveSession(activeWorkout);
      renderActiveSession();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  const deleteBtn = el('button', {
    type: 'button',
    class: 'btn btn-ghost btn-sm text-danger',
    text: '🗑️ Delete',
    title: 'Delete this workout log',
  });
  deleteBtn.addEventListener('click', () => {
    if (confirm(`Are you sure you want to delete "${session.title}"?`)) {
      deleteWorkoutLog(session.id);
      renderStatsOverview();
      renderHistoryList();
    }
  });

  footer.appendChild(redoBtn);
  footer.appendChild(deleteBtn);
  card.appendChild(footer);

  return card;
}

// ---------------------------------------------------------------------------
// Event Listeners & Actions
// ---------------------------------------------------------------------------

function setupPageEvents() {
  // Title / Date / Notes bindings
  $('#workout-title-input')?.addEventListener('input', (e) => {
    if (activeWorkout) {
      activeWorkout.title = e.target.value;
      saveActiveSession(activeWorkout);
    }
  });

  $('#workout-date-input')?.addEventListener('change', (e) => {
    if (activeWorkout) {
      activeWorkout.date = e.target.value;
      saveActiveSession(activeWorkout);
    }
  });

  $('#workout-notes-input')?.addEventListener('input', (e) => {
    if (activeWorkout) {
      activeWorkout.notes = e.target.value;
      saveActiveSession(activeWorkout);
    }
  });

  // Finish Workout Button
  $('#finish-workout-btn')?.addEventListener('click', () => {
    if (!activeWorkout || !activeWorkout.exercises || activeWorkout.exercises.length === 0) {
      alert('Please add at least one exercise to finish your workout.');
      return;
    }

    // Save session to permanent logs
    const saved = saveWorkoutLog(activeWorkout);

    // Reset active draft
    saveActiveSession(null);
    activeWorkout = createBlankSession();
    stopTimer();
    updateTimerDisplay();
    renderActiveSession();
    renderStatsOverview();
    renderHistoryList();

    // Show celebration alert/toast
    alert(`🎉 Workout "${saved.title}" saved successfully!\nVolume: ${saved.totalVolume} kg | Sets: ${saved.totalSets}`);
  });

  // Discard Workout Button
  $('#discard-workout-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to discard the active workout session?')) {
      saveActiveSession(null);
      activeWorkout = createBlankSession();
      stopTimer();
      updateTimerDisplay();
      renderActiveSession();
    }
  });

  // Timer controls
  $('#timer-start-btn')?.addEventListener('click', () => startTimer(timerSeconds));
  $('#timer-pause-btn')?.addEventListener('click', () => stopTimer());
  $('#timer-reset-btn')?.addEventListener('click', () => {
    stopTimer();
    timerSeconds = 0;
    updateTimerDisplay();
    if (activeWorkout) {
      activeWorkout.durationMinutes = 0;
      saveActiveSession(activeWorkout);
    }
  });

  // History search filter
  $('#history-search-input')?.addEventListener('input', debounce((e) => {
    searchQuery = e.target.value.trim();
    renderHistoryList();
  }, 250));

  // Export / Import
  $('#export-json-btn')?.addEventListener('click', () => exportLogsJSON());
  $('#export-csv-btn')?.addEventListener('click', () => exportLogsCSV());
  $('#import-json-btn')?.addEventListener('click', () => $('#import-file-input')?.click());

  $('#import-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = importLogsJSON(event.target.result);
      if (result.success) {
        alert(`Successfully imported ${result.count} workout sessions!`);
        renderStatsOverview();
        renderHistoryList();
      } else {
        alert(`Import failed: ${result.error}`);
      }
    };
    reader.readAsText(file);
  });

  $('#clear-history-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete ALL workout history? This cannot be undone.')) {
      clearAllWorkoutLogs();
      renderStatsOverview();
      renderHistoryList();
    }
  });

  // Inter-tab sync
  window.addEventListener('workout-logs-changed', () => {
    renderStatsOverview();
    renderHistoryList();
  });
}

// ---------------------------------------------------------------------------
// Pre-load from URL Query Param `?add=exercise_id`
// ---------------------------------------------------------------------------

async function checkURLParams() {
  const params = new URLSearchParams(window.location.search);
  const addId = params.get('add');
  if (!addId) return;

  try {
    const ex = await api.get(`/exercises/${addId}`);
    if (ex && ex.id) {
      addExerciseToActiveSession(ex);
      // Clean query string from URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (err) {
    console.error('Could not pre-load exercise from URL:', err);
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  initActiveSession();
  setupExerciseSearch();
  setupPageEvents();
  renderStatsOverview();
  renderHistoryList();
  await checkURLParams();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
