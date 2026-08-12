async function init() {
  await loadEquipment();
  setupWizard();
  setupTemplates();
  setupForm();
}

function setupTemplates() {
  $$('.template-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const goal = btn.dataset.goal;
      const days = btn.dataset.days;
      const duration = btn.dataset.duration;

      // Select goal radio
      const radio = $(`#goal-${goal === 'build_muscle' ? 'muscle' : goal === 'lose_weight' ? 'weight' : goal === 'general_fitness' ? 'general' : goal}`);
      if (radio) radio.checked = true;

      // Select days and duration
      const daysSelect = $('#days_per_week');
      if (daysSelect) daysSelect.value = days;

      const durSelect = $('#session_duration');
      if (durSelect) durSelect.value = duration;

      // Move to Step 2: Equipment
      nextStep(2);
    });
  });
}

async function loadEquipment() {
  try {
    const filters = await api.get('/exercises/filters');
    const container = $('#equipment-checkboxes');
    
    filters.equipment_types.forEach((eq, i) => {
      const optionDiv = el('div', { class: 'equipment-option' });
      const id = `eq-${i}`;
      const input = el('input', {
        type: 'checkbox',
        name: 'equipment',
        id,
        value: eq,
      });
      if (eq === 'body weight') input.setAttribute('checked', '');
      const label = el('label', { for: id });
      label.appendChild(document.createTextNode(eq));
      optionDiv.appendChild(input);
      optionDiv.appendChild(label);
      container.appendChild(optionDiv);
    });
  } catch (err) {
    console.error('Failed to load equipment:', err);
  }
}

// Attach to window so onclick="nextStep(x)" works from HTML
window.nextStep = function(stepNum) {
  $$('.wizard-step').forEach(s => s.classList.remove('active'));
  $(`#step-${stepNum}`).classList.add('active');
  
  $$('.step-item').forEach((item, idx) => {
    const step = idx + 1;
    item.classList.remove('active', 'done');
    if (step < stepNum) item.classList.add('done');
    if (step === stepNum) item.classList.add('active');
  });
};

function setupWizard() {
  // Show step 1 on load
  nextStep(1);
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
      // Scroll to results
      $('#results-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error(err);
      alert('Failed to generate plan. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Plan';
    }
  });

  $('#restart-btn').addEventListener('click', () => {
    $('#wizard-container').style.display = '';
    $('.template-bar').style.display = '';
    $('#results-container').style.display = 'none';
    nextStep(1);
  });

  const copyBtn = $('#copy-plan-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!generatedPlan) return;
      let text = `🏋️ FitData Hub — Weekly Plan (${generatedPlan.goal.replace('_', ' ').toUpperCase()})\n`;
      text += `Level: ${generatedPlan.fitness_level} | Duration: ${generatedPlan.session_duration}m | Days: ${generatedPlan.days_per_week}/week\n\n`;

      generatedPlan.days.forEach(d => {
        text += `📅 ${d.day_label}: ${d.is_rest_day ? 'Rest Day 😴' : d.focus}\n`;
        if (!d.is_rest_day && d.exercises) {
          d.exercises.forEach(ex => {
            text += `  • ${ex.name} (${ex.target} | ${ex.equipment})\n`;
          });
        }
        text += '\n';
      });

      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => { copyBtn.textContent = '📋 Copy Summary'; }, 2000);
      }).catch(() => {
        alert('Could not copy to clipboard.');
      });
    });
  }

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

function getGoalGuidance(goal) {
  const map = {
    build_muscle: { sets: '3–4 sets', reps: '8–12 reps', rest: '60–90s rest', note: 'Focus on progressive overload & mechanical tension.' },
    lose_weight: { sets: '3–4 sets', reps: '12–15 reps', rest: '30–45s rest', note: 'Keep rest intervals short to maximize calorie burn.' },
    improve_endurance: { sets: '3 sets', reps: '15–20 reps', rest: '30s rest', note: 'Emphasize high repetitions and muscular stamina.' },
    flexibility: { sets: '2–3 sets', reps: '10–12 controlled reps', rest: '45s rest', note: 'Focus on full range of motion & controlled tempo.' },
    general_fitness: { sets: '3 sets', reps: '10–12 reps', rest: '60s rest', note: 'Balanced volume for overall health & strength.' },
  };
  return map[goal] || map.general_fitness;
}

function renderResults(plan) {
  $('#wizard-container').style.display = 'none';
  const templateBar = $('.template-bar');
  if (templateBar) templateBar.style.display = 'none';

  const resultsContainer = $('#results-container');
  resultsContainer.style.display = 'block';

  // Stats
  const stats = $('#plan-stats');
  stats.innerHTML = '';
  
  const addStat = (val, label) => {
    const card = el('div', { class: 'stat-card text-center' });
    card.appendChild(el('div', { class: 'stat-value stat-accent', text: String(val) }));
    card.appendChild(el('div', { class: 'stat-label', text: label }));
    stats.appendChild(card);
  };

  addStat(plan.days.filter(d => !d.is_rest_day).length, 'Training Days');
  addStat(plan.total_exercises, 'Total Exercises');
  addStat(plan.muscles_covered.length, 'Muscles Targeted');
  addStat(plan.fitness_level, 'Level');

  // Days container
  const daysContainer = $('#plan-days');
  daysContainer.innerHTML = '';

  // Goal guidance banner
  const g = getGoalGuidance(plan.goal);
  const guidance = el('div', { class: 'guidance-banner' });
  guidance.innerHTML = `
    <span style="font-size: 1.25rem;">💡</span>
    <div>
      <strong>Target Guidance:</strong> ${g.sets} × ${g.reps} • ${g.rest}. <em>${g.note}</em>
    </div>`;
  daysContainer.appendChild(guidance);

  plan.days.forEach(day => {
    const dayCard = el('article', { class: `plan-day-card${day.is_rest_day ? ' rest-day' : ''}` });
    
    const header = el('div', { class: 'plan-day-header' });
    header.appendChild(el('h3', { text: day.day_label, style: 'font-size: var(--text-xl)' }));
    
    if (day.is_rest_day) {
      header.appendChild(el('span', { class: 'tag tag-neutral', text: 'Rest Day' }));
    } else {
      header.appendChild(el('span', { class: 'tag tag-red', text: day.focus || 'Training' }));
    }
    dayCard.appendChild(header);

    if (!day.is_rest_day && day.exercises && day.exercises.length > 0) {
      const body = el('div', { class: 'plan-day-body exercise-grid' });
      day.exercises.forEach(ex => {
        body.appendChild(buildExerciseCard(ex));
      });
      dayCard.appendChild(body);

      // Warm-up box
      const warmup = el('div', { class: 'warmup-box' });
      warmup.innerHTML = `
        <span aria-hidden="true">🔥</span>
        <span><strong>Warm-up:</strong> 5–8 min dynamic mobility (arm circles, leg swings, light cardio) before starting.</span>`;
      dayCard.appendChild(warmup);
    }

    daysContainer.appendChild(dayCard);
  });
}

document.addEventListener('DOMContentLoaded', init);
