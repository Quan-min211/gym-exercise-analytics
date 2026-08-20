import { $, $$, api, buildExerciseCard, buildPagination, debounce, el } from './app.js';

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
  // Search
  $('#search-input').addEventListener('input', debounce((e) => {
    currentState.q = e.target.value.trim();
    currentState.page = 1;
    fetchAndRender();
  }, 400));

  $('#search-form').addEventListener('submit', e => e.preventDefault());

  // Filters
  $$('.filter-sidebar input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentState[e.target.name] = e.target.value;
      currentState.page = 1;
      fetchAndRender();
    });
  });

  // Clear filters
  $('#clear-filters-btn').addEventListener('click', () => {
    currentState = { q: '', body_part: '', equipment: '', target: '', page: 1 };
    $('#search-input').value = '';
    $$('.filter-sidebar input[type="radio"]').forEach(r => r.checked = false);
    fetchAndRender();
  });
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
