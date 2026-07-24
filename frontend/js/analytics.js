import { $, api, el } from './app.js';

// Chart.js global defaults
Chart.defaults.color = 'hsl(210, 12%, 72%)';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'hsl(222, 22%, 5%)';
Chart.defaults.plugins.tooltip.titleColor = 'hsl(210, 20%, 94%)';
Chart.defaults.plugins.tooltip.bodyColor = 'hsl(210, 12%, 72%)';
Chart.defaults.plugins.tooltip.borderColor = 'hsl(222, 14%, 22%)';
Chart.defaults.plugins.tooltip.borderWidth = 1;

// Brand colors
const colorAccent = 'hsl(162, 72%, 40%)';
const colorWarm = 'hsl(38, 90%, 56%)';
const colorSurface = 'hsl(222, 16%, 16%)';

async function init() {
  try {
    const [overview, cooccurrence] = await Promise.all([
      api.get('/analytics/overview'),
      api.get('/analytics/muscle-cooccurrence?limit=15')
    ]);

    renderStats(overview);
    renderEquipmentChart(overview.by_equipment.slice(0, 15));
    renderTargetMuscleChart(overview.by_target_muscle.slice(0, 15));
    renderBodyPartChart(overview.by_body_part);
    renderCooccurrenceTable(cooccurrence);

  } catch (err) {
    console.error('Failed to load analytics:', err);
    $('#overview-stats').innerHTML = '<p class="text-danger" style="grid-column: 1/-1;">Failed to load data. Is the backend running?</p>';
  }
}

function renderStats(data) {
  const container = $('#overview-stats');
  container.innerHTML = ''; // clear skeletons

  const addStat = (val, label) => {
    const card = el('div', { class: 'stat-card text-center' });
    card.appendChild(el('div', { class: 'stat-value stat-accent', text: val }));
    card.appendChild(el('div', { class: 'stat-label', text: label }));
    container.appendChild(card);
  };

  addStat(data.total_exercises, 'Total Exercises');
  addStat(data.total_equipment_types, 'Equipment Types');
  addStat(data.total_target_muscles, 'Target Muscles');
  addStat(data.total_body_parts, 'Body Regions');
}

function renderEquipmentChart(data) {
  const ctx = $('#equipmentChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Exercises',
        data: data.map(d => d.count),
        backgroundColor: colorAccent,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'hsl(222, 14%, 22%)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderTargetMuscleChart(data) {
  const ctx = $('#targetMuscleChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Exercises',
        data: data.map(d => d.count),
        backgroundColor: colorWarm,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'hsl(222, 14%, 22%)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderBodyPartChart(data) {
  const ctx = $('#bodyPartChart').getContext('2d');
  
  // Generate a distinct color palette
  const colors = data.map((_, i) => `hsl(${160 + (i * 20)}, 60%, 45%)`);

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: 'hsl(222, 20%, 8%)' // match page background
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 12 }
        }
      }
    }
  });
}

function renderCooccurrenceTable(data) {
  const tbody = $('#cooccurrence-table-body');
  tbody.innerHTML = '';

  data.forEach((row, i) => {
    const tr = el('tr', { style: 'border-bottom: 1px solid var(--color-border);' });
    if (i % 2 !== 0) tr.style.backgroundColor = 'hsl(222, 16%, 12%)';

    const td1 = el('td', { style: 'padding: var(--space-2) 0; text-transform: capitalize;', text: row.muscle_a });
    const td2 = el('td', { style: 'padding: var(--space-2) 0; text-transform: capitalize;', text: row.muscle_b });
    const td3 = el('td', { style: 'padding: var(--space-2) 0; text-align: right; color: var(--color-accent); font-weight: var(--weight-medium);', text: row.co_occurrence_count });

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', init);
