import { $, api, el } from './app.js';

let currentScheduleId = null;
let currentSchedule = null;

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  let id = urlParams.get('id');

  if (id) {
    localStorage.setItem('fitdata_schedule_id', id);
  } else {
    id = localStorage.getItem('fitdata_schedule_id');
  }

  // Load schedule list to populate dropdown selector
  await loadScheduleList(id);

  if (!id) {
    showEmptyState();
    return;
  }

  await loadSchedule(id);
  setupEventHandlers();
}

async function loadScheduleList(activeId) {
  const select = $('#schedule-select');
  if (!select) return;

  try {
    const list = await api.get('/schedules');
    select.innerHTML = '';

    if (!list || list.length === 0) {
      select.innerHTML = '<option value="">No saved schedules</option>';
      return;
    }

    list.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${new Date(s.created_at).toLocaleDateString()})`;
      if (s.id === activeId) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', async (e) => {
      const selectedId = e.target.value;
      if (selectedId && selectedId !== currentScheduleId) {
        localStorage.setItem('fitdata_schedule_id', selectedId);
        await loadSchedule(selectedId);
      }
    });
  } catch (err) {
    console.warn('Could not list schedules:', err);
  }
}

async function loadSchedule(id) {
  try {
    const schedule = await api.get(`/schedules/${id}`);
    currentScheduleId = id;
    currentSchedule = schedule;
    renderSchedule(schedule);
  } catch (err) {
    console.error('Failed to load schedule:', err);
    if (err.message && err.message.includes('404')) {
      localStorage.removeItem('fitdata_schedule_id');
      showEmptyState();
    } else {
      $('#schedule-subtitle').textContent = 'Error loading schedule. Please try again.';
    }
  }
}

function setupEventHandlers() {
  $('#delete-schedule-btn').addEventListener('click', async () => {
    if (!currentScheduleId) return;
    if (confirm('Are you sure you want to delete this schedule?')) {
      try {
        await api.delete(`/schedules/${currentScheduleId}`);
        localStorage.removeItem('fitdata_schedule_id');
        window.location.href = '/schedule.html';
      } catch (err) {
        alert('Failed to delete schedule.');
      }
    }
  });

  const renameBtn = $('#rename-schedule-btn');
  if (renameBtn) {
    renameBtn.addEventListener('click', async () => {
      if (!currentSchedule || !currentScheduleId) return;
      const newName = prompt('Enter new schedule name:', currentSchedule.name);
      if (!newName || newName.trim() === '' || newName === currentSchedule.name) return;

      try {
        const payload = {
          name: newName.trim(),
          schedule_type: currentSchedule.schedule_type || 'weekly',
          days: currentSchedule.days,
        };
        const updated = await api.put(`/schedules/${currentScheduleId}`, payload);
        currentSchedule = updated;
        $('#page-title').textContent = updated.name;
        // Update select option text
        const select = $('#schedule-select');
        if (select && select.selectedOptions[0]) {
          select.selectedOptions[0].textContent = `${updated.name} (${new Date(updated.created_at).toLocaleDateString()})`;
        }
      } catch (err) {
        console.error('Failed to rename schedule:', err);
        alert('Failed to rename schedule.');
      }
    });
  }
}

function showEmptyState() {
  $('#schedule-subtitle').textContent = '';
  $('#no-schedule-msg').style.display = 'block';
  $('#schedule-container').style.display = 'none';
  $('#schedule-actions').style.display = 'none';
}

function getTodayDayIndex() {
  // JavaScript getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // Map to 0-based week starting Mon: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

async function renderSchedule(schedule) {
  $('#page-title').textContent = schedule.name || 'My Schedule';
  $('#schedule-subtitle').textContent = `Created on ${new Date(schedule.created_at).toLocaleDateString()}`;
  
  $('#no-schedule-msg').style.display = 'none';
  $('#schedule-container').style.display = 'block';
  $('#schedule-actions').style.display = 'flex';

  const todayIdx = getTodayDayIndex();
  const grid = $('#calendar-grid');
  grid.innerHTML = '';

  // Cache exercise details
  const exerciseCache = {};
  const fetchPromises = [];

  schedule.days.forEach(day => {
    day.exercises.forEach(ex => {
      if (!exerciseCache[ex.exercise_id]) {
        exerciseCache[ex.exercise_id] = null;
        fetchPromises.push(
          api.get(`/exercises/${ex.exercise_id}`).then(data => {
            exerciseCache[ex.exercise_id] = data;
          }).catch(() => {
            exerciseCache[ex.exercise_id] = { name: 'Unknown Exercise', image: 'placeholder.jpg' };
          })
        );
      }
    });
  });

  await Promise.all(fetchPromises);

  // Build grid
  schedule.days.forEach((day, idx) => {
    const isToday = (day.day_index !== undefined ? day.day_index : idx) === todayIdx;
    const dayCard = el('div', { class: `schedule-day${day.is_rest_day ? ' rest-day' : ''}${isToday ? ' is-today' : ''}` });

    const header = el('div', { class: 'schedule-day-header' });
    const titleBox = el('div', { class: 'flex items-center gap-2' });
    titleBox.appendChild(el('h4', { text: day.label }));
    if (isToday) {
      titleBox.appendChild(el('span', { class: 'today-badge', text: '🔥 Today' }));
    }
    header.appendChild(titleBox);

    if (day.is_rest_day) {
      header.appendChild(el('span', { class: 'tag tag-neutral', text: 'Rest' }));
    }
    dayCard.appendChild(header);

    if (!day.is_rest_day && day.exercises.length > 0) {
      const exList = el('div', { class: 'flex-col gap-2 mt-4' });
      let completedCount = 0;

      day.exercises.forEach(scheduledEx => {
        const exData = exerciseCache[scheduledEx.exercise_id];
        if (!exData) return;

        const storageKey = `fitdata_done_${schedule.id}_${day.day_index || idx}_${scheduledEx.exercise_id}`;
        const isDone = localStorage.getItem(storageKey) === 'true';
        if (isDone) completedCount++;

        const item = el('div', {
          class: `schedule-exercise-item${isDone ? ' is-completed' : ''}`,
        });

        // Checkbox for completion tracking
        const chk = el('input', {
          type: 'checkbox',
          style: 'cursor: pointer; width: 16px; height: 16px;',
          'aria-label': `Mark ${exData.name} as completed`,
        });
        if (isDone) chk.checked = true;

        chk.addEventListener('change', (e) => {
          e.stopPropagation();
          const done = e.target.checked;
          if (done) {
            localStorage.setItem(storageKey, 'true');
            item.classList.add('is-completed');
          } else {
            localStorage.removeItem(storageKey);
            item.classList.remove('is-completed');
          }
          renderScheduleProgress(dayCard, day.exercises.length);
        });

        const link = el('a', {
          href: `/exercise.html?id=${scheduledEx.exercise_id}`,
          style: 'display: flex; align-items: center; gap: var(--space-3); flex: 1; color: inherit; text-decoration: none;',
        });

        const img = el('img', { src: `/${exData.image}`, loading: 'lazy', alt: exData.name });
        const info = el('div', { class: 'flex-col', style: 'flex: 1' });
        info.appendChild(el('strong', { text: exData.name, style: 'font-size: 13px; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;' }));
        info.appendChild(el('span', { class: 'text-muted mt-1', text: `${scheduledEx.sets} sets × ${scheduledEx.reps}` }));

        link.appendChild(img);
        link.appendChild(info);

        item.appendChild(chk);
        item.appendChild(link);
        exList.appendChild(item);
      });

      dayCard.appendChild(exList);

      // Add Progress bar for training days
      const progressWrap = el('div', { class: 'schedule-progress', 'aria-label': 'Daily completion progress' });
      const pct = (completedCount / day.exercises.length) * 100;
      const bar = el('div', { class: 'schedule-progress-bar', style: `width: ${pct}%` });
      progressWrap.appendChild(bar);
      dayCard.appendChild(progressWrap);

    } else if (!day.is_rest_day) {
      dayCard.appendChild(el('p', { class: 'text-muted mt-4', style: 'font-size: var(--text-sm)', text: 'No exercises planned.' }));
    }

    grid.appendChild(dayCard);
  });
}

function renderScheduleProgress(dayCard, totalExercises) {
  const checked = dayCard.querySelectorAll('.schedule-exercise-item input[type="checkbox"]:checked').length;
  const bar = dayCard.querySelector('.schedule-progress-bar');
  if (bar) {
    const pct = (checked / totalExercises) * 100;
    bar.style.width = `${pct}%`;
  }
}

document.addEventListener('DOMContentLoaded', init);
