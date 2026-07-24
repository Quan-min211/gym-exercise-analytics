import { $, $$, api, buildExerciseCard, el } from './app.js';

let generatedPlan = null;

async function init() {
  await loadEquipment();
  setupWizard();
  setupForm();
}

async function loadEquipment() {
  try {
    const filters = await api.get('/exercises/filters');
    const container = $('#equipment-checkboxes');
    
    // Always check body weight by default
    filters.equipment_types.forEach(eq => {
      const wrap = el('label', { class: 'form-field', style: 'flex-direction: row; align-items: center;' });
      const input = el('input', { 
        type: 'checkbox', 
        name: 'equipment', 
        value: eq,
        checked: eq === 'body weight'
      });
      wrap.appendChild(input);
      wrap.appendChild(document.createTextNode(eq));
      container.appendChild(wrap);
    });
  } catch (err) {
    console.error('Failed to load equipment:', err);
  }
}

// Attach to window so onclick="nextStep(x)" works from HTML
window.nextStep = function(stepNum) {
  $$('.wizard-step').forEach(s => s.classList.add('visually-hidden'));
  $(`#step-${stepNum}`).classList.remove('visually-hidden');
  
  $$('.step-item').forEach((item, idx) => {
    const step = idx + 1;
    item.classList.remove('active', 'done');
    if (step < stepNum) item.classList.add('done');
    if (step === stepNum) item.classList.add('active');
  });
};

function setupWizard() {
  window.nextStep(1);
}

function setupForm() {
  $('#recommend-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#generate-btn');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    const formData = new FormData(e.target);
    const equipment = formData.getAll('equipment');
    
    const request = {
      goal: formData.get('goal'),
      fitness_level: formData.get('fitness_level'),
      available_equipment: equipment.length > 0 ? equipment : ['body weight'],
      session_duration: parseInt(formData.get('session_duration')),
      days_per_week: parseInt(formData.get('days_per_week')),
    };

    try {
      generatedPlan = await api.post('/recommend/weekly', request);
      renderResults(generatedPlan);
    } catch (err) {
      console.error(err);
      alert('Failed to generate plan. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Plan';
    }
  });

  $('#restart-btn').addEventListener('click', () => {
    $('#wizard-container').classList.remove('visually-hidden');
    $('#results-container').classList.add('visually-hidden');
    window.nextStep(1);
  });

  $('#save-schedule-btn').addEventListener('click', async () => {
    if (!generatedPlan) return;
    try {
      // Map WeeklyPlan to ScheduleCreate schema
      const schedulePayload = {
        name: `My ${generatedPlan.goal.replace('_', ' ')} Plan`,
        schedule_type: 'weekly',
        days: generatedPlan.days.map((day, idx) => ({
          day_index: idx,
          label: day.day_label,
          is_rest_day: day.is_rest_day,
          exercises: day.exercises.map(ex => ({
            exercise_id: ex.id,
            sets: 3,
            reps: '10-12',
            rest_seconds: 60
          }))
        }))
      };

      const res = await api.post('/schedules', schedulePayload);
      alert('Schedule saved successfully!');
      window.location.href = `/schedule.html?id=${res.id}`;
    } catch (err) {
      console.error('Failed to save schedule:', err);
      alert('Failed to save schedule.');
    }
  });
}

function renderResults(plan) {
  $('#wizard-container').classList.add('visually-hidden');
  const resultsContainer = $('#results-container');
  resultsContainer.classList.remove('visually-hidden');

  // Stats
  const stats = $('#plan-stats');
  stats.innerHTML = '';
  
  const addStat = (val, label) => {
    const card = el('div', { class: 'stat-card text-center' });
    card.appendChild(el('div', { class: 'stat-value stat-accent', text: val }));
    card.appendChild(el('div', { class: 'stat-label', text: label }));
    stats.appendChild(card);
  };

  addStat(plan.days.filter(d => !d.is_rest_day).length, 'Training Days');
  addStat(plan.total_exercises, 'Total Exercises');
  addStat(plan.muscles_covered.length, 'Muscles Targeted');
  addStat(plan.fitness_level, 'Level');

  // Days
  const daysContainer = $('#plan-days');
  daysContainer.innerHTML = '';

  plan.days.forEach(day => {
    const dayCard = el('article', { class: 'card' });
    
    const header = el('div', { class: 'card-header', style: 'padding: var(--space-4); border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;' });
    header.appendChild(el('h3', { text: day.day_label }));
    
    if (day.is_rest_day) {
      header.appendChild(el('span', { class: 'tag tag-neutral', text: 'Rest Day' }));
      dayCard.appendChild(header);
      dayCard.style.opacity = '0.6';
      dayCard.style.borderStyle = 'dashed';
    } else {
      header.appendChild(el('span', { class: 'tag tag-accent', text: day.focus }));
      dayCard.appendChild(header);

      const body = el('div', { class: 'card-body exercise-grid' });
      day.exercises.forEach(ex => {
        body.appendChild(buildExerciseCard(ex));
      });
      dayCard.appendChild(body);
    }

    daysContainer.appendChild(dayCard);
  });
}

document.addEventListener('DOMContentLoaded', init);
