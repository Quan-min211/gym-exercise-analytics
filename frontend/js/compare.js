/**
 * compare.js — Exercise Comparison page controller.
 *
 * Features:
 *   - Search autocomplete for both slots (debounced)
 *   - Load full exercise data via GET /api/exercises/{id}
 *   - Render GIF, meta strip, muscle tags (target / shared / unique)
 *   - URL param pre-loading (?a=id1&b=id2)
 *   - Swap exercises
 *   - Analysis panel: shared/unique muscle cards + diff table
 *   - Share URL button + clipboard toast
 */

import { api, el } from './app.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let exA = null;  // full exercise object for slot A
let exB = null;  // full exercise object for slot B

// ---------------------------------------------------------------------------
// DOM refs (populated after DOMContentLoaded)
// ---------------------------------------------------------------------------

const $ = sel => document.querySelector(sel);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a muscle name for comparison */
const norm = s => s?.toLowerCase().trim() ?? '';

/** All muscles (target + secondary) for an exercise object */
function allMuscles(ex) {
  const muscles = new Set();
  if (ex.target) muscles.add(norm(ex.target));
  (ex.secondary_muscles ?? []).forEach(m => muscles.add(norm(m)));
  return muscles;
}

function tag(text, cls) {
  const t = document.createElement('span');
  t.className = `muscle-tag ${cls}`;
  t.textContent = text;
  return t;
}

function diffBadge(value, same) {
  const span = document.createElement('span');
  span.className = `diff-badge ${same ? 'diff-same' : ''}`;
  span.textContent = value;
  if (!same) {
    span.style.background = 'rgba(255,255,255,0.06)';
    span.style.border = '1px solid var(--color-border)';
    span.style.textTransform = 'capitalize';
  }
  return span;
}

// ---------------------------------------------------------------------------
// Search autocomplete
// ---------------------------------------------------------------------------

function setupSearch(inputId, resultsId, slot) {
  const input   = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (!input || !results) return;

  let timer = null;

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();

    if (q.length < 2) {
      results.classList.remove('is-open');
      results.innerHTML = '';
      return;
    }

    timer = setTimeout(async () => {
      try {
        const data = await api.get('/exercises/search', { q, page_size: 8 });
        results.innerHTML = '';

        if (!data.items?.length) {
          results.innerHTML = '<li style="padding:12px 16px;color:var(--color-text-muted);font-size:13px;">No results found.</li>';
          results.classList.add('is-open');
          return;
        }

        data.items.forEach(item => {
          const li = document.createElement('li');
          li.role = 'option';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'slot-result-item';
          btn.innerHTML = `
            <img src="/${item.image}" alt="" loading="lazy" width="38" height="38">
            <span class="slot-result-meta">
              <strong>${item.name}</strong>
              <small>${item.body_part ?? ''} · ${item.equipment ?? ''}</small>
            </span>`;

          btn.addEventListener('click', async () => {
            results.classList.remove('is-open');
            input.value = '';
            try {
              const full = await api.get(`/exercises/${item.id}`);
              if (slot === 'a') exA = full;
              else              exB = full;
              renderSlot(slot, full);
              updateVS();
              updateURL();
              updateAnalysis();
            } catch (err) {
              console.error('Failed to load exercise:', err);
            }
          });

          li.appendChild(btn);
          results.appendChild(li);
        });

        results.classList.add('is-open');
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 280);
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove('is-open');
    }
  });

  // Keyboard navigation within dropdown
  input.addEventListener('keydown', e => {
    if (!results.classList.contains('is-open')) return;
    const btns = [...results.querySelectorAll('.slot-result-item')];
    if (!btns.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      btns[0]?.focus();
    } else if (e.key === 'Escape') {
      results.classList.remove('is-open');
      input.focus();
    }
  });

  results.addEventListener('keydown', e => {
    const btns = [...results.querySelectorAll('.slot-result-item')];
    const idx  = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[idx + 1]?.focus(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); idx > 0 ? btns[idx - 1].focus() : input.focus(); }
    if (e.key === 'Escape')    { results.classList.remove('is-open'); input.focus(); }
  });
}

// ---------------------------------------------------------------------------
// Render exercise in a slot
// ---------------------------------------------------------------------------

function renderSlot(slot, ex) {
  const emptyEl   = document.getElementById(`slot-${slot}-empty`);
  const contentEl = document.getElementById(`slot-${slot}-content`);
  if (!emptyEl || !contentEl) return;

  emptyEl.style.display = 'none';
  contentEl.innerHTML = '';
  contentEl.classList.remove('is-loaded');

  // ── Header (name + change button) ─────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'slot-content-header';

  const titleRow = document.createElement('div');
  titleRow.className = 'slot-title-row';

  const badge = document.createElement('span');
  badge.className = 'slot-badge';
  badge.textContent = slot.toUpperCase();

  const nameLink = document.createElement('a');
  nameLink.href = `/exercise.html?id=${ex.id}`;
  nameLink.className = 'slot-name';
  nameLink.textContent = ex.name;
  nameLink.title = `View full details for ${ex.name}`;

  titleRow.appendChild(badge);
  titleRow.appendChild(nameLink);

  const changeBtn = document.createElement('button');
  changeBtn.type = 'button';
  changeBtn.className = 'slot-change-btn';
  changeBtn.textContent = '✕ Change';
  changeBtn.setAttribute('aria-label', `Change ${slot === 'a' ? 'first' : 'second'} exercise`);
  changeBtn.addEventListener('click', () => clearSlot(slot));

  header.appendChild(titleRow);
  header.appendChild(changeBtn);
  contentEl.appendChild(header);

  // ── GIF ───────────────────────────────────────────────────────────────────
  const gif = document.createElement('img');
  gif.src = `/${ex.gif_url || ex.image}`;
  gif.alt = `${ex.name} animated demonstration`;
  gif.className = 'slot-gif';
  gif.loading = 'lazy';
  contentEl.appendChild(gif);

  // ── Meta strip ────────────────────────────────────────────────────────────
  const metaGrid = document.createElement('dl');
  metaGrid.className = 'slot-meta-grid';

  [
    { label: 'Body Part', value: ex.body_part },
    { label: 'Equipment', value: ex.equipment },
    { label: 'Target',    value: ex.target    },
  ].forEach(({ label, value }) => {
    const cell = document.createElement('div');
    cell.className = 'slot-meta-cell';
    cell.innerHTML = `<dt>${label}</dt><dd>${value ?? '—'}</dd>`;
    metaGrid.appendChild(cell);
  });
  contentEl.appendChild(metaGrid);

  // ── Muscles section ───────────────────────────────────────────────────────
  const muscleSection = document.createElement('div');
  muscleSection.className = 'slot-section';
  muscleSection.id = `muscles-section-${slot}`;

  const muscleTitle = document.createElement('p');
  muscleTitle.className = 'slot-section-title';
  muscleTitle.textContent = 'Muscles';

  const muscleWrap = document.createElement('div');
  muscleWrap.className = 'muscle-tags';
  muscleWrap.id = `muscle-tags-${slot}`;

  // Target muscle
  muscleWrap.appendChild(tag(ex.target ?? '—', 'target'));

  // Secondary muscles
  (ex.secondary_muscles ?? []).forEach(m => {
    muscleWrap.appendChild(tag(m, 'unique'));  // will update after both loaded
  });

  muscleSection.appendChild(muscleTitle);
  muscleSection.appendChild(muscleWrap);
  contentEl.appendChild(muscleSection);

  // ── Instructions ──────────────────────────────────────────────────────────
  const steps = ex.instructions?.steps ?? ex.instructions ?? [];
  if (steps.length > 0) {
    const instrSection = document.createElement('div');
    instrSection.className = 'slot-section';

    const instrTitle = document.createElement('p');
    instrTitle.className = 'slot-section-title';
    instrTitle.textContent = 'Instructions';

    const ol = document.createElement('ol');
    ol.className = 'slot-instructions';
    steps.forEach(step => {
      const li = document.createElement('li');
      li.textContent = step;
      ol.appendChild(li);
    });

    instrSection.appendChild(instrTitle);
    instrSection.appendChild(ol);
    contentEl.appendChild(instrSection);
  }

  // Show content (triggers animation)
  void contentEl.offsetWidth;
  contentEl.classList.add('is-loaded');
}

// ---------------------------------------------------------------------------
// Clear a slot
// ---------------------------------------------------------------------------

function clearSlot(slot) {
  if (slot === 'a') exA = null;
  else              exB = null;

  const emptyEl   = document.getElementById(`slot-${slot}-empty`);
  const contentEl = document.getElementById(`slot-${slot}-content`);
  if (emptyEl)   emptyEl.style.display = '';
  if (contentEl) { contentEl.innerHTML = ''; contentEl.classList.remove('is-loaded'); }

  updateVS();
  updateURL();
  updateAnalysis();
}

// ---------------------------------------------------------------------------
// VS bar
// ---------------------------------------------------------------------------

function updateVS() {
  const bar = document.getElementById('compare-vs-bar');
  if (!bar) return;

  if (exA && exB) {
    document.getElementById('vs-name-a').textContent = exA.name;
    document.getElementById('vs-name-b').textContent = exB.name;
    bar.classList.add('is-visible');
  } else {
    bar.classList.remove('is-visible');
  }
}

// ---------------------------------------------------------------------------
// Analysis: muscle overlap + diff table
// ---------------------------------------------------------------------------

function updateAnalysis() {
  const panel = document.getElementById('compare-analysis');
  if (!panel) return;

  if (!exA || !exB) {
    panel.classList.remove('is-visible');
    return;
  }

  panel.classList.add('is-visible');

  const musclesA = allMuscles(exA);
  const musclesB = allMuscles(exB);
  const shared   = new Set([...musclesA].filter(m => musclesB.has(m)));
  const onlyA    = new Set([...musclesA].filter(m => !musclesB.has(m)));
  const onlyB    = new Set([...musclesB].filter(m => !musclesA.has(m)));

  // ── Muscle overlap cards ──────────────────────────────────────────────────
  const fillTags = (containerId, muscles, cls) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    if (muscles.size === 0) {
      el.innerHTML = '<em style="font-size:var(--text-xs);color:var(--color-text-muted);">None</em>';
      return;
    }
    muscles.forEach(m => el.appendChild(tag(m, cls)));
  };

  fillTags('shared-muscles',  shared, 'shared');
  fillTags('only-a-muscles',  onlyA,  'unique');
  fillTags('only-b-muscles',  onlyB,  'unique');

  // Update "Only in A/B" titles with exercise names
  const onlyATitle = document.getElementById('only-a-title');
  const onlyBTitle = document.getElementById('only-b-title');
  if (onlyATitle) onlyATitle.innerHTML = `<span class="analysis-dot dot-a"></span> Only in <strong>${exA.name}</strong>`;
  if (onlyBTitle) onlyBTitle.innerHTML = `<span class="analysis-dot dot-b"></span> Only in <strong>${exB.name}</strong>`;

  // ── Re-colour muscle tags in slots (shared = green) ─────────────────────
  recolourMuscleTags('a', shared);
  recolourMuscleTags('b', shared);

  // ── Diff table header ─────────────────────────────────────────────────────
  const colA = document.getElementById('diff-col-a');
  const colB = document.getElementById('diff-col-b');
  if (colA) colA.textContent = exA.name;
  if (colB) colB.textContent = exB.name;

  // ── Diff rows ─────────────────────────────────────────────────────────────
  const tbody = document.getElementById('diff-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const rows = [
    { attr: 'Body Part', va: exA.body_part,  vb: exB.body_part  },
    { attr: 'Equipment', va: exA.equipment,  vb: exB.equipment  },
    { attr: 'Target',    va: exA.target,     vb: exB.target     },
    {
      attr: 'Secondary',
      va: (exA.secondary_muscles ?? []).join(', ') || '—',
      vb: (exB.secondary_muscles ?? []).join(', ') || '—',
    },
  ];

  rows.forEach(({ attr, va, vb }) => {
    const same = norm(va) === norm(vb);
    const tr = document.createElement('tr');

    const tdAttr = document.createElement('td');
    tdAttr.textContent = attr;

    const tdA = document.createElement('td');
    tdA.appendChild(diffBadge(va ?? '—', same));

    const tdB = document.createElement('td');
    tdB.appendChild(diffBadge(vb ?? '—', same));

    if (!same) {
      tdA.style.color = 'hsl(215,70%,65%)';
      tdB.style.color = 'hsl(340,65%,70%)';
    }

    tr.appendChild(tdAttr);
    tr.appendChild(tdA);
    tr.appendChild(tdB);
    tbody.appendChild(tr);
  });
}

function recolourMuscleTags(slot, sharedSet) {
  const wrap = document.getElementById(`muscle-tags-${slot}`);
  if (!wrap) return;
  wrap.querySelectorAll('.muscle-tag:not(.target)').forEach(t => {
    const name = norm(t.textContent);
    t.className = `muscle-tag ${sharedSet.has(name) ? 'shared' : 'unique'}`;
  });
}

// ---------------------------------------------------------------------------
// URL sync
// ---------------------------------------------------------------------------

function updateURL() {
  const params = new URLSearchParams();
  if (exA) params.set('a', exA.id);
  if (exB) params.set('b', exB.id);
  const newURL = params.size
    ? `${window.location.pathname}?${params}`
    : window.location.pathname;
  window.history.replaceState({}, '', newURL);
}

// ---------------------------------------------------------------------------
// Share button
// ---------------------------------------------------------------------------

function setupShare() {
  const shareBtn = document.getElementById('share-btn');
  const toast    = document.getElementById('share-toast');
  if (!shareBtn || !toast) return;

  shareBtn.addEventListener('click', async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback: select a temp input
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }

    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 3000);
  });
}

// ---------------------------------------------------------------------------
// Swap
// ---------------------------------------------------------------------------

function swapExercises() {
  const temp = exA; exA = exB; exB = temp;

  if (exA) renderSlot('a', exA);
  else     clearSlot('a');

  if (exB) renderSlot('b', exB);
  else     clearSlot('b');

  updateVS();
  updateURL();
  updateAnalysis();
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  setupSearch('search-a', 'results-a', 'a');
  setupSearch('search-b', 'results-b', 'b');
  setupShare();

  // Swap button
  document.getElementById('swap-btn')?.addEventListener('click', swapExercises);

  // Pre-load from URL params (?a=id1&b=id2) — e.g. linked from exercise detail
  const params = new URLSearchParams(window.location.search);
  const idA = params.get('a');
  const idB = params.get('b');

  const loads = [];

  if (idA) {
    loads.push(
      api.get(`/exercises/${idA}`)
        .then(data => { exA = data; renderSlot('a', data); })
        .catch(err => console.warn('Could not load exercise A:', err))
    );
  }

  if (idB) {
    loads.push(
      api.get(`/exercises/${idB}`)
        .then(data => { exB = data; renderSlot('b', data); })
        .catch(err => console.warn('Could not load exercise B:', err))
    );
  }

  if (loads.length) {
    await Promise.allSettled(loads);
    updateVS();
    updateAnalysis();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
