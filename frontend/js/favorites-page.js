/**
 * favorites-page.js — Favorites page controller (enhanced).
 * Features:
 *   - Load & render saved exercises with animated cards
 *   - Sort: newest / oldest / A-Z
 *   - Filter: by body-part and equipment
 *   - Bulk select + remove
 *   - Export to CSV or JSON
 *   - Share (copies summary to clipboard)
 *   - Clear all with confirmation
 */

import { api, buildExerciseCard } from './app.js';
import { getFavorites, toggleFavorite, dispatchFavoritesChange } from './favorites.js';

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const grid         = document.getElementById('fav-grid');
const countEl      = document.getElementById('fav-count');
const emptyState   = document.getElementById('empty-state');
const clearBar     = document.getElementById('clear-all-bar');
const toolbar      = document.getElementById('fav-toolbar');
const sortSel      = document.getElementById('fav-sort');
const filterBp     = document.getElementById('fav-filter-bp');
const filterEq     = document.getElementById('fav-filter-eq');
const bulkBar      = document.getElementById('bulk-actions-bar');
const selectedCnt  = document.getElementById('selected-count');
const shareResult  = document.getElementById('share-result');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let _exerciseCache = [];   // all fetched exercise objects
let _bulkMode      = false;

// ---------------------------------------------------------------------------
// Fetch + render
// ---------------------------------------------------------------------------

async function renderFavorites() {
  const ids = getFavorites();

  countEl.textContent = ids.length;
  document.title = `My Favourites (${ids.length}) — FitData Hub`;

  if (ids.length === 0) {
    grid.innerHTML = '';
    emptyState.hidden = false;
    clearBar.hidden   = true;
    toolbar.hidden    = true;
    bulkBar.classList.remove('is-active');
    shareResult.classList.remove('is-open');
    _exerciseCache = [];
    return;
  }

  emptyState.hidden = false; // keep hidden until fetch done
  emptyState.hidden = true;
  clearBar.hidden   = false;
  toolbar.hidden    = false;

  // Fetch in parallel
  const results = await Promise.allSettled(
    ids.map(id => api.get(`/exercises/${id}`))
  );

  _exerciseCache = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  // Build filter options from data
  _populateFilters(_exerciseCache);

  _applyAndRender();
}

// ---------------------------------------------------------------------------
// Filter population
// ---------------------------------------------------------------------------

function _populateFilters(exercises) {
  const bodyParts = [...new Set(exercises.map(e => e.body_part).filter(Boolean))].sort();
  const equipments = [...new Set(exercises.map(e => e.equipment).filter(Boolean))].sort();

  _syncOptions(filterBp, bodyParts, 'All body parts');
  _syncOptions(filterEq, equipments, 'All equipment');
}

function _syncOptions(selectEl, values, allLabel) {
  const current = selectEl.value;
  // Keep first "All" option, rebuild the rest
  while (selectEl.options.length > 1) selectEl.remove(1);
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v.charAt(0).toUpperCase() + v.slice(1);
    selectEl.appendChild(opt);
  });
  if (values.includes(current)) selectEl.value = current;
}

// ---------------------------------------------------------------------------
// Apply sort + filter + render
// ---------------------------------------------------------------------------

function _applyAndRender() {
  let exercises = [..._exerciseCache];

  // Filter
  const bp = filterBp.value;
  const eq = filterEq.value;
  if (bp) exercises = exercises.filter(e => e.body_part === bp);
  if (eq) exercises = exercises.filter(e => e.equipment === eq);

  // Sort
  const sort = sortSel.value;
  const ids = getFavorites();  // order preserved as insertion order
  if (sort === 'newest') {
    exercises.sort((a, b) => ids.indexOf(String(b.id)) - ids.indexOf(String(a.id)));
  } else if (sort === 'oldest') {
    exercises.sort((a, b) => ids.indexOf(String(a.id)) - ids.indexOf(String(b.id)));
  } else if (sort === 'alpha') {
    exercises.sort((a, b) => a.name.localeCompare(b.name));
  }

  _renderCards(exercises);
}

function _renderCards(exercises) {
  grid.innerHTML = '';

  exercises.forEach((ex, idx) => {
    const wrapper = document.createElement('article');
    wrapper.className = 'fav-card-wrapper' + (_bulkMode ? ' is-bulk' : '');
    wrapper.style.animationDelay = `${idx * 40}ms`;
    wrapper.dataset.id = ex.id;

    // Bulk checkbox
    const checkLabel = document.createElement('label');
    checkLabel.className = 'bulk-check';
    checkLabel.setAttribute('aria-label', `Select ${ex.name}`);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.addEventListener('change', _updateBulkCount);
    checkLabel.appendChild(checkbox);
    wrapper.appendChild(checkLabel);

    // Card
    const card = buildExerciseCard({
      id: ex.id, name: ex.name, image: ex.image,
      body_part: ex.body_part, equipment: ex.equipment,
    });
    wrapper.appendChild(card);

    // Remove button overlay
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'fav-remove-btn';
    removeBtn.setAttribute('aria-label', `Remove ${ex.name} from favourites`);
    removeBtn.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 0 1 7.5 3c1.74 0 3.41.81 4.5 2.09A5.989 5.989 0 0 1 16.5 3 5.5 5.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); e.preventDefault();
      toggleFavorite(ex.id);
      wrapper.style.transition = 'opacity 0.2s, transform 0.2s';
      wrapper.style.opacity    = '0';
      wrapper.style.transform  = 'scale(0.9)';
      setTimeout(() => renderFavorites(), 220);
    });

    wrapper.appendChild(removeBtn);
    grid.appendChild(wrapper);
  });
}

// ---------------------------------------------------------------------------
// Bulk select
// ---------------------------------------------------------------------------

function _updateBulkCount() {
  const checked = grid.querySelectorAll('.bulk-check input:checked').length;
  selectedCnt.textContent = `${checked} selected`;

  grid.querySelectorAll('.fav-card-wrapper').forEach(w => {
    const cb = w.querySelector('.bulk-check input');
    w.classList.toggle('selected', cb && cb.checked);
  });
}

document.getElementById('bulk-toggle-btn').addEventListener('click', () => {
  _bulkMode = !_bulkMode;
  bulkBar.classList.toggle('is-active', _bulkMode);
  document.getElementById('bulk-toggle-btn').textContent = _bulkMode ? '✕ Exit Bulk' : '☑ Bulk Select';
  grid.querySelectorAll('.fav-card-wrapper').forEach(w => {
    w.classList.toggle('is-bulk', _bulkMode);
    w.classList.remove('selected');
    const cb = w.querySelector('.bulk-check input');
    if (cb) cb.checked = false;
  });
  selectedCnt.textContent = '0 selected';
});

document.getElementById('bulk-cancel-btn').addEventListener('click', () => {
  _bulkMode = false;
  bulkBar.classList.remove('is-active');
  document.getElementById('bulk-toggle-btn').textContent = '☑ Bulk Select';
  grid.querySelectorAll('.fav-card-wrapper').forEach(w => {
    w.classList.remove('is-bulk', 'selected');
    const cb = w.querySelector('.bulk-check input');
    if (cb) cb.checked = false;
  });
});

document.getElementById('bulk-remove-btn').addEventListener('click', () => {
  const checked = [...grid.querySelectorAll('.fav-card-wrapper.selected')];
  if (checked.length === 0) return;
  checked.forEach(w => {
    const id = w.dataset.id;
    const favs = getFavorites();
    if (favs.includes(String(id))) toggleFavorite(id);
  });
  _bulkMode = false;
  bulkBar.classList.remove('is-active');
  document.getElementById('bulk-toggle-btn').textContent = '☑ Bulk Select';
  renderFavorites();
});

// ---------------------------------------------------------------------------
// Sort + filter change handlers
// ---------------------------------------------------------------------------

sortSel.addEventListener('change', _applyAndRender);
filterBp.addEventListener('change', _applyAndRender);
filterEq.addEventListener('change', _applyAndRender);

// ---------------------------------------------------------------------------
// Clear all
// ---------------------------------------------------------------------------

document.getElementById('clear-all-btn').addEventListener('click', () => {
  if (confirm('Remove all saved exercises?')) {
    localStorage.removeItem('fitdata_favorites');
    dispatchFavoritesChange();
    renderFavorites();
  }
});

// ---------------------------------------------------------------------------
// Export CSV
// ---------------------------------------------------------------------------

document.getElementById('export-csv-btn').addEventListener('click', () => {
  if (_exerciseCache.length === 0) return;
  const header = 'id,name,body_part,equipment,target';
  const rows = _exerciseCache.map(e =>
    [e.id, _q(e.name), _q(e.body_part), _q(e.equipment), _q(e.target)].join(',')
  );
  _download('fitdata_favourites.csv', [header, ...rows].join('\n'), 'text/csv');
});

function _q(v) { return `"${String(v || '').replace(/"/g, '""')}"`; }

// ---------------------------------------------------------------------------
// Export JSON
// ---------------------------------------------------------------------------

document.getElementById('export-json-btn').addEventListener('click', () => {
  if (_exerciseCache.length === 0) return;
  const data = _exerciseCache.map(({ id, name, body_part, equipment, target }) =>
    ({ id, name, body_part, equipment, target })
  );
  _download('fitdata_favourites.json', JSON.stringify(data, null, 2), 'application/json');
});

function _download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Share — copy text summary to clipboard
// ---------------------------------------------------------------------------

document.getElementById('share-btn').addEventListener('click', async () => {
  if (_exerciseCache.length === 0) return;

  const lines = _exerciseCache.map(e => `• ${e.name} (${e.body_part || 'N/A'})`);
  const text  = `My FitData Hub Favourites (${_exerciseCache.length}):\n${lines.join('\n')}`;

  try {
    await navigator.clipboard.writeText(text);
    shareResult.textContent = '✅ Copied to clipboard! Paste it anywhere to share your list.';
  } catch {
    shareResult.textContent = text;
  }
  shareResult.classList.add('is-open');
  setTimeout(() => shareResult.classList.remove('is-open'), 5000);
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', renderFavorites);
