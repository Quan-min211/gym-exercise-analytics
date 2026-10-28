/**
 * muscle-map.js — Interactive SVG Body Map
 *
 * Renders a dual-view (front + back) clickable body map.
 * Each region dispatches `muscle-selected` CustomEvent with:
 *   detail: { filterType: 'target'|'body_part', filterValue: string, label: string }
 *
 * Deselect by clicking the same region again → dispatches with filterValue: ''
 */

// ---------------------------------------------------------------------------
// Muscle region definitions
// Each entry: { id, label, filterType, filterValue, view: 'front'|'back' }
// ---------------------------------------------------------------------------

const MUSCLE_REGIONS = [
  // ── FRONT ──
  { id: 'neck',           label: 'Neck',            filterType: 'body_part', filterValue: 'neck',        view: 'front' },
  { id: 'delts-front',    label: 'Shoulders',       filterType: 'body_part', filterValue: 'shoulders',   view: 'front' },
  { id: 'chest',          label: 'Chest',           filterType: 'body_part', filterValue: 'chest',       view: 'front' },
  { id: 'biceps',         label: 'Biceps',          filterType: 'target',    filterValue: 'biceps',      view: 'front' },
  { id: 'forearms-front', label: 'Forearms',        filterType: 'target',    filterValue: 'forearms',    view: 'front' },
  { id: 'abs',            label: 'Abs',             filterType: 'target',    filterValue: 'abs',         view: 'front' },
  { id: 'obliques',       label: 'Obliques',        filterType: 'target',    filterValue: 'obliques',    view: 'front' },
  { id: 'hip-flexors',    label: 'Hip Flexors',     filterType: 'target',    filterValue: 'hip flexors', view: 'front' },
  { id: 'adductors',      label: 'Adductors',       filterType: 'target',    filterValue: 'adductors',   view: 'front' },
  { id: 'quads',          label: 'Quads',           filterType: 'target',    filterValue: 'quads',       view: 'front' },
  { id: 'calves-front',   label: 'Calves',          filterType: 'target',    filterValue: 'calves',      view: 'front' },

  // ── BACK ──
  { id: 'traps',          label: 'Traps',           filterType: 'target',    filterValue: 'traps',       view: 'back' },
  { id: 'delts-back',     label: 'Rear Delts',      filterType: 'body_part', filterValue: 'shoulders',   view: 'back' },
  { id: 'upper-back',     label: 'Upper Back',      filterType: 'target',    filterValue: 'upper back',  view: 'back' },
  { id: 'lats',           label: 'Lats',            filterType: 'target',    filterValue: 'lats',        view: 'back' },
  { id: 'triceps',        label: 'Triceps',         filterType: 'target',    filterValue: 'triceps',     view: 'back' },
  { id: 'forearms-back',  label: 'Forearms',        filterType: 'target',    filterValue: 'forearms',    view: 'back' },
  { id: 'spine',          label: 'Spine / Core',    filterType: 'target',    filterValue: 'spine',       view: 'back' },
  { id: 'lower-back',     label: 'Lower Back',      filterType: 'body_part', filterValue: 'back',        view: 'back' },
  { id: 'glutes',         label: 'Glutes',          filterType: 'target',    filterValue: 'glutes',      view: 'back' },
  { id: 'hamstrings',     label: 'Hamstrings',      filterType: 'target',    filterValue: 'hamstrings',  view: 'back' },
  { id: 'calves-back',    label: 'Calves',          filterType: 'target',    filterValue: 'calves',      view: 'back' },
];

// ---------------------------------------------------------------------------
// SVG paths — simplified anatomical shapes on a 120 x 240 viewBox
// ---------------------------------------------------------------------------

const SVG_DEFS = `
  <defs>
    <filter id="mm-glow-filter" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

// Shared static body outline (non-interactive skeleton)
const BODY_OUTLINE_FRONT = `
  <!-- Static body outline -->
  <g class="mm-outline" fill="none" stroke="var(--mm-outline)" stroke-width="0.6" opacity="0.25">
    <!-- torso outline -->
    <path d="M38 42 Q30 48 28 75 Q26 100 28 115 L44 115 L44 42 Z"/>
    <path d="M82 42 Q90 48 92 75 Q94 100 92 115 L76 115 L76 42 Z"/>
    <path d="M44 115 Q44 135 46 175 Q45 200 46 220 L54 220 L54 175 L52 135 L52 115 Z"/>
    <path d="M76 115 Q76 135 74 175 Q75 200 74 220 L66 220 L66 175 L68 135 L68 115 Z"/>
  </g>`;

const BODY_OUTLINE_BACK = `
  <!-- Static body outline -->
  <g class="mm-outline" fill="none" stroke="var(--mm-outline)" stroke-width="0.6" opacity="0.25">
    <path d="M38 42 Q30 48 28 75 Q26 100 28 115 L44 115 L44 42 Z"/>
    <path d="M82 42 Q90 48 92 75 Q94 100 92 115 L76 115 L76 42 Z"/>
    <path d="M44 115 Q44 135 46 175 Q45 200 46 230 L54 230 L54 175 L52 135 L52 115 Z"/>
    <path d="M76 115 Q76 135 74 175 Q75 200 74 230 L66 230 L66 175 L68 135 L68 115 Z"/>
  </g>`;

function rg(id, d, extraD) {
  // Build a <path> (or multiple paths with same data-id) as a string
  const full = extraD ? `${d} ${extraD}` : d;
  return `<path data-id="${id}" class="mm-region" d="${full}"/>`;
}

const FRONT_PATHS = `
  ${BODY_OUTLINE_FRONT}
  <!-- Head -->
  <ellipse cx="60" cy="17" rx="11" ry="14"
    fill="var(--mm-surface)" stroke="var(--mm-border)" stroke-width="0.8" class="mm-static" aria-hidden="true"/>

  <!-- Neck -->
  ${rg('neck', 'M54.5 29 Q60 26 65.5 29 L66 39 Q60 37 54 39 Z')}

  <!-- Shoulders / Delts front -->
  ${rg('delts-front',
    'M38 42 Q30 46 28 57 L35 58 Q39 51 44 49 L44 42 Z',
    'M82 42 Q90 46 92 57 L85 58 Q81 51 76 49 L76 42 Z')}

  <!-- Chest -->
  ${rg('chest', 'M44 42 L44 66 Q52 69 60 69 Q68 69 76 66 L76 42 Q68 39 60 38 Q52 39 44 42 Z')}

  <!-- Biceps -->
  ${rg('biceps',
    'M29 57 Q25 68 27 76 L34 75 Q33 66 35 58 Z',
    'M91 57 Q95 68 93 76 L86 75 Q87 66 85 58 Z')}

  <!-- Forearms front -->
  ${rg('forearms-front',
    'M27 76 Q24 90 27 102 L33 101 Q33 88 34 75 Z',
    'M93 76 Q96 90 93 102 L87 101 Q87 88 86 75 Z')}

  <!-- Abs -->
  ${rg('abs', 'M51 69 Q50 96 52 115 L68 115 Q70 96 69 69 Q64 71 60 71 Q56 71 51 69 Z')}

  <!-- Obliques -->
  ${rg('obliques',
    'M44 66 L44 115 L51 115 Q50 96 51 69 Q48 68 44 66 Z',
    'M76 66 L76 115 L69 115 Q70 96 69 69 Q72 68 76 66 Z')}

  <!-- Hip Flexors -->
  ${rg('hip-flexors', 'M51 115 Q49 127 49 134 Q54 137 60 137 Q66 137 71 134 Q71 127 69 115 Z')}

  <!-- Adductors -->
  ${rg('adductors', 'M53 137 Q52 158 53 175 Q57 172 60 172 Q63 172 67 175 Q68 158 67 137 Q64 139 60 139 Q56 139 53 137 Z')}

  <!-- Quads -->
  ${rg('quads',
    'M49 134 Q44 158 44 177 L53 178 Q53 158 53 175 Q51 155 53 137 Q51 136 49 134 Z',
    'M71 134 Q76 158 76 177 L67 178 Q67 158 67 175 Q69 155 67 137 Q69 136 71 134 Z')}

  <!-- Calves front -->
  ${rg('calves-front',
    'M44 177 Q42 200 44 218 L53 218 Q52 200 53 178 Z',
    'M76 177 Q78 200 76 218 L67 218 Q68 200 67 178 Z')}
`;

const BACK_PATHS = `
  ${BODY_OUTLINE_BACK}
  <!-- Head back -->
  <ellipse cx="60" cy="17" rx="11" ry="14"
    fill="var(--mm-surface)" stroke="var(--mm-border)" stroke-width="0.8" class="mm-static" aria-hidden="true"/>

  <!-- Traps -->
  ${rg('traps', 'M47 29 Q60 24 73 29 L76 42 Q68 39 60 38 Q52 39 44 42 Z M54 29 Q60 27 66 29 L66 39 Q60 37 54 39 Z')}

  <!-- Rear Delts -->
  ${rg('delts-back',
    'M38 42 Q30 46 28 57 L35 58 Q39 51 44 49 L44 42 Z',
    'M82 42 Q90 46 92 57 L85 58 Q81 51 76 49 L76 42 Z')}

  <!-- Upper Back / Rhomboids -->
  ${rg('upper-back', 'M44 49 L44 70 Q52 67 60 67 Q68 67 76 70 L76 49 Q68 46 60 45 Q52 46 44 49 Z')}

  <!-- Lats -->
  ${rg('lats',
    'M44 66 Q39 88 41 108 L50 115 L44 115 L44 66 Z',
    'M76 66 Q81 88 79 108 L70 115 L76 115 L76 66 Z')}

  <!-- Triceps -->
  ${rg('triceps',
    'M29 57 Q25 68 27 76 L34 75 Q33 66 35 58 Z',
    'M91 57 Q95 68 93 76 L86 75 Q87 66 85 58 Z')}

  <!-- Forearms back -->
  ${rg('forearms-back',
    'M27 76 Q24 90 27 102 L33 101 Q33 88 34 75 Z',
    'M93 76 Q96 90 93 102 L87 101 Q87 88 86 75 Z')}

  <!-- Spine -->
  ${rg('spine', 'M57.5 45 Q57 90 57 115 L63 115 Q63 90 62.5 45 Z')}

  <!-- Lower Back -->
  ${rg('lower-back', 'M44 108 L50 115 L57.5 115 L57.5 108 Z M63 115 L70 115 L76 108 L62.5 108 Z M44 108 Q42 115 44 125 Q52 130 60 130 Q68 130 76 125 Q78 115 76 108 Z')}

  <!-- Glutes -->
  ${rg('glutes', 'M48 130 Q44 150 46 167 Q53 172 60 172 Q67 172 74 167 Q76 150 72 130 Q66 134 60 134 Q54 134 48 130 Z')}

  <!-- Hamstrings -->
  ${rg('hamstrings',
    'M46 167 Q43 190 44 210 L53 210 Q53 190 53 172 Z',
    'M74 167 Q77 190 76 210 L67 210 Q67 190 67 172 Z')}

  <!-- Calves back -->
  ${rg('calves-back',
    'M44 210 Q42 222 44 232 L53 232 Q52 222 53 210 Z',
    'M76 210 Q78 222 76 232 L67 232 Q68 222 67 210 Z')}
`;

// ---------------------------------------------------------------------------
// Build SVG element
// ---------------------------------------------------------------------------

function buildSVG(view, paths) {
  const labelId = `mm-title-${view}`;
  const vb = view === 'front' ? '0 0 120 230' : '0 0 120 240';
  return `
    <svg class="muscle-map-svg" viewBox="${vb}"
      role="img" aria-labelledby="${labelId}"
      xmlns="http://www.w3.org/2000/svg">
      <title id="${labelId}">${view === 'front' ? 'Front' : 'Back'} body — click a muscle to filter</title>
      ${SVG_DEFS}
      ${paths}
    </svg>`;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _activeId  = null;
let _container = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initMuscleMap(containerId) {
  _container = document.getElementById(containerId);
  if (!_container) return;

  _container.innerHTML = `
    <div class="mm-views">
      <figure class="mm-figure">
        <figcaption class="mm-view-label" aria-hidden="true">FRONT</figcaption>
        ${buildSVG('front', FRONT_PATHS)}
      </figure>
      <figure class="mm-figure">
        <figcaption class="mm-view-label" aria-hidden="true">BACK</figcaption>
        ${buildSVG('back', BACK_PATHS)}
      </figure>
    </div>
    <output class="mm-label" id="mm-active-label" aria-live="polite" aria-atomic="true">
      Click a muscle group to filter
    </output>`;

  // Wire interactions
  _container.querySelectorAll('.mm-region').forEach(path => {
    const regionId = path.getAttribute('data-id');
    const meta = MUSCLE_REGIONS.find(r => r.id === regionId);
    if (!meta) return;

    // Accessibility
    path.setAttribute('role', 'button');
    path.setAttribute('tabindex', '0');
    path.setAttribute('aria-label', `Filter by ${meta.label}`);
    path.setAttribute('aria-pressed', 'false');

    // SVG title for native tooltip
    const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleEl.textContent = meta.label;
    path.prepend(titleEl);

    path.addEventListener('click', () => _onRegionClick(path, meta));
    path.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        _onRegionClick(path, meta);
      }
    });
  });
}

export function resetMuscleMap() {
  _clearAll();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _onRegionClick(_path, meta) {
  const isSame = _activeId === meta.id;
  if (isSame) {
    _clearAll();
    _dispatch('', '', '');
  } else {
    _setActive(meta);
    _dispatch(meta.filterType, meta.filterValue, meta.label);
  }
}

function _setActive(meta) {
  _activeId = meta.id;

  _container.querySelectorAll('.mm-region').forEach(p => {
    const pid = p.getAttribute('data-id');
    // A filterValue can map to multiple region ids (e.g. calves-front & calves-back)
    const sameMuscle = MUSCLE_REGIONS.find(r => r.id === pid)?.filterValue === meta.filterValue;
    p.classList.toggle('is-active', sameMuscle);
    p.classList.toggle('is-dimmed', !sameMuscle);
    p.setAttribute('aria-pressed', sameMuscle ? 'true' : 'false');
  });

  const lbl = document.getElementById('mm-active-label');
  if (lbl) {
    lbl.textContent = `Filtering: ${meta.label}`;
    lbl.classList.add('has-selection');
  }
}

function _clearAll() {
  _activeId = null;
  if (_container) {
    _container.querySelectorAll('.mm-region').forEach(p => {
      p.classList.remove('is-active', 'is-dimmed');
      p.setAttribute('aria-pressed', 'false');
    });
  }
  const lbl = document.getElementById('mm-active-label');
  if (lbl) {
    lbl.textContent = 'Click a muscle group to filter';
    lbl.classList.remove('has-selection');
  }
}

function _dispatch(filterType, filterValue, label) {
  window.dispatchEvent(new CustomEvent('muscle-selected', {
    detail: { filterType, filterValue, label },
    bubbles: true,
  }));
}

/**
 * Render visual muscle heatmap for Progress Charts
 * Colors anatomical SVG paths according to actual training volume.
 */
export function renderMuscleHeatmap(containerId, volumeMap = {}, onMuscleHover = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="mm-views">
      <figure class="mm-figure">
        <figcaption class="mm-fig-label">Front</figcaption>
        ${buildSVG('front', FRONT_PATHS)}
      </figure>
      <figure class="mm-figure">
        <figcaption class="mm-fig-label">Back</figcaption>
        ${buildSVG('back', BACK_PATHS)}
      </figure>
    </div>
  `;

  // Find max volume to normalize
  const volumes = Object.values(volumeMap).map(v => typeof v === 'object' ? (v.volume || 0) : (Number(v) || 0));
  const maxVol = Math.max(1, ...volumes);

  MUSCLE_REGIONS.forEach(region => {
    const data = volumeMap[region.id] || volumeMap[region.filterValue] || { volume: 0, sets: 0 };
    const vol = typeof data === 'object' ? (data.volume || 0) : (Number(data) || 0);
    const sets = typeof data === 'object' ? (data.sets || 0) : 0;
    const ratio = Math.min(1, vol / maxVol);

    const paths = container.querySelectorAll(`path[data-id="${region.id}"]`);
    paths.forEach(p => {
      p.style.cursor = 'pointer';
      p.style.transition = 'all 0.2s ease';
      p.style.transformOrigin = 'center';

      if (vol === 0) {
        p.style.fill = '#252830';
        p.style.opacity = '0.55';
        p.style.stroke = '#2e3240';
        p.style.strokeWidth = '0.6px';
      } else if (ratio > 0.8) {
        p.style.fill = '#D32F2F';
        p.style.opacity = '1';
        p.style.stroke = '#FFC107';
        p.style.strokeWidth = '1.2px';
      } else {
        p.style.fill = '#D32F2F';
        p.style.opacity = `${0.35 + ratio * 0.55}`;
        p.style.stroke = '#D32F2F';
        p.style.strokeWidth = '0.8px';
      }

      p.addEventListener('mouseenter', () => {
        paths.forEach(pt => {
          pt.style.filter = 'drop-shadow(0 0 5px rgba(211, 47, 47, 0.8))';
        });
        if (onMuscleHover) onMuscleHover({ id: region.id, label: region.label, volume: vol, sets });
      });

      p.addEventListener('mouseleave', () => {
        paths.forEach(pt => {
          pt.style.filter = '';
        });
      });

      p.addEventListener('click', () => {
        if (onMuscleHover) onMuscleHover({ id: region.id, label: region.label, volume: vol, sets, clicked: true });
      });
    });
  });
}

