import { $, api, el } from './app.js';

let currentScheduleId = null;

async function init() {
  // Check URL for ID first, otherwise fallback to localStorage
  const urlParams = new URLSearchParams(window.location.search);
  let id = urlParams.get('id');

  if (id) {
    // Save to localStorage so they can find it later without the URL
    localStorage.setItem('fitdata_schedule_id', id);
  } else {
    id = localStorage.getItem('fitdata_schedule_id');
  }

  if (!id) {
    showEmptyState();
    return;
  }

  try {
    const schedule = await api.get(`/schedules/${id}`);
    currentScheduleId = id;
    renderSchedule(schedule);
  } catch (err) {
    console.error('Failed to load schedule:', err);
    if (err.message.includes('404')) {
      localStorage.removeItem('fitdata_schedule_id');
      showEmptyState();
    } else {
      $('#schedule-subtitle').textContent = 'Error loading schedule. Please try again.';
      $('#schedule-subtitle').classList.add('text-danger');
    }
  }

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
}

function showEmptyState() {
  $('#schedule-subtitle').textContent = '';
  $('#no-schedule-msg').classList.remove('visually-hidden');
  $('#schedule-container').classList.add('visually-hidden');
  $('#delete-schedule-btn').classList.add('visually-hidden');
}

async function renderSchedule(schedule) {
  $('#page-title').textContent = schedule.name;
  $('#schedule-subtitle').textContent = `Created on ${new Date(schedule.created_at).toLocaleDateString()}`;
  
  $('#no-schedule-msg').classList.add('visually-hidden');
  $('#schedule-container').classList.remove('visually-hidden');
  $('#delete-schedule-btn').classList.remove('visually-hidden');

  const grid = $('#calendar-grid');
  grid.innerHTML = '';

  // We need to fetch exercise details for the items because the schedule only stores IDs
  // To avoid N+1, we'll collect all unique IDs and fetch them in parallel or use the search API.
  // For simplicity here, we'll fetch them individually but in parallel.
  const exerciseCache = {};
  const fetchPromises = [];

  schedule.days.forEach(day => {
    day.exercises.forEach(ex => {
      if (!exerciseCache[ex.exercise_id]) {
        exerciseCache[ex.exercise_id] = null; // placeholder
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
  schedule.days.forEach(day => {
    const dayCard = el('div', { class: 'schedule-day' });
    if (day.is_rest_day) dayCard.classList.add('rest-day');

    const header = el('div', { class: 'schedule-day-header' });
    header.appendChild(el('h4', { text: day.label }));
    if (day.is_rest_day) {
      header.appendChild(el('span', { class: 'tag tag-neutral', text: 'Rest' }));
    }
    dayCard.appendChild(header);

    if (!day.is_rest_day && day.exercises.length > 0) {
      const exList = el('div', { class: 'flex-col gap-2 mt-4' });
      day.exercises.forEach(scheduledEx => {
        const exData = exerciseCache[scheduledEx.exercise_id];
        if (!exData) return;

        const item = el('a', { 
          class: 'schedule-exercise-item', 
          href: `/exercise.html?id=${scheduledEx.exercise_id}`,
          style: 'color: inherit;' 
        });
        
        const img = el('img', { src: `/${exData.image}`, loading: 'lazy' });
        
        const info = el('div', { class: 'flex-col', style: 'flex: 1' });
        info.appendChild(el('strong', { text: exData.name, style: 'font-size: 13px; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;' }));
        info.appendChild(el('span', { class: 'text-muted mt-1', text: `${scheduledEx.sets} sets × ${scheduledEx.reps}` }));

        item.appendChild(img);
        item.appendChild(info);
        exList.appendChild(item);
      });
      dayCard.appendChild(exList);
    } else if (!day.is_rest_day) {
      dayCard.appendChild(el('p', { class: 'text-muted mt-4', style: 'font-size: var(--text-sm)', text: 'No exercises planned.' }));
    }

    grid.appendChild(dayCard);
  });
}

document.addEventListener('DOMContentLoaded', init);
