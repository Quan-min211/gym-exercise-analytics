import { $, api, el } from './app.js';

// Chart.js global defaults — Iron Plate palette
Chart.defaults.color = '#707888';
Chart.defaults.font.family = "'Barlow', system-ui, sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = '#0b0d11';
Chart.defaults.plugins.tooltip.titleColor = '#F5F5F5';
Chart.defaults.plugins.tooltip.bodyColor = '#B0B8C8';
Chart.defaults.plugins.tooltip.borderColor = '#2e3240';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleFont = { family: "'Barlow Condensed', sans-serif", weight: '700', size: 14 };

// Iron Plate brand colors
const colorRed    = '#D32F2F';
const colorRedLight = '#EF5350';
const colorGold   = '#FFC107';
const colorIron   = '#3a3f50';

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
        backgroundColor: colorRed,
        hoverBackgroundColor: colorRedLight,
        borderRadius: 3,
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
        backgroundColor: colorGold,
        hoverBackgroundColor: '#FFD54F',
        borderRadius: 3,
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
  
  // Iron plate: shades from red to iron-gray
  const colors = data.map((_, i) => {
    const hues = [0, 20, 200, 220, 240, 260, 280, 300, 340];
    const h = hues[i % hues.length];
    return `hsl(${h}, 55%, 42%)`;
  });

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#111318'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 12, padding: 14, font: { family: "'Barlow Condensed', sans-serif", weight: '700', size: 12 } }
        }
      }
    }
  });
}

function renderCooccurrenceTable(data) {
  const tbody = $('#cooccurrence-table-body');
  tbody.innerHTML = '';

  data.forEach((row, i) => {
    const tr = el('tr', {});

    const td1 = el('td', { text: row.muscle_a });
    const td2 = el('td', { text: row.muscle_b });
    const td3 = el('td', { class: 'count-cell', text: String(row.co_occurrence_count) });

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', init);
