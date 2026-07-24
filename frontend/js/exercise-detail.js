import { $, el, api } from './app.js';

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  if (!id) {
    window.location.href = '/';
    return;
  }

  try {
    const data = await api.get(`/exercises/${id}`);
    renderDetail(data);
    fetchRelated(data);
  } catch (err) {
    console.error(err);
    $('#exercise-heading').textContent = 'Exercise not found';
  }
}

function renderDetail(ex) {
  document.title = `${ex.name} — FitData Hub`;
  $('#breadcrumb-name').textContent = ex.name;
  $('#exercise-heading').textContent = ex.name;
  
  const gif = $('#exercise-gif');
  gif.src = `/${ex.gif_url}`;
  gif.alt = `${ex.name} demonstration`;
  $('#exercise-name-caption').textContent = ex.name;

  $('#meta-body-part').textContent = ex.body_part;
  $('#meta-equipment').textContent = ex.equipment;
  $('#meta-target').textContent = ex.target;

  // Tags
  const categoryContainer = $('#exercise-category');
  categoryContainer.appendChild(el('span', { class: 'tag tag-accent', text: ex.category }));
  categoryContainer.appendChild(el('span', { class: 'tag tag-warm', text: ex.muscle_group }));

  // Muscle tags
  const musclesTags = $('#muscles-tags');
  musclesTags.appendChild(el('span', { class: 'tag tag-accent', text: ex.target + ' (Target)' }));
  ex.secondary_muscles.forEach(m => {
    musclesTags.appendChild(el('span', { class: 'tag tag-neutral', text: m }));
  });

  // Instructions
  const stepsList = $('#instruction-steps');
  if (ex.instructions && ex.instructions.steps) {
    ex.instructions.steps.forEach(step => {
      stepsList.appendChild(el('li', { text: step }));
    });
  } else {
    stepsList.innerHTML = '<li>Instructions not available.</li>';
  }

  // Generate generic benefits based on body part (since we don't have this in JSON)
  const benefits = $('#benefits-list');
  benefits.appendChild(createBenefitItem('Focus', `Strengthens the ${ex.target}.`));
  if (ex.equipment !== 'body weight') {
    benefits.appendChild(createBenefitItem('Equipment', `Requires ${ex.equipment}. Ensure proper form.`));
  }
  benefits.appendChild(createBenefitItem('Synergy', `Also engages ${ex.secondary_muscles.length > 0 ? ex.secondary_muscles.join(', ') : 'stabilizer muscles'}.`));

  $('#attribution-text').textContent = ex.attribution;

  $('#add-to-schedule-btn').addEventListener('click', () => {
    alert('Schedule builder coming soon!');
  });
}

function createBenefitItem(title, text) {
  const item = el('li', { class: 'benefit-item' });
  item.appendChild(el('strong', { text: title }));
  item.appendChild(document.createTextNode(text));
  return item;
}

async function fetchRelated(ex) {
  try {
    const data = await api.get('/exercises', { target: ex.target, page_size: 4 });
    const grid = $('#related-grid');
    grid.innerHTML = '';
    
    // Filter out the current exercise
    const related = data.items.filter(item => item.id !== ex.id).slice(0, 3);
    
    if (related.length === 0) {
      grid.innerHTML = '<p class="text-muted">No related exercises found.</p>';
      return;
    }

    related.forEach(item => {
      const card = el('a', { class: 'card exercise-card', href: `/exercise.html?id=${item.id}` });
      const img = el('img', { src: `/${item.image}`, loading: 'lazy' });
      const body = el('div', { class: 'card-body', style: 'padding: 1rem;' });
      body.appendChild(el('h3', { text: item.name, style: 'font-size: var(--text-sm)' }));
      
      card.appendChild(img);
      card.appendChild(body);
      grid.appendChild(card);
    });

  } catch (err) {
    console.error('Failed to load related:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
