import { $, el, api } from './app.js';
import { buildFavoriteButton, initFavoritesNavBadge } from './favorites.js';
import { getExerciseLogs, getExercisePR, quickLogSet } from './workout-logger.js';

// Keep nav badge in sync on this page too
initFavoritesNavBadge();

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  if (!id) {
    window.location.href = '/';
    return;
  }

  try {
    const data = await api.get(`/exercises/${id}`);
    renderDetail(data);
    initExerciseWorkoutLogger(data);
    fetchAlternatives(data);
    fetchRelated(data);
  } catch (err) {
    console.error(err);
    $('#exercise-heading').textContent = 'Exercise not found';
  }
}

function renderDetail(ex) {
  document.title = `${ex.name} — FitData Hub`;
  $('#breadcrumb-name').textContent = ex.name;
  $('#exercise-heading').textContent = ex.name;
  
  const gif = $('#exercise-gif');
  gif.src = `/${ex.gif_url}`;
  gif.alt = `${ex.name} demonstration`;
  $('#exercise-name-caption').textContent = ex.name;

  $('#meta-body-part').textContent = ex.body_part;
  $('#meta-equipment').textContent = ex.equipment;
  $('#meta-target').textContent = ex.target;

  // Tags
  const categoryContainer = $('#exercise-category');
  categoryContainer.appendChild(el('span', { class: 'tag tag-accent', text: ex.category }));
  categoryContainer.appendChild(el('span', { class: 'tag tag-warm', text: ex.muscle_group }));

  // Muscle tags
  const musclesTags = $('#muscles-tags');
  musclesTags.appendChild(el('span', { class: 'tag tag-accent', text: ex.target + ' (Target)' }));
  ex.secondary_muscles.forEach(m => {
    musclesTags.appendChild(el('span', { class: 'tag tag-neutral', text: m }));
  });

  // Instructions
  const stepsList = $('#instruction-steps');
  if (ex.instructions && ex.instructions.steps) {
    ex.instructions.steps.forEach(step => {
      stepsList.appendChild(el('li', { text: step }));
    });
  } else {
    stepsList.innerHTML = '<li>Instructions not available.</li>';
  }

  // Generate generic benefits based on body part (since we don't have this in JSON)
  const benefits = $('#benefits-list');
  benefits.appendChild(createBenefitItem('Focus', `Strengthens the ${ex.target}.`));
  if (ex.equipment !== 'body weight') {
    benefits.appendChild(createBenefitItem('Equipment', `Requires ${ex.equipment}. Ensure proper form.`));
  }
  benefits.appendChild(createBenefitItem('Synergy', `Also engages ${ex.secondary_muscles.length > 0 ? ex.secondary_muscles.join(', ') : 'stabilizer muscles'}.`));

  $('#attribution-text').textContent = ex.attribution;

  $('#add-to-schedule-btn').addEventListener('click', () => {
    alert('Schedule builder coming soon!');
  });

  // ---- Favourite button ----
  const favWrapper = $('#fav-btn-wrapper');
  if (favWrapper) {
    favWrapper.appendChild(buildFavoriteButton(ex.id));
  }

  // ---- Personal notes ----
  initNotes(ex.id);

  // ---- Compare link ----
  const compareLink = $('#compare-this-btn') || $('#compare-link');
  if (compareLink) {
    compareLink.href = `/compare.html?a=${ex.id}`;
    compareLink.title = `Compare ${ex.name} with another exercise`;
  }
}

// ---------------------------------------------------------------------------
// Workout Logger Widget Integration
// ---------------------------------------------------------------------------

function initExerciseWorkoutLogger(ex) {
  const sidebarBtn = $('#log-this-exercise-btn');
  const fullPageLink = $('#log-full-page-link');
  if (sidebarBtn) sidebarBtn.href = `/log.html?add=${ex.id}`;
  if (fullPageLink) fullPageLink.href = `/log.html?add=${ex.id}`;

  function refreshWidget() {
    // 1. Personal Record Card
    const prCard = $('#exercise-pr-card');
    const prText = $('#exercise-pr-text');
    const pr = getExercisePR(ex.id);

    if (pr && pr.maxWeight > 0) {
      if (prCard) prCard.style.display = 'flex';
      if (prText) {
        prText.textContent = `${pr.maxWeight} kg × ${pr.maxWeightReps} reps  (Est. 1RM: ${pr.bestEst1RM} kg)`;
      }
    } else {
      if (prCard) prCard.style.display = 'none';
    }

    // 2. Recent Sets History Table
    const tableWrap = $('#exercise-recent-logs');
    const tbody = $('#exercise-recent-logs-tbody');
    const logs = getExerciseLogs(ex.id);

    if (logs && logs.length > 0) {
      if (tableWrap) tableWrap.style.display = 'block';
      if (tbody) {
        tbody.innerHTML = '';
        logs.slice(0, 5).forEach(s => {
          const tr = el('tr');
          const dateStr = s.date ? new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
          tr.innerHTML = `
            <td>${dateStr}</td>
            <td><strong>${s.weight} kg</strong></td>
            <td>${s.reps}</td>
            <td>${s.rpe ?? '—'}</td>
            <td class="text-accent">${s.est1RM > 0 ? s.est1RM + ' kg' : '—'}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    } else {
      if (tableWrap) tableWrap.style.display = 'none';
    }
  }

  refreshWidget();

  // Quick Log Form Submission
  const form = $('#quick-log-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const weightInput = $('#quick-log-weight');
      const repsInput = $('#quick-log-reps');
      const rpeInput = $('#quick-log-rpe');

      const weight = parseFloat(weightInput?.value) || 0;
      const reps = parseInt(repsInput?.value, 10);
      const rpe = rpeInput?.value ? parseFloat(rpeInput.value) : null;

      if (!reps || reps <= 0) {
        alert('Please enter a valid number of reps.');
        return;
      }

      quickLogSet(ex, weight, reps, rpe);
      refreshWidget();

      // Clear input fields
      if (repsInput) repsInput.value = '';
      if (rpeInput) rpeInput.value = '';

      // Visual feedback
      const submitBtn = $('#quick-log-submit-btn');
      if (submitBtn) {
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '✓ Logged!';
        submitBtn.classList.add('btn-outline-warm');
        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.classList.remove('btn-outline-warm');
        }, 1500);
      }
    });
  }

  // Inter-tab / Logger changes sync
  window.addEventListener('workout-logs-changed', () => refreshWidget());
}

function createBenefitItem(title, text) {
  const item = el('li', { class: 'benefit-item' });
  item.appendChild(el('strong', { text: title }));
  item.appendChild(document.createTextNode(text));
  return item;
}

// ---------------------------------------------------------------------------
// Alternatives — same target muscle, different equipment
// ---------------------------------------------------------------------------

async function fetchAlternatives(ex) {
  const section = document.getElementById('alternatives-section');
  const grid    = document.getElementById('alternatives-grid');
  if (!grid) return;

  try {
    const data = await api.get(`/exercises/${ex.id}/alternatives`);

    if (!data || data.length === 0) {
      section.hidden = true;
      return;
    }

    grid.innerHTML = '';
    data.forEach(item => {
      const card = el('a', {
        class: 'card exercise-card',
        href: `/exercise.html?id=${item.id}`,
        'aria-label': `View ${item.name}`,
      });

      const img = el('img', {
        src: `/${item.image}`,
        alt: `${item.name} demonstration`,
        loading: 'lazy',
        width: '200',
        height: '200',
      });

      const body = el('div', { class: 'card-body' });
      body.appendChild(el('h3', { text: item.name, style: 'font-size: var(--text-sm)' }));

      const badge = el('span', {
        class: 'alt-badge',
        text: item.equipment_name || item.equipment,
      });
      body.appendChild(badge);

      card.appendChild(img);
      card.appendChild(body);
      grid.appendChild(card);
    });

  } catch (err) {
    // Hide silently if the endpoint doesn't exist yet (e.g., local dev without new BE)
    section.hidden = true;
    console.warn('Alternatives unavailable:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Related — same target muscle, any equipment
// ---------------------------------------------------------------------------

async function fetchRelated(ex) {
  try {
    const data = await api.get('/exercises', { target: ex.target, page_size: 5 });
    const grid = $('#related-grid');
    grid.innerHTML = '';
    
    // Filter out the current exercise
    const related = data.items.filter(item => item.id !== ex.id).slice(0, 4);
    
    if (related.length === 0) {
      grid.innerHTML = '<p class="text-muted">No related exercises found.</p>';
      return;
    }

    related.forEach(item => {
      const card = el('a', { class: 'card exercise-card', href: `/exercise.html?id=${item.id}` });
      const img = el('img', {
        src: `/${item.image}`,
        alt: `${item.name} demonstration`,
        loading: 'lazy',
      });
      const body = el('div', { class: 'card-body', style: 'padding: 1rem;' });
      body.appendChild(el('h3', { text: item.name, style: 'font-size: var(--text-sm)' }));
      
      card.appendChild(img);
      card.appendChild(body);
      grid.appendChild(card);
    });

  } catch (err) {
    console.error('Failed to load related:', err);
  }
}

// ---------------------------------------------------------------------------
// Personal Notes (localStorage)
// ---------------------------------------------------------------------------

const NOTES_KEY = 'fitdata_exercise_notes';

function getAllNotes() {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || {}; }
  catch { return {}; }
}

function initNotes(exerciseId) {
  const textarea = $('#exercise-notes');
  const saveBtn = $('#save-notes-btn');
  const status = $('#notes-status');
  if (!textarea || !saveBtn) return;

  const id = String(exerciseId);
  const notes = getAllNotes();
  if (notes[id]) textarea.value = notes[id];

  saveBtn.addEventListener('click', () => {
    const all = getAllNotes();
    const text = textarea.value.trim();
    if (text) {
      all[id] = text;
    } else {
      delete all[id];
    }
    localStorage.setItem(NOTES_KEY, JSON.stringify(all));
    status.textContent = '✓ Saved!';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
}

document.addEventListener('DOMContentLoaded', init);
