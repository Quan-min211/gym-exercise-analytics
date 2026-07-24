/**
 * app.js — API client + shared utilities
 * Imported as a module by all pages.
 */

const API_BASE = '/api';

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const api = {
  async get(path, params = {}) {
    const url = new URL(API_BASE + path, window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    return res.json();
  },

  async post(path, body) {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    return res.json();
  },

  async put(path, body) {
    const res = await fetch(API_BASE + path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    return res.json();
  },

  async delete(path) {
    const res = await fetch(API_BASE + path, { method: 'DELETE' });
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  },
};

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') element.className = v;
    else if (k === 'text') element.textContent = v;
    else if (k === 'html') element.innerHTML = v;
    else element.setAttribute(k, v);
  });
  children.forEach(child => {
    if (typeof child === 'string') element.appendChild(document.createTextNode(child));
    else if (child) element.appendChild(child);
  });
  return element;
}

// ---------------------------------------------------------------------------
// Navigation: mark current page link
// ---------------------------------------------------------------------------

export function markCurrentNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.main-nav a').forEach(link => {
    const href = link.getAttribute('href');
    const isCurrent = href === path || (href !== '/' && path.startsWith(href));
    link.setAttribute('aria-current', isCurrent ? 'page' : 'false');
  });
}

// ---------------------------------------------------------------------------
// Debounce
// ---------------------------------------------------------------------------

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ---------------------------------------------------------------------------
// Exercise card builder (shared across pages)
// ---------------------------------------------------------------------------

export function buildExerciseCard(exercise) {
  const card = el('article', { class: 'card exercise-card' });

  const fig = el('figure');
  const img = el('img', {
    src: `/${exercise.image}`,
    alt: `${exercise.name} exercise demonstration`,
    loading: 'lazy',
    width: '240',
    height: '240',
  });
  const figcap = el('figcaption');
  const viewBtn = el('span', { class: 'btn btn-primary btn-sm', text: 'View Exercise' });
  figcap.appendChild(viewBtn);
  fig.appendChild(img);
  fig.appendChild(figcap);

  const body = el('div', { class: 'card-body' });
  const title = el('h3', { text: exercise.name });
  const tags = el('div', { class: 'tags' });

  tags.appendChild(el('span', { class: 'tag tag-accent', text: exercise.body_part }));
  tags.appendChild(el('span', { class: 'tag tag-neutral', text: exercise.equipment }));

  body.appendChild(title);
  body.appendChild(tags);

  card.appendChild(fig);
  card.appendChild(body);

  card.addEventListener('click', () => {
    window.location.href = `/exercise.html?id=${exercise.id}`;
  });
  card.style.cursor = 'pointer';

  // Keyboard accessible
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `View details for ${exercise.name}`);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.href = `/exercise.html?id=${exercise.id}`;
    }
  });

  return card;
}

// ---------------------------------------------------------------------------
// Pagination builder
// ---------------------------------------------------------------------------

export function buildPagination(container, { page, totalPages, onPageChange }) {
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const addBtn = (label, pageNum, isActive = false, isDisabled = false) => {
    const btn = el('button', {
      text: String(label),
      class: isActive ? 'active' : '',
      'aria-label': `Page ${label}`,
      'aria-current': isActive ? 'page' : undefined,
    });
    if (isDisabled) btn.disabled = true;
    if (!isDisabled) btn.addEventListener('click', () => onPageChange(pageNum));
    container.appendChild(btn);
  };

  addBtn('«', page - 1, false, page <= 1);

  // Show page window
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let p = start; p <= end; p++) addBtn(p, p, p === page);

  addBtn('»', page + 1, false, page >= totalPages);
}

// Init nav
markCurrentNav();
