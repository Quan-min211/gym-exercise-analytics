import { $, $$, api, buildExerciseCard, buildPagination, debounce, el } from './app.js';
import { initMuscleMap, resetMuscleMap } from './muscle-map.js';


let currentState = {
  q: '',
  body_part: '',
  equipment: '',
  target: '',
  page: 1,
};

async function init() {
  await loadFilters();
  setupEventListeners();
  loadExerciseOfDay();

  // Initialise the muscle group SVG body map
  initMuscleMap('muscle-map-container');

  await fetchAndRender();
}


async function loadExerciseOfDay() {
  const card = $('#exercise-of-day');
  if (!card) return;

  try {
    const lang = localStorage.getItem('fitdata_lang') || 'en';
    const ex = await api.get('/exercises/daily', { lang });
    if (!ex || !ex.id) return;

    const img = $('#eod-image');
    if (img) {
      img.src = `/${ex.gif_url || ex.image}`;
      img.alt = `${ex.name} demonstration`;
    }

    const nameEl = $('#eod-name');
    if (nameEl) {
      nameEl.textContent = ex.name;
    }

    const dateEl = $('#eod-date');
    if (dateEl) {
      const now = new Date();
      dateEl.dateTime = now.toISOString().split('T')[0];
      dateEl.textContent = now.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }

    const tagsContainer = $('#eod-tags');
    if (tagsContainer) {
      tagsContainer.innerHTML = '';
      if (ex.target) {
        tagsContainer.appendChild(el('span', { class: 'tag tag-accent', text: `${ex.target} (Target)` }));
      }
      if (ex.body_part) {
        tagsContainer.appendChild(el('span', { class: 'tag tag-warm', text: ex.body_part }));
      }
      if (ex.equipment) {
        tagsContainer.appendChild(el('span', { class: 'tag tag-neutral', text: ex.equipment }));
      }
    }

    const instrEl = $('#eod-instruction');
    if (instrEl) {
      const firstStep = ex.instructions?.steps?.[0] || ex.instructions?.full_text || '';
      if (firstStep) {
        instrEl.textContent = `“${firstStep}”`;
        instrEl.style.display = '-webkit-box';
      } else {
        instrEl.style.display = 'none';
      }
    }

    const linkEl = $('#eod-link');
    if (linkEl) {
      linkEl.href = `/exercise.html?id=${ex.id}`;
    }

    const compareLink = $('#eod-compare-link');
    if (compareLink) {
      compareLink.href = `/compare.html?a=${ex.id}`;
    }

    card.style.display = 'grid';
  } catch (err) {
    console.error('Failed to load Exercise of the Day:', err);
    card.style.display = 'none';
  }
}

async function loadFilters() {
  try {
    const filters = await api.get('/exercises/filters');
    
    const buildRadios = (containerId, name, values) => {
      const container = $(containerId);
      values.forEach(val => {
        const wrap = el('label', { class: 'filter-option' });
        const input = el('input', { type: 'radio', name, value: val });
        wrap.appendChild(input);
        wrap.appendChild(document.createTextNode(val));
        container.appendChild(wrap);
      });
    };

    buildRadios('#filter-body-part-list', 'body_part', filters.body_parts);
    buildRadios('#filter-equipment-list', 'equipment', filters.equipment_types);
    buildRadios('#filter-muscle-list', 'target', filters.target_muscles);

  } catch (err) {
    console.error('Failed to load filters:', err);
  }
}

function setupEventListeners() {
  const searchInput = $('#search-input');
  const autocompleteList = $('#search-autocomplete-list');

  // Search input with Autocomplete Suggestions
  const fetchSuggestions = debounce(async (query) => {
    if (!autocompleteList) return;
    if (!query || query.length < 2) {
      autocompleteList.innerHTML = '';
      autocompleteList.classList.remove('is-open');
      return;
    }

    try {
      const res = await api.get('/exercises/search', { q: query, page: 1, page_size: 5 });
      if (!res.items || res.items.length === 0) {
        autocompleteList.innerHTML = '<li class="autocomplete-no-match">No matching exercises found</li>';
        autocompleteList.classList.add('is-open');
        return;
      }

      autocompleteList.innerHTML = '';
      res.items.forEach(ex => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');

        const a = document.createElement('a');
        a.href = `/exercise.html?id=${ex.id}`;
        a.className = 'autocomplete-btn';
        a.innerHTML = `
          <img src="/${ex.image || ex.gif_url}" alt="" class="autocomplete-thumb" loading="lazy">
          <div class="autocomplete-info">
            <span class="autocomplete-name">${ex.name}</span>
            <span class="autocomplete-meta">${ex.target_muscle_name || ex.muscle_group || ''} • ${ex.equipment_name || ''}</span>
          </div>
        `;
        li.appendChild(a);
        autocompleteList.appendChild(li);
      });
      autocompleteList.classList.add('is-open');
    } catch (err) {
      console.warn('Autocomplete fetch failed:', err);
    }
  }, 250);

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    currentState.q = val;
    currentState.page = 1;

    fetchSuggestions(val);
    debounce(() => fetchAndRender(), 400)();
  });

  // Close autocomplete on outside click
  document.addEventListener('click', (e) => {
    if (autocompleteList && !autocompleteList.contains(e.target) && e.target !== searchInput) {
      autocompleteList.classList.remove('is-open');
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && autocompleteList) {
      autocompleteList.classList.remove('is-open');
    }
  });

  $('#search-form').addEventListener('submit', e => e.preventDefault());

  // Quick Filter Pills
  $$('.quick-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      $$('.quick-pill').forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');

      const qType = pill.dataset.quickType;
      const qVal = pill.dataset.quickVal;

      // Reset specific filter fields
      currentState.page = 1;
      if (qType === 'all') {
        currentState.equipment = '';
        currentState.body_part = '';
        $$('.filter-sidebar input[type="radio"]').forEach(r => r.checked = false);
      } else if (qType === 'equipment') {
        currentState.equipment = qVal;
        // Sync radio
        const radio = $(`input[name="equipment"][value="${qVal}"]`);
        if (radio) radio.checked = true;
      } else if (qType === 'body_part') {
        currentState.body_part = qVal;
        const radio = $(`input[name="body_part"][value="${qVal}"]`);
        if (radio) radio.checked = true;
      }

      fetchAndRender();
    });
  });

  // Sidebar Filters
  $$('.filter-sidebar input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentState[e.target.name] = e.target.value;
      currentState.page = 1;
      // Reset active quick pills to avoid conflicting visual states
      $$('.quick-pill').forEach(p => p.classList.remove('is-active'));
      fetchAndRender();
    });
  });

  // Clear filters
  $('#clear-filters-btn').addEventListener('click', () => {
    currentState = { q: '', body_part: '', equipment: '', target: '', page: 1 };
    $('#search-input').value = '';
    if (autocompleteList) autocompleteList.classList.remove('is-open');
    $$('.filter-sidebar input[type="radio"]').forEach(r => r.checked = false);
    $$('.quick-pill').forEach(p => p.classList.remove('is-active'));
    $('.quick-pill[data-quick-type="all"]')?.classList.add('is-active');
    // Also reset muscle map selection
    resetMuscleMap();
    const mmSection = $('#mm-section');
    if (mmSection) mmSection.classList.remove('map-active');
    const mmClearBtn = $('#mm-clear-btn');
    if (mmClearBtn) mmClearBtn.style.display = 'none';
    fetchAndRender();
  });

  // Muscle map selection → update filters
  window.addEventListener('muscle-selected', (e) => {
    const { filterType, filterValue } = e.detail;
    // Reset both filter dimensions first
    currentState.body_part = '';
    currentState.target    = '';
    currentState.page      = 1;
    // Deselect all radio buttons (muscle map now drives)
    $$('.filter-sidebar input[type="radio"]').forEach(r => r.checked = false);

    const mmSection  = $('#mm-section');
    const mmClearBtn = $('#mm-clear-btn');

    if (filterValue) {
      // Apply the muscle map selection
      currentState[filterType] = filterValue;
      if (mmSection)  mmSection.classList.add('map-active');
      if (mmClearBtn) mmClearBtn.style.display = '';
    } else {
      // Cleared
      if (mmSection)  mmSection.classList.remove('map-active');
      if (mmClearBtn) mmClearBtn.style.display = 'none';
    }

    fetchAndRender();
  });

  // "✕ Clear" button inside the map section
  const mmClearBtn = $('#mm-clear-btn');
  if (mmClearBtn) {
    mmClearBtn.addEventListener('click', () => {
      resetMuscleMap();
      currentState.body_part = '';
      currentState.target    = '';
      currentState.page      = 1;
      const mmSection = $('#mm-section');
      if (mmSection) mmSection.classList.remove('map-active');
      mmClearBtn.style.display = 'none';
      fetchAndRender();
    });
  }
}

async function fetchAndRender() {
  const grid = $('#exercise-grid');
  
  try {
    let data;
    if (currentState.q) {
      data = await api.get('/exercises/search', { q: currentState.q, page: currentState.page });
    } else {
      data = await api.get('/exercises', { 
        body_part: currentState.body_part,
        equipment: currentState.equipment,
        target: currentState.target,
        page: currentState.page 
      });
    }

    $('#total-count').textContent = data.total;

    grid.innerHTML = '';
    if (data.items.length === 0) {
      grid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 3rem 0;">No exercises found matching your criteria.</p>';
    } else {
      data.items.forEach(ex => {
        grid.appendChild(buildExerciseCard(ex));
      });
    }

    buildPagination($('#pagination'), {
      page: data.page,
      totalPages: data.total_pages,
      onPageChange: (newPage) => {
        currentState.page = newPage;
        fetchAndRender();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

  } catch (err) {
    console.error('Fetch error:', err);
    grid.innerHTML = '<p class="text-danger">Failed to load exercises. Is the API running?</p>';
  }
}

window.addEventListener('lang-changed', () => {
  loadExerciseOfDay();
});

document.addEventListener('DOMContentLoaded', init);
