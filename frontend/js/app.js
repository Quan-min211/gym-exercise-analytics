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

let _t = (key, fallback) => fallback || key;
import('./i18n.js').then(mod => { _t = mod.t; }).catch(() => {});

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
  const viewBtn = el('span', { class: 'btn btn-primary btn-sm', text: _t('common.view_exercise', 'View Exercise') });
  viewBtn.setAttribute('data-i18n', 'common.view_exercise');
  figcap.appendChild(viewBtn);
  fig.appendChild(img);
  fig.appendChild(figcap);

  // ---- Mini favourite button (top-right corner) ----
  try {
    // Dynamic import so pages that don't have favorites.js still work
    import('./favorites.js').then(({ buildFavoriteButton }) => {
      const favBtn = buildFavoriteButton(exercise.id, { mini: true });
      fig.appendChild(favBtn);
    }).catch(() => {}); // silent fail if module unavailable
  } catch { /* ignore */ }

  const body = el('div', { class: 'card-body' });
  const title = el('h3', { text: exercise.name });
  const tags = el('div', { class: 'tags' });

  tags.appendChild(el('span', { class: 'tag tag-red', text: exercise.body_part }));
  tags.appendChild(el('span', { class: 'tag tag-iron', text: exercise.equipment }));

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

// ---------------------------------------------------------------------------
// Mobile hamburger menu toggle
// ---------------------------------------------------------------------------

(function initMobileNav() {
  const header = document.querySelector('.header-inner');
  const nav = document.querySelector('.main-nav');
  if (!header || !nav) return;

  const toggle = document.createElement('button');
  toggle.className = 'nav-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Toggle navigation menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = `
    <svg class="icon-open" aria-hidden="true" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M3 6h18M3 12h18M3 18h18"/>
    </svg>
    <svg class="icon-close" aria-hidden="true" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"
      style="display:none">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>`;
  header.appendChild(toggle);

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.icon-open').style.display = open ? 'none' : '';
    toggle.querySelector('.icon-close').style.display = open ? '' : 'none';
  });

  // Close menu when a link is clicked
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.querySelector('.icon-open').style.display = '';
      toggle.querySelector('.icon-close').style.display = 'none';
    }
  });
})();

// ---------------------------------------------------------------------------
// Scroll-to-top button (with scroll-progress ring)
// ---------------------------------------------------------------------------

(function initScrollToTop() {
  // Circumference of r=19 circle ≈ 119.4; using r=18 → 113.1
  const CIRC = 2 * Math.PI * 18; // ≈ 113.1

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'scroll-top-btn';
  btn.setAttribute('aria-label', 'Scroll to top');
  btn.style.position = 'relative';
  btn.innerHTML = `
    <svg class="progress-ring" aria-hidden="true" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="18" style="stroke-dasharray:${CIRC};stroke-dashoffset:${CIRC};"/>
    </svg>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" style="position:relative;z-index:1"
      stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
      <path d="M18 15l-6-6-6 6"/>
    </svg>`;
  document.body.appendChild(btn);

  const circle = btn.querySelector('.progress-ring circle');

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrolled = window.scrollY;
        const total    = document.documentElement.scrollHeight - window.innerHeight;
        const pct      = total > 0 ? Math.min(scrolled / total, 1) : 0;

        btn.classList.toggle('is-visible', scrolled > 300);
        // Progress ring offset: 0 = full circle shown, CIRC = empty
        circle.style.strokeDashoffset = CIRC * (1 - pct);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// ---------------------------------------------------------------------------
// Mobile hamburger nav drawer (injected globally via app.js)
// ---------------------------------------------------------------------------

(function initMobileNav() {
  const headerInner = document.querySelector('.header-inner');
  if (!headerInner) return;

  // ── 1. Hamburger button ──────────────────────────────────
  const hamburger = document.createElement('button');
  hamburger.type = 'button';
  hamburger.className = 'nav-hamburger';
  hamburger.setAttribute('aria-label', 'Open navigation menu');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-controls', 'mobile-nav-drawer');
  hamburger.innerHTML = `
    <span class="bar" aria-hidden="true"></span>
    <span class="bar" aria-hidden="true"></span>
    <span class="bar" aria-hidden="true"></span>`;
  headerInner.appendChild(hamburger);

  // ── 2. Build nav links from existing desktop nav ─────────
  const desktopLinks = [...document.querySelectorAll('.main-nav a')];

  const navItems = desktopLinks.map(a => ({
    href    : a.getAttribute('href'),
    label   : a.getAttribute('data-i18n') || a.textContent.trim(),
    text    : a.textContent.trim(),
    current : a.getAttribute('aria-current') === 'page',
    i18n    : a.getAttribute('data-i18n'),
  }));

  // ── 3. Create overlay + drawer ───────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'mobile-nav-overlay';
  overlay.id = 'mobile-nav-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  // Detect current lang from localStorage (mirrors i18n.js)
  const currentLang = localStorage.getItem('fitdata_lang') || 'en';

  const drawer = document.createElement('nav');
  drawer.className = 'mobile-nav-drawer';
  drawer.id = 'mobile-nav-drawer';
  drawer.setAttribute('aria-label', 'Mobile navigation');

  drawer.innerHTML = `
    <div class="mobile-nav-header">
      <a href="/" class="mobile-nav-logo" aria-label="FitData Hub home">Fit<strong>Data</strong>Hub</a>
      <button type="button" class="mobile-nav-close" id="mobile-nav-close-btn" aria-label="Close navigation menu">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
          stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <ul class="mobile-nav-list" role="list">
      ${navItems.map(item => `
        <li>
          <a href="${item.href}"
            ${item.current ? 'aria-current="page"' : ''}
            ${item.i18n ? `data-i18n="${item.i18n}"` : ''}>
            ${item.text}
          </a>
        </li>`).join('')}
    </ul>
    <footer class="mobile-nav-footer">
      <button type="button" class="mobile-lang-btn ${currentLang === 'en' ? 'is-active' : ''}" data-mobile-lang="en">
        🇺🇸 EN
      </button>
      <button type="button" class="mobile-lang-btn ${currentLang === 'vi' ? 'is-active' : ''}" data-mobile-lang="vi">
        🇻🇳 VI
      </button>
    </footer>`;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  // ── 4. Open / Close helpers ──────────────────────────────
  function openDrawer() {
    overlay.classList.add('is-open');
    drawer.classList.add('is-open');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.setAttribute('aria-label', 'Close navigation menu');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    // Focus first link in drawer
    drawer.querySelector('a, button')?.focus();
  }

  function closeDrawer() {
    overlay.classList.remove('is-open');
    drawer.classList.remove('is-open');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Open navigation menu');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    hamburger.focus();
  }

  // ── 5. Event listeners ───────────────────────────────────
  hamburger.addEventListener('click', () => {
    const isOpen = drawer.classList.contains('is-open');
    isOpen ? closeDrawer() : openDrawer();
  });

  overlay.addEventListener('click', closeDrawer);
  drawer.getElementById?.('mobile-nav-close-btn')?.addEventListener('click', closeDrawer);
  // querySelector fallback (getElementById on element not supported in all browsers)
  drawer.querySelector('#mobile-nav-close-btn')?.addEventListener('click', closeDrawer);

  // Escape key closes drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      closeDrawer();
    }
  });

  // Trap focus inside drawer when open
  drawer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = [...drawer.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])')];
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // ── 6. Mobile lang buttons ───────────────────────────────
  drawer.querySelectorAll('[data-mobile-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.mobileLang;
      // Sync with i18n module
      window.dispatchEvent(new CustomEvent('mobile-lang-select', { detail: { lang } }));
      // Visually update buttons
      drawer.querySelectorAll('[data-mobile-lang]').forEach(b => {
        b.classList.toggle('is-active', b.dataset.mobileLang === lang);
      });
      closeDrawer();
    });
  });

  // Listen for lang-changed events from i18n.js to keep buttons in sync
  window.addEventListener('lang-changed', (e) => {
    const lang = e.detail?.lang;
    if (!lang) return;
    drawer.querySelectorAll('[data-mobile-lang]').forEach(b => {
      b.classList.toggle('is-active', b.dataset.mobileLang === lang);
    });
  });
})();


// ---------------------------------------------------------------------------
// Rest Timer Widget (Global)
// ---------------------------------------------------------------------------

(function initRestTimer() {
  const container = document.createElement('div');
  container.className = 'rest-timer-widget';
  container.innerHTML = `
    <button type="button" class="rest-timer-toggle" aria-label="Rest timer" aria-expanded="false">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span class="timer-label">00:60</span>
    </button>
    <div class="rest-timer-panel" role="dialog" aria-label="Rest timer controls">
      <div class="rest-timer-display">01:00</div>
      <div class="rest-timer-presets">
        <button type="button" class="rest-timer-preset-btn" data-sec="30">30s</button>
        <button type="button" class="rest-timer-preset-btn" data-sec="45">45s</button>
        <button type="button" class="rest-timer-preset-btn active" data-sec="60">60s</button>
        <button type="button" class="rest-timer-preset-btn" data-sec="90">90s</button>
      </div>
      <div class="rest-timer-controls">
        <button type="button" class="btn btn-primary btn-sm timer-start-btn">Start</button>
        <button type="button" class="btn btn-ghost btn-sm timer-reset-btn">Reset</button>
      </div>
    </div>`;

  document.body.appendChild(container);

  const toggle = container.querySelector('.rest-timer-toggle');
  const panel = container.querySelector('.rest-timer-panel');
  const label = container.querySelector('.timer-label');
  const display = container.querySelector('.rest-timer-display');
  const startBtn = container.querySelector('.timer-start-btn');
  const resetBtn = container.querySelector('.timer-reset-btn');
  const presetBtns = container.querySelectorAll('.rest-timer-preset-btn');

  let duration = 60;
  let remaining = 60;
  let timerId = null;
  let isRunning = false;

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateUI() {
    display.textContent = fmt(remaining);
    label.textContent = fmt(remaining);
    startBtn.textContent = isRunning ? 'Pause' : 'Start';
    toggle.classList.toggle('is-running', isRunning);
  }

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch { /* AudioContext fallback */ }
  }

  function startTimer() {
    if (isRunning) {
      clearInterval(timerId);
      isRunning = false;
      updateUI();
      return;
    }

    if (remaining <= 0) remaining = duration;
    isRunning = true;
    toggle.classList.remove('is-finished');
    updateUI();

    timerId = setInterval(() => {
      remaining--;
      updateUI();
      if (remaining <= 0) {
        clearInterval(timerId);
        isRunning = false;
        toggle.classList.remove('is-running');
        toggle.classList.add('is-finished');
        updateUI();
        playBeep();
      }
    }, 1000);
  }

  function resetTimer() {
    clearInterval(timerId);
    isRunning = false;
    remaining = duration;
    toggle.classList.remove('is-running', 'is-finished');
    updateUI();
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = panel.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      duration = parseInt(btn.dataset.sec, 10);
      resetTimer();
    });
  });

  startBtn.addEventListener('click', startTimer);
  resetBtn.addEventListener('click', resetTimer);

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      panel.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
})();

