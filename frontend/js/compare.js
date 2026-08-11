/**
 * compare.js — Exercise Comparison page logic.
 *
 * Allows users to search & select two exercises, then renders them
 * side-by-side with GIF, muscles, metadata, and instructions.
 */

import { $, api, el } from './app.js';

let exerciseA = null;
let exerciseB = null;
let debounceTimerA = null;
let debounceTimerB = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  setupSearch('search-a', 'results-a', 'a');
  setupSearch('search-b', 'results-b', 'b');

  // Swap button
  const swapBtn = $('#swap-btn');
  if (swapBtn) {
    swapBtn.addEventListener('click', swapExercises);
  }

  // Pre-load from URL params (linked from exercise detail page)
  const params = new URLSearchParams(window.location.search);
  const idA = params.get('a');
  const idB = params.get('b');

  if (idA) {
    try {
      const data = await api.get(`/exercises/${idA}`);
      exerciseA = data;
      renderSlot('a', data);
    } catch { /* ignore */ }
  }

  if (idB) {
    try {
      const data = await api.get(`/exercises/${idB}`);
      exerciseB = data;
      renderSlot('b', data);
    } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Search autocomplete
// ---------------------------------------------------------------------------

function setupSearch(inputId, resultsId, slot) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (!input || !results) return;

  const timer = slot === 'a' ? 'debounceTimerA' : 'debounceTimerB';

  input.addEventListener('input', () => {
    clearTimeout(slot === 'a' ? debounceTimerA : debounceTimerB);

    const q = input.value.trim();
    if (q.length < 2) {
      results.classList.remove('is-open');
      results.innerHTML = '';
      return;
    }

    const t = setTimeout(async () => {
      try {
        const data = await api.get('/exercises/search', { q, page_size: 8 });
        results.innerHTML = '';

        if (data.items.length === 0) {
          results.innerHTML = '<div style="padding: 12px; color: var(--color-text-muted); font-size: 13px;">No results found.</div>';
          results.classList.add('is-open');
          return;
        }

        data.items.forEach(item => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'compare-result-item';
          btn.innerHTML = `
            <img src="/${item.image}" alt="" loading="lazy">
            <span>${item.name}</span>`;
          btn.addEventListener('click', async () => {
            results.classList.remove('is-open');
            input.value = '';
            try {
              const full = await api.get(`/exercises/${item.id}`);
              if (slot === 'a') exerciseA = full;
              else exerciseB = full;
              renderSlot(slot, full);
            } catch (err) {
              console.error('Failed to load exercise:', err);
            }
          });
          results.appendChild(btn);
        });

        results.classList.add('is-open');
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 300);

    if (slot === 'a') debounceTimerA = t;
    else debounceTimerB = t;
  });

  // Close results on click outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove('is-open');
    }
  });
}

// ---------------------------------------------------------------------------
// Render exercise in slot
// ---------------------------------------------------------------------------

function renderSlot(slot, ex) {
  const emptyEl = document.getElementById(`slot-${slot}-empty`);
  const contentEl = document.getElementById(`slot-${slot}-content`);
  if (!emptyEl || !contentEl) return;

  emptyEl.style.display = 'none';
  contentEl.style.display = 'block';
  contentEl.innerHTML = '';

  // Change button to allow re-selecting
  const changeWrap = el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4)' });
  const nameLink = el('a', {
    href: `/exercise.html?id=${ex.id}`,
    text: ex.name,
    style: 'font-family:var(--font-display);font-weight:700;font-size:var(--text-lg);color:var(--color-text-primary);text-decoration:none',
  });
  const changeBtn = el('button', {
    class: 'btn btn-ghost btn-sm',
    text: '✕ Change',
  });
  changeBtn.addEventListener('click', () => {
    if (slot === 'a') exerciseA = null;
    else exerciseB = null;
    emptyEl.style.display = '';
    contentEl.style.display = 'none';
    contentEl.innerHTML = '';
    updateVS();
  });
  changeWrap.appendChild(nameLink);
  changeWrap.appendChild(changeBtn);
  contentEl.appendChild(changeWrap);

  // GIF
  const gif = el('img', {
    src: `/${ex.gif_url}`,
    alt: `${ex.name} demonstration`,
    class: 'compare-exercise-gif',
    loading: 'lazy',
  });
  contentEl.appendChild(gif);

  // Meta strip
  const metaDl = el('dl', { class: 'compare-meta-strip' });

  const metaItems = [
    { label: 'Body Part', value: ex.body_part },
    { label: 'Equipment', value: ex.equipment },
    { label: 'Target', value: ex.target },
  ];

  metaItems.forEach(({ label, value }) => {
    const item = el('div', { class: 'compare-meta-item' });
    item.appendChild(el('dt', { text: label }));
    item.appendChild(el('dd', { text: value }));
    metaDl.appendChild(item);
  });
  contentEl.appendChild(metaDl);

  // Muscles
  const musclesWrap = el('div', { class: 'compare-muscles' });
  musclesWrap.appendChild(el('span', { class: 'tag tag-accent', text: ex.target + ' (Target)' }));
  if (ex.secondary_muscles) {
    ex.secondary_muscles.forEach(m => {
      musclesWrap.appendChild(el('span', { class: 'tag tag-neutral', text: m }));
    });
  }
  contentEl.appendChild(musclesWrap);

  // Instructions
  if (ex.instructions && ex.instructions.steps && ex.instructions.steps.length > 0) {
    const heading = el('h3', { text: 'Instructions', style: 'font-size:var(--text-sm);margin-bottom:var(--space-2);font-weight:700' });
    contentEl.appendChild(heading);
    const list = el('ol', { class: 'compare-instructions' });
    ex.instructions.steps.forEach(step => {
      list.appendChild(el('li', { text: step }));
    });
    contentEl.appendChild(list);
  }

  updateVS();
}

// ---------------------------------------------------------------------------
// VS header
// ---------------------------------------------------------------------------

function updateVS() {
  const vsEl = $('#compare-vs');
  if (!vsEl) return;

  if (exerciseA && exerciseB) {
    vsEl.style.display = '';
    $('#vs-name-a').textContent = exerciseA.name;
    $('#vs-name-b').textContent = exerciseB.name;
  } else {
    vsEl.style.display = 'none';
  }
}

// ---------------------------------------------------------------------------
// Swap
// ---------------------------------------------------------------------------

function swapExercises() {
  const temp = exerciseA;
  exerciseA = exerciseB;
  exerciseB = temp;

  if (exerciseA) renderSlot('a', exerciseA);
  else {
    document.getElementById('slot-a-empty').style.display = '';
    document.getElementById('slot-a-content').style.display = 'none';
    document.getElementById('slot-a-content').innerHTML = '';
  }

  if (exerciseB) renderSlot('b', exerciseB);
  else {
    document.getElementById('slot-b-empty').style.display = '';
    document.getElementById('slot-b-content').style.display = 'none';
    document.getElementById('slot-b-content').innerHTML = '';
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
