/**
 * favorites.js — Favorites management (localStorage-based, no auth required).
 *
 * Public API:
 *   toggleFavorite(id)       → add/remove, returns new isFav boolean
 *   isFavorite(id)           → boolean
 *   getFavorites()           → string[]
 *   getFavoriteCount()       → number
 *   initFavoriteButton(btn, exerciseId)  → wires up a toggle button + live count
 *   dispatchFavoritesChange()           → fires custom event
 */

const STORAGE_KEY = 'fitdata_favorites';

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveFavorites(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  dispatchFavoritesChange();
}

export function isFavorite(id) {
  return getFavorites().includes(String(id));
}

export function getFavoriteCount() {
  return getFavorites().length;
}

export function toggleFavorite(id) {
  const id_ = String(id);
  const favs = getFavorites();
  if (favs.includes(id_)) {
    saveFavorites(favs.filter(f => f !== id_));
    return false;
  } else {
    saveFavorites([...favs, id_]);
    return true;
  }
}

export function dispatchFavoritesChange() {
  window.dispatchEvent(new CustomEvent('favorites-changed', {
    detail: { count: getFavoriteCount() },
  }));
}

// ---------------------------------------------------------------------------
// Button factory — renders + wires a ❤️ toggle button
// ---------------------------------------------------------------------------

export function buildFavoriteButton(exerciseId, { mini = false } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.favBtn = exerciseId;
  btn.className = mini ? 'fav-btn fav-btn--mini' : 'btn fav-btn';

  const syncState = () => {
    const active = isFavorite(exerciseId);
    btn.setAttribute('aria-pressed', String(active));
    btn.setAttribute('aria-label', active ? 'Remove from favorites' : 'Add to favorites');
    btn.innerHTML = active
      ? `<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 0 1 7.5 3c1.74 0 3.41.81 4.5 2.09A5.989 5.989 0 0 1 16.5 3 5.5 5.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>${mini ? '' : '<span>Saved</span>'}`
      : `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${mini ? '' : '<span>Favorite</span>'}`;
  };

  syncState();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleFavorite(exerciseId);
    syncState();
  });

  // Keep in sync when changed from another component on same page
  window.addEventListener('favorites-changed', syncState);

  return btn;
}

// ---------------------------------------------------------------------------
// Nav badge helper — call once on any page to keep the badge count live
// ---------------------------------------------------------------------------

export function initFavoritesNavBadge() {
  const links = document.querySelectorAll('a[href="/favorites.html"]');

  const updateBadges = () => {
    const count = getFavoriteCount();
    links.forEach(link => {
      let badge = link.querySelector('.fav-count-badge');
      if (!badge) {
        badge = document.createElement('mark');
        badge.className = 'fav-count-badge';
        link.appendChild(badge);
      }
      badge.textContent = count;
      badge.hidden = count === 0;
      badge.setAttribute('aria-label', `${count} saved exercises`);
    });
  };

  updateBadges();
  window.addEventListener('favorites-changed', updateBadges);
}
