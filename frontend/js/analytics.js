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
const colorRed      = '#D32F2F';
const colorRedLight = '#EF5350';
const colorGold     = '#FFC107';

let cachedOverview = null;
let cachedCooccurrence = [];
let equipmentChartInstance = null;
let targetMuscleChartInstance = null;
let bodyPartChartInstance = null;

async function init() {
  try {
    const [overview, cooccurrence] = await Promise.all([
      api.get('/analytics/overview'),
      api.get('/analytics/muscle-cooccurrence?limit=50')
    ]);

    cachedOverview = overview;
    cachedCooccurrence = cooccurrence;

    renderStats(overview);
    renderEquipmentChart(overview.by_equipment.slice(0, 15));
    renderTargetMuscleChart(overview.by_target_muscle.slice(0, 15));
    renderBodyPartChart(overview.by_body_part);
    renderCooccurrenceTable(cooccurrence);

    setupChartPills();
    setupCooccurrenceSearch();
    setupExportButtons();

  } catch (err) {
    console.error('Failed to load analytics:', err);
    $('#overview-stats').innerHTML = '<p class="text-danger" style="grid-column: 1/-1;">Failed to load data. Is the backend running?</p>';
  }

  // ETL history (non-blocking)
  fetchETLHistory();
}

function renderStats(data) {
  const container = $('#overview-stats');
  container.innerHTML = '';

  const addStat = (val, label, subtitle) => {
    const card = el('div', { class: 'stat-card text-center' });
    card.appendChild(el('div', { class: 'stat-value stat-accent', text: String(val) }));
    card.appendChild(el('div', { class: 'stat-label', text: label }));
    if (subtitle) {
      card.appendChild(el('small', { class: 'text-muted mt-1', style: 'font-size: 11px; display: block;', text: subtitle }));
    }
    container.appendChild(card);
  };

  addStat(data.total_exercises, 'Total Exercises', '100% Validated');
  addStat(data.total_equipment_types, 'Equipment Types', 'Across Gym & Home');
  addStat(data.total_target_muscles, 'Target Muscles', 'Primary Muscle Groups');
  addStat(data.total_body_parts, 'Body Regions', 'Full-body Coverage');
}

function renderEquipmentChart(data) {
  const ctx = $('#equipmentChart').getContext('2d');
  if (equipmentChartInstance) equipmentChartInstance.destroy();

  equipmentChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Exercises',
        data: data.map(d => d.count),
        backgroundColor: colorRed,
        hoverBackgroundColor: colorRedLight,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          const label = data[idx].label;
          window.location.href = `/?equipment=${encodeURIComponent(label)}`;
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            footer: () => '👉 Click to view exercises'
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'hsl(222, 14%, 22%)' }
        },
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            font: { size: 11 }
          }
        }
      }
    }
  });
}

function renderTargetMuscleChart(data) {
  const ctx = $('#targetMuscleChart').getContext('2d');
  if (targetMuscleChartInstance) targetMuscleChartInstance.destroy();

  targetMuscleChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Exercises',
        data: data.map(d => d.count),
        backgroundColor: colorGold,
        hoverBackgroundColor: '#FFD54F',
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          const label = data[idx].label;
          window.location.href = `/?target=${encodeURIComponent(label)}`;
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            footer: () => '👉 Click to view exercises'
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'hsl(222, 14%, 22%)' }
        },
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            font: { size: 11 }
          }
        }
      }
    }
  });
}

function renderBodyPartChart(data) {
  const ctx = $('#bodyPartChart').getContext('2d');
  if (bodyPartChartInstance) bodyPartChartInstance.destroy();

  const colors = data.map((_, i) => {
    const hues = [0, 20, 45, 140, 200, 220, 260, 290, 330];
    const h = hues[i % hues.length];
    return `hsl(${h}, 60%, 45%)`;
  });

  bodyPartChartInstance = new Chart(ctx, {
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
      cutout: '70%',
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          const label = data[idx].label;
          window.location.href = `/?body_part=${encodeURIComponent(label)}`;
        }
      },
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 12, padding: 12, font: { family: "'Barlow Condensed', sans-serif", weight: '700', size: 12 } }
        },
        tooltip: {
          callbacks: {
            footer: () => '👉 Click to view exercises'
          }
        }
      }
    }
  });
}

function renderCooccurrenceTable(data) {
  const tbody = $('#cooccurrence-table-body');
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted);padding:var(--space-4);">No muscle pairs found.</td></tr>';
    return;
  }

  data.forEach(row => {
    const tr = el('tr', {});

    const td1 = el('td');
    const linkA = el('a', { class: 'table-link', href: `/?target=${encodeURIComponent(row.muscle_a)}`, text: row.muscle_a });
    td1.appendChild(linkA);

    const td2 = el('td');
    const linkB = el('a', { class: 'table-link', href: `/?target=${encodeURIComponent(row.muscle_b)}`, text: row.muscle_b });
    td2.appendChild(linkB);

    const td3 = el('td', { class: 'count-cell', text: String(row.co_occurrence_count) });

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tbody.appendChild(tr);
  });
}

function setupChartPills() {
  document.querySelectorAll('.chart-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const chartType = btn.dataset.chart;
      const n = parseInt(btn.dataset.n, 10);

      // Toggle active class inside its parent group
      btn.parentElement.querySelectorAll('.chart-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (chartType === 'eq' && cachedOverview) {
        renderEquipmentChart(cachedOverview.by_equipment.slice(0, n));
      } else if (chartType === 'target' && cachedOverview) {
        renderTargetMuscleChart(cachedOverview.by_target_muscle.slice(0, n));
      }
    });
  });
}

function setupCooccurrenceSearch() {
  const searchInput = $('#cooccurrence-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderCooccurrenceTable(cachedCooccurrence);
      return;
    }

    const filtered = cachedCooccurrence.filter(r => 
      r.muscle_a.toLowerCase().includes(q) || r.muscle_b.toLowerCase().includes(q)
    );
    renderCooccurrenceTable(filtered);
  });
}

function setupExportButtons() {
  $('#export-csv-btn')?.addEventListener('click', () => {
    if (!cachedOverview) return;

    let csv = 'Category,Item,Count,Percentage\n';
    cachedOverview.by_body_part.forEach(d => {
      csv += `Body Part,"${d.label}",${d.count},${d.percentage}%\n`;
    });
    cachedOverview.by_equipment.forEach(d => {
      csv += `Equipment,"${d.label}",${d.count},${d.percentage}%\n`;
    });
    cachedOverview.by_target_muscle.forEach(d => {
      csv += `Target Muscle,"${d.label}",${d.count},${d.percentage}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fitdata_analytics_summary.csv';
    link.click();
    URL.revokeObjectURL(url);
  });

  $('#export-json-btn')?.addEventListener('click', () => {
    if (!cachedOverview) return;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
      overview: cachedOverview,
      muscle_cooccurrences: cachedCooccurrence
    }, null, 2));

    const link = document.createElement('a');
    link.href = dataStr;
    link.download = 'fitdata_analytics_summary.json';
    link.click();
  });
}

// ---------------------------------------------------------------------------
// ETL Pipeline History
// ---------------------------------------------------------------------------

async function fetchETLHistory() {
  const tbody = document.getElementById('etl-history-body');
  if (!tbody) return;

  try {
    const runs = await api.get('/analytics/etl-history?limit=10');

    if (!runs || runs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">No ETL runs recorded yet. Run the pipeline to generate history.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    runs.forEach(run => {
      const tr = document.createElement('tr');

      const statusColor = run.status === 'SUCCESS' ? '#66BB6A'
        : run.status === 'FAILED' ? '#EF5350'
        : '#FFC107';

      const statusBadge = `<mark style="
        display:inline-block; padding:2px 8px; border-radius:99px;
        background:${statusColor}22; color:${statusColor};
        font-size:11px; font-weight:700; text-transform:uppercase;
      ">${run.status || '—'}</mark>`;

      const started = run.started_at
        ? new Date(run.started_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'medium' })
        : '—';

      const dur = run.duration_seconds != null
        ? `${run.duration_seconds.toFixed(1)}s`
        : '—';

      tr.innerHTML = `
        <td><code style="font-size:var(--text-xs)">${run.run_id || '—'}</code></td>
        <td>${statusBadge}</td>
        <td class="count-cell">${run.records_extracted ?? '—'}</td>
        <td class="count-cell">${run.records_valid ?? '—'}</td>
        <td class="count-cell">${run.records_invalid ?? '—'}</td>
        <td class="count-cell">${run.records_loaded ?? '—'}</td>
        <td class="count-cell">${dur}</td>
        <td style="font-size:var(--text-xs)">${started}</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.warn('ETL history unavailable:', err.message);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:var(--space-8)">ETL history endpoint not available.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', init);


