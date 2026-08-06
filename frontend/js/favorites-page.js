/**
 * favorites-page.js — Favorites page controller.
 * Loads saved IDs from localStorage, fetches exercise data from API,
 * renders cards with remove buttons, and handles clear-all.
 */

import { api, buildExerciseCard, $, el } from './app.js';
import { getFavorites, toggleFavorite, dispatchFavoritesChange } from './favorites.js';

const grid       = document.getElementById('fav-grid');
const countEl    = document.getElementById('fav-count');
const emptyState = document.getElementById('empty-state');
const clearBar   = document.getElementById('clear-all-bar');

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

async function renderFavorites() {
  const ids = getFavorites();

  countEl.textContent = ids.length;
  document.title = `My Favourites (${ids.length}) — FitData Hub`;

  if (ids.length === 0) {
    grid.innerHTML = '';
    emptyState.hidden = false;
    clearBar.hidden = true;
    return;
  }

  emptyState.hidden = true;
  clearBar.hidden = false;

  // Fetch all at once in parallel (exercises are small JSON)
  const results = await Promise.allSettled(
    ids.map(id => api.get(`/exercises/${id}`))
  );

  grid.innerHTML = '';

  results.forEach((result, idx) => {
    if (result.status === 'rejected') return; // skip 404s silently

    const ex = result.value;
    const wrapper = document.createElement('div');
    wrapper.className = 'fav-card-wrapper';
    wrapper.style.animationDelay = `${idx * 40}ms`;

    // Build the standard exercise card
    const card = buildExerciseCard({
      id: ex.id,
      name: ex.name,
      image: ex.image,
      body_part: ex.body_part,
      equipment: ex.equipment,
    });

    // Remove button overlay (heart icon)
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'fav-remove-btn';
    removeBtn.setAttribute('aria-label', `Remove ${ex.name} from favourites`);
    removeBtn.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 0 1 7.5 3c1.74 0 3.41.81 4.5 2.09A5.989 5.989 0 0 1 16.5 3 5.5 5.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>`;

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleFavorite(ex.id);
      // Animate out then re-render
      wrapper.style.transition = 'opacity 0.2s, transform 0.2s';
      wrapper.style.opacity = '0';
      wrapper.style.transform = 'scale(0.9)';
      setTimeout(() => renderFavorites(), 220);
    });

    wrapper.appendChild(card);
    wrapper.appendChild(removeBtn);
    grid.appendChild(wrapper);
  });
}

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
// Init
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', renderFavorites);
