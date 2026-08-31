/**
 * calculator.js — BMI / BMR / TDEE / Macro calculator
 *
 * Features:
 *   - BMI + animated gauge marker
 *   - BMR (Mifflin–St Jeor) + TDEE
 *   - Waist circumference risk (WHO thresholds)
 *   - Macro targets with SVG donut chart + animated bars
 *   - Goal-aware calorie recommendation
 *   - Calculation history (localStorage)
 *   - Imperial / Metric unit toggle
 */

'use strict';

// ---------------------------------------------------------------------------
// Unit conversion
// ---------------------------------------------------------------------------

const lbToKg  = lb  => lb  * 0.453592;
const inToCm  = ins => ins * 2.54;
const kgToLb  = kg  => kg  / 0.453592;

// ---------------------------------------------------------------------------
// Core formulas
// ---------------------------------------------------------------------------

function calcBMI(weightKg, heightCm) {
  const hm = heightCm / 100;
  return weightKg / (hm * hm);
}

function calcBMR(weightKg, heightCm, age, gender) {
  // Mifflin–St Jeor
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return { key: 'underweight', label: 'Underweight', cls: 'bmi-underweight' };
  if (bmi < 25)   return { key: 'normal',      label: 'Normal',       cls: 'bmi-normal' };
  if (bmi < 30)   return { key: 'overweight',  label: 'Overweight',   cls: 'bmi-overweight' };
  return                  { key: 'obese',       label: 'Obese',        cls: 'bmi-obese' };
}

/** Map BMI 15–40 → gauge 0–100% */
function bmiGaugePct(bmi) {
  return ((Math.max(15, Math.min(40, bmi)) - 15) / 25) * 100;
}

function healthyWeightRange(heightCm) {
  const hm = heightCm / 100;
  return {
    min: +(18.5 * hm * hm).toFixed(1),
    max: +(24.9 * hm * hm).toFixed(1),
  };
}

/**
 * Waist circumference risk (WHO 2011 thresholds)
 * Returns { level, label, cls }
 */
function waistRisk(waistCm, gender) {
  if (gender === 'male') {
    if (waistCm < 94)  return { level: 'low',       label: '✅ Low risk',       cls: 'bf-risk-low' };
    if (waistCm < 102) return { level: 'moderate',  label: '⚠️ Moderate risk',  cls: 'bf-risk-moderate' };
    return                    { level: 'high',       label: '🔴 High risk',      cls: 'bf-risk-high' };
  } else {
    if (waistCm < 80)  return { level: 'low',       label: '✅ Low risk',       cls: 'bf-risk-low' };
    if (waistCm < 88)  return { level: 'moderate',  label: '⚠️ Moderate risk',  cls: 'bf-risk-moderate' };
    return                    { level: 'high',       label: '🔴 High risk',      cls: 'bf-risk-high' };
  }
}

/**
 * Goal-adjusted target calories
 * lose: -500 kcal  |  maintain: TDEE  |  gain: +300 kcal
 */
function targetCalories(tdee, goal) {
  const map = { lose: Math.round(tdee - 500), maintain: Math.round(tdee), gain: Math.round(tdee + 300) };
  return map[goal] ?? Math.round(tdee);
}

/**
 * Macro split based on goal (protein_pct, carbs_pct, fat_pct)
 * Returns grams and percentages.
 */
function macroTargets(targetCal, goal, weightKg) {
  // Protein: 2g/kg for gain, 1.8g/kg for lose, 1.6g/kg for maintain
  const proteinPerKg = goal === 'gain' ? 2.2 : goal === 'lose' ? 1.8 : 1.6;
  const proteinG = Math.round(proteinPerKg * weightKg);
  const proteinCal = proteinG * 4;

  // Fat: 25-30% of calories
  const fatPct = goal === 'lose' ? 0.25 : 0.28;
  const fatCal = Math.round(targetCal * fatPct);
  const fatG   = Math.round(fatCal / 9);

  // Carbs: remainder
  const carbsCal = Math.max(0, targetCal - proteinCal - fatCal);
  const carbsG   = Math.round(carbsCal / 4);

  return {
    protein: { g: proteinG, pct: Math.round((proteinCal / targetCal) * 100) },
    carbs:   { g: carbsG,   pct: Math.round((carbsCal  / targetCal) * 100) },
    fat:     { g: fatG,     pct: Math.round((fatCal    / targetCal) * 100) },
  };
}

function getRecommendation(bmi, tdee, goal, gender) {
  const cat = bmiCategory(bmi);
  const tc  = targetCalories(tdee, goal);

  const tips = {
    underweight: `Your BMI indicates you're <strong>underweight</strong>. Aim for <strong>${tc} kcal/day</strong> with a calorie surplus. Focus on compound lifts (squats, deadlifts, bench press) and eat protein-rich meals. Progressive overload is key to gaining lean mass safely.`,
    normal:      `Your BMI is in the <strong>healthy range</strong>. Your target is <strong>${tc} kcal/day</strong>. ${goal === 'gain' ? 'A lean bulk (+300 kcal) with progressive strength training will maximise muscle gain.' : goal === 'lose' ? 'A slight deficit with resistance training will help you reduce body fat while keeping muscle.' : 'Keep up your current habits — consistency beats perfection.'}`,
    overweight:  `Your BMI suggests you're <strong>overweight</strong>. Target <strong>${tc} kcal/day</strong>. Combine 3–5 weekly strength sessions with 150 min/week of moderate cardio. Prioritise whole foods, sleep 7–9 hours, and manage stress — all influence fat loss.`,
    obese:       `Your BMI is in the <strong>obese</strong> range. Start with <strong>${tc} kcal/day</strong> and low-impact activity: walking, swimming, light resistance training. Small sustainable changes beat drastic ones. Consider consulting a healthcare professional for a personalised plan.`,
  };

  return tips[cat.key];
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = 'fitdata_calc_history';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveHistory(entry) {
  const hist = loadHistory();
  hist.unshift(entry);              // newest first
  if (hist.length > 10) hist.pop(); // keep last 10
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

function renderHistory() {
  const tbody   = document.getElementById('history-tbody');
  const section = document.getElementById('history-section');
  if (!tbody || !section) return;

  const hist = loadHistory();
  section.hidden = hist.length === 0;
  if (hist.length === 0) { tbody.innerHTML = ''; return; }

  tbody.innerHTML = hist.map(h => `
    <tr>
      <td>${new Date(h.date).toLocaleDateString()}</td>
      <td>${h.weight}</td>
      <td>${h.bmi}</td>
      <td><span class="bmi-category ${h.catCls}" style="font-size:10px;">${h.catLabel}</span></td>
      <td>${h.bmr} kcal</td>
      <td>${h.tdee} kcal</td>
      <td>${h.goal}</td>
    </tr>`).join('');
}

// ---------------------------------------------------------------------------
// Donut chart helpers (SVG stroke-dasharray trick)
// ---------------------------------------------------------------------------

const CIRC = 2 * Math.PI * 40; // ≈ 251.3 (r=40 in viewBox 110x110)

function setDonutArc(elId, pct, offsetPct) {
  const el = document.getElementById(elId);
  if (!el) return;
  const arc    = (pct / 100) * CIRC;
  const offset = (offsetPct / 100) * CIRC;
  el.style.strokeDasharray  = `${arc} ${CIRC - arc}`;
  el.style.strokeDashoffset = -offset;
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

const $ = sel => document.querySelector(sel);
const num = (id, val, unit = '') => {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `${Math.round(val)} <small>${unit}</small>`;
};

// ---------------------------------------------------------------------------
// Main calculate function
// ---------------------------------------------------------------------------

function calculate() {
  const gender   = $('#calc-gender').value;
  const age      = parseInt($('#calc-age').value, 10);
  const activity = parseFloat($('#calc-activity').value);
  const goal     = $('#calc-goal').value;
  const isMetric = $('input[name="unit"]:checked').value === 'metric';

  let weightKg, heightCm;

  if (isMetric) {
    heightCm = parseFloat($('#calc-height-cm').value);
    weightKg = parseFloat($('#calc-weight-kg').value);
  } else {
    heightCm = inToCm(parseFloat($('#calc-height-in').value));
    weightKg = lbToKg(parseFloat($('#calc-weight-lb').value));
  }

  const waistRaw = parseFloat($('#calc-waist').value);
  const waistCm  = isMetric ? waistRaw : inToCm(waistRaw); // handle imperial waist

  if (!age || !weightKg || !heightCm || isNaN(age) || isNaN(weightKg) || isNaN(heightCm)) {
    // Shake the submit button as a visual validation cue
    const btn = $('#calc-submit');
    btn.style.animation = 'none';
    void btn.offsetWidth; // reflow
    btn.style.animation = 'shake 0.3s ease';
    return;
  }

  // ── Core calculations ──────────────────────────────────────
  const bmi  = calcBMI(weightKg, heightCm);
  const bmr  = calcBMR(weightKg, heightCm, age, gender);
  const tdee = bmr * activity;
  const tc   = targetCalories(tdee, goal);
  const cat  = bmiCategory(bmi);
  const macros = macroTargets(tc, goal, weightKg);
  const range  = healthyWeightRange(heightCm);

  // ── Reveal results ─────────────────────────────────────────
  const panel = $('#results-panel');
  panel.classList.remove('is-visible');
  void panel.offsetWidth;                      // force reflow to restart animation
  panel.classList.add('is-visible');

  // ── BMI ───────────────────────────────────────────────────
  $('#bmi-value').textContent = bmi.toFixed(1);
  const catEl = $('#bmi-category');
  catEl.textContent = cat.label;
  catEl.className   = `bmi-category ${cat.cls}`;

  // Animate gauge marker
  setTimeout(() => {
    $('#bmi-marker').style.left = bmiGaugePct(bmi) + '%';
  }, 80);

  // Healthy weight range
  const unit     = isMetric ? 'kg' : 'lb';
  const rangeMin = isMetric ? range.min : +(kgToLb(range.min)).toFixed(1);
  const rangeMax = isMetric ? range.max : +(kgToLb(range.max)).toFixed(1);
  $('#healthy-range-text').textContent = `Healthy weight for your height: ${rangeMin}–${rangeMax} ${unit}`;

  // Waist risk
  const waistRow = $('#waist-risk-row');
  if (waistCm && !isNaN(waistCm)) {
    const risk = waistRisk(waistCm, gender);
    const badge = $('#waist-risk-badge');
    badge.textContent = risk.label;
    badge.className   = `bf-risk-badge ${risk.cls}`;
    waistRow.style.display = '';
  } else {
    waistRow.style.display = 'none';
  }

  // ── Calorie Cards ─────────────────────────────────────────
  num('bmr-value',  bmr,  'kcal/day');
  num('tdee-value', tdee, 'kcal/day');
  num('lose-value', tdee - 500, 'kcal/day');
  num('gain-value', tdee + 300, 'kcal/day');

  // Goal badge
  const goalLabels  = { lose: '🔥 Fat Loss', maintain: '⚡ Maintain', gain: '💪 Muscle Gain' };
  const goalBadge   = $('#goal-badge');
  goalBadge.textContent = goalLabels[goal] || '';
  goalBadge.className   = `bmi-category ${goal === 'lose' ? 'bmi-overweight' : goal === 'gain' ? 'bmi-normal' : 'bmi-underweight'}`;
  goalBadge.style.display = '';

  // Target calorie highlight
  const hiEl = $('#target-cal-highlight');
  const hiVal = $('#target-cal-value');
  if (hiEl && hiVal) {
    hiVal.textContent = tc.toLocaleString();
    hiEl.style.display = '';
  }

  // ── Macro chart ───────────────────────────────────────────
  const { protein, carbs, fat } = macros;

  // Bars (% of max among the three)
  const maxG = Math.max(protein.g, carbs.g, fat.g);
  document.getElementById('bar-protein').style.width = `${(protein.g / maxG * 100).toFixed(1)}%`;
  document.getElementById('bar-carbs').style.width   = `${(carbs.g   / maxG * 100).toFixed(1)}%`;
  document.getElementById('bar-fat').style.width     = `${(fat.g     / maxG * 100).toFixed(1)}%`;

  document.getElementById('macro-protein-g').textContent = `${protein.g} g`;
  document.getElementById('macro-carbs-g').textContent   = `${carbs.g} g`;
  document.getElementById('macro-fat-g').textContent     = `${fat.g} g`;

  // Donut arcs (stacked, each starts where previous ends)
  setDonutArc('donut-protein', protein.pct, 0);
  setDonutArc('donut-carbs',   carbs.pct,   protein.pct);
  setDonutArc('donut-fat',     fat.pct,     protein.pct + carbs.pct);

  document.getElementById('donut-label-pct').textContent =
    `${protein.pct}/${carbs.pct}/${fat.pct}`;

  // ── Recommendation ────────────────────────────────────────
  $('#recommendation-text').innerHTML = getRecommendation(bmi, tdee, goal, gender);

  // ── Scroll on mobile ──────────────────────────────────────
  if (window.innerWidth < 900) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Save to history ───────────────────────────────────────
  const weightDisplay = isMetric
    ? `${weightKg.toFixed(1)} kg`
    : `${parseFloat($('#calc-weight-lb').value).toFixed(1)} lb`;

  saveHistory({
    date     : Date.now(),
    weight   : weightDisplay,
    bmi      : bmi.toFixed(1),
    catLabel : cat.label,
    catCls   : cat.cls,
    bmr      : Math.round(bmr),
    tdee     : Math.round(tdee),
    goal     : goalLabels[goal] || goal,
  });
  renderHistory();
}

// ---------------------------------------------------------------------------
// Shake animation (validation feedback)
// ---------------------------------------------------------------------------

(function addShakeKeyframe() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20%,60%  { transform: translateX(-5px); }
      40%,80%  { transform: translateX(5px); }
    }
  `;
  document.head.appendChild(style);
})();

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  // Unit toggle → show/hide field groups + update waist label
  document.querySelectorAll('input[name="unit"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isMetric = radio.value === 'metric';
      document.getElementById('metric-fields').hidden = !isMetric;
      document.getElementById('imperial-fields').hidden = isMetric;

      // Update waist label
      const wlabel = document.getElementById('waist-label-text');
      if (wlabel) wlabel.textContent = isMetric ? 'Waist circumference (cm)' : 'Waist circumference (in)';
    });
  });

  // Form submit
  document.getElementById('calc-form').addEventListener('submit', e => {
    e.preventDefault();
    calculate();
  });

  // Clear history button
  document.getElementById('clear-history-btn')?.addEventListener('click', clearHistory);

  // Render any saved history on load
  renderHistory();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ==========================================================================
// 1RM CALCULATOR & STRENGTH STANDARDS
// ==========================================================================

// ---------------------------------------------------------------------------
// 1RM Formulas  (weight in kg, reps performed)
// ---------------------------------------------------------------------------

const orm = {
  epley:   (w, r) => r === 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10,
  brzycki: (w, r) => r === 1 ? w : Math.round((w / (1.0278 - 0.0278 * r)) * 10) / 10,
  lander:  (w, r) => r === 1 ? w : Math.round((100 * w / (101.3 - 2.67123 * r)) * 10) / 10,
};

// ---------------------------------------------------------------------------
// Strength Standards  (bodyweight multipliers × BW → 1RM)
// Sources: Symmetric Strength, StrengthLevel.com, Stronger By Science
// Format: { beginner, novice, intermediate, advanced, elite }
// ---------------------------------------------------------------------------

const STANDARDS = {
  male: {
    bench_press:       { beginner: 0.5, novice: 0.75, intermediate: 1.0, advanced: 1.25, elite: 1.5  },
    overhead_press:    { beginner: 0.3, novice: 0.5,  intermediate: 0.65,advanced: 0.8,  elite: 1.0  },
    incline_bench:     { beginner: 0.4, novice: 0.65, intermediate: 0.9, advanced: 1.1,  elite: 1.35 },
    dips_weighted:     { beginner: 0.3, novice: 0.5,  intermediate: 0.7, advanced: 0.9,  elite: 1.1  },
    barbell_row:       { beginner: 0.5, novice: 0.7,  intermediate: 0.9, advanced: 1.1,  elite: 1.35 },
    weighted_pullup:   { beginner: 0.15,novice: 0.35, intermediate: 0.55,advanced: 0.75, elite: 1.0  },
    lat_pulldown:      { beginner: 0.4, novice: 0.6,  intermediate: 0.8, advanced: 1.0,  elite: 1.2  },
    squat:             { beginner: 0.75,novice: 1.0,  intermediate: 1.25,advanced: 1.5,  elite: 1.75 },
    deadlift:          { beginner: 1.0, novice: 1.25, intermediate: 1.5, advanced: 1.75, elite: 2.0  },
    front_squat:       { beginner: 0.6, novice: 0.8,  intermediate: 1.0, advanced: 1.2,  elite: 1.45 },
    leg_press:         { beginner: 1.0, novice: 1.5,  intermediate: 2.0, advanced: 2.5,  elite: 3.0  },
    romanian_deadlift: { beginner: 0.7, novice: 0.9,  intermediate: 1.1, advanced: 1.35, elite: 1.6  },
  },
  female: {
    bench_press:       { beginner: 0.25,novice: 0.4,  intermediate: 0.55,advanced: 0.7,  elite: 0.9  },
    overhead_press:    { beginner: 0.15,novice: 0.25, intermediate: 0.35,advanced: 0.45, elite: 0.6  },
    incline_bench:     { beginner: 0.2, novice: 0.35, intermediate: 0.5, advanced: 0.65, elite: 0.8  },
    dips_weighted:     { beginner: 0.1, novice: 0.25, intermediate: 0.4, advanced: 0.55, elite: 0.7  },
    barbell_row:       { beginner: 0.3, novice: 0.45, intermediate: 0.6, advanced: 0.75, elite: 0.95 },
    weighted_pullup:   { beginner: 0.05,novice: 0.15, intermediate: 0.3, advanced: 0.5,  elite: 0.7  },
    lat_pulldown:      { beginner: 0.2, novice: 0.35, intermediate: 0.5, advanced: 0.65, elite: 0.8  },
    squat:             { beginner: 0.5, novice: 0.65, intermediate: 0.85,advanced: 1.05, elite: 1.3  },
    deadlift:          { beginner: 0.6, novice: 0.8,  intermediate: 1.0, advanced: 1.2,  elite: 1.5  },
    front_squat:       { beginner: 0.4, novice: 0.55, intermediate: 0.7, advanced: 0.9,  elite: 1.1  },
    leg_press:         { beginner: 0.6, novice: 1.0,  intermediate: 1.4, advanced: 1.8,  elite: 2.2  },
    romanian_deadlift: { beginner: 0.45,novice: 0.6,  intermediate: 0.75,advanced: 0.9,  elite: 1.1  },
  },
};

const EXERCISE_NAMES = {
  bench_press: 'Bench Press', overhead_press: 'Overhead Press',
  incline_bench: 'Incline Bench Press', dips_weighted: 'Weighted Dips',
  barbell_row: 'Barbell Row', weighted_pullup: 'Weighted Pull-up',
  lat_pulldown: 'Lat Pulldown', squat: 'Back Squat', deadlift: 'Deadlift',
  front_squat: 'Front Squat', leg_press: 'Leg Press',
  romanian_deadlift: 'Romanian Deadlift',
};

const LEVELS = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'];

const LEVEL_META = {
  beginner:     { icon: '🔰', label: 'Beginner',     cls: 'lvl-beginner',     dotCls: 'dot-beginner',     headline: 'Just Getting Started',    color: '#888' },
  novice:       { icon: '💪', label: 'Novice',        cls: 'lvl-novice',       dotCls: 'dot-novice',       headline: 'Building a Foundation',   color: '#81C784' },
  intermediate: { icon: '⚡', label: 'Intermediate',  cls: 'lvl-intermediate', dotCls: 'dot-intermediate', headline: 'Solid Lifter',             color: '#64B5F6' },
  advanced:     { icon: '🔥', label: 'Advanced',      cls: 'lvl-advanced',     dotCls: 'dot-advanced',     headline: 'Seriously Strong',         color: '#FFD54F' },
  elite:        { icon: '🏆', label: 'Elite',          cls: 'lvl-elite',        dotCls: 'dot-elite',        headline: 'Elite Athlete Level',      color: '#EF9A9A' },
  none:         { icon: '📋', label: 'Below Beginner',cls: 'lvl-none',         dotCls: '',                 headline: 'Keep Training!',           color: '#666' },
};

// Training percentages table data
const REP_PERCENTAGES = [
  { pct: 100, reps: 1,  zone: 'Max Effort' },
  { pct: 95,  reps: 2,  zone: 'Max Effort' },
  { pct: 90,  reps: 3,  zone: 'Strength' },
  { pct: 85,  reps: 4,  zone: 'Strength' },
  { pct: 80,  reps: 5,  zone: 'Strength' },
  { pct: 75,  reps: 6,  zone: 'Strength-Hypertrophy' },
  { pct: 70,  reps: 8,  zone: 'Hypertrophy' },
  { pct: 65,  reps: 10, zone: 'Hypertrophy' },
  { pct: 60,  reps: 12, zone: 'Hypertrophy' },
  { pct: 55,  reps: 15, zone: 'Endurance' },
  { pct: 50,  reps: 20, zone: 'Endurance' },
];

// ---------------------------------------------------------------------------
// Classify level given 1RM ratio (1RM / BW)
// ---------------------------------------------------------------------------

function classifyLevel(ratio, exKey, gender) {
  const std = STANDARDS[gender]?.[exKey];
  if (!std) return 'none';

  if (ratio >= std.elite)        return 'elite';
  if (ratio >= std.advanced)     return 'advanced';
  if (ratio >= std.intermediate) return 'intermediate';
  if (ratio >= std.novice)       return 'novice';
  if (ratio >= std.beginner)     return 'beginner';
  return 'none';
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderORMFormulas(w, r) {
  const epley   = orm.epley(w, r);
  const brzycki = orm.brzycki(w, r);
  const lander  = orm.lander(w, r);

  setEl('orm-epley',   epley);
  setEl('orm-brzycki', brzycki);
  setEl('orm-lander',  lander);

  // Highlight the average (Epley is industry standard — mark it as "best")
  ['orm-card-epley', 'orm-card-brzycki', 'orm-card-lander'].forEach(id => {
    document.getElementById(id)?.classList.remove('is-best');
  });
  document.getElementById('orm-card-epley')?.classList.add('is-best');

  // Add "Recommended" badge to Epley
  const epleyCard = document.getElementById('orm-card-epley');
  if (epleyCard && !epleyCard.querySelector('.orm-best-badge')) {
    const badge = document.createElement('span');
    badge.className = 'orm-best-badge';
    badge.textContent = '★ Standard';
    epleyCard.appendChild(badge);
  }

  return epley; // return primary 1RM
}

function renderLevelBadge(orm1RM, bw, exKey, gender) {
  const exName = EXERCISE_NAMES[exKey] || exKey;
  setEl('orm-std-exercise-name', exName);

  const levelEl    = document.getElementById('orm-level-badge');
  const iconEl     = document.getElementById('orm-level-icon');
  const headlineEl = document.getElementById('orm-level-headline');
  const subEl      = document.getElementById('orm-level-sub');
  const exNameEl   = document.getElementById('orm-level-exercise');

  if (!bw || bw <= 0) {
    if (levelEl)    { levelEl.textContent = '—'; levelEl.className = 'orm-level-badge lvl-none'; }
    if (iconEl)     iconEl.textContent = '📋';
    if (headlineEl) headlineEl.textContent = 'Enter bodyweight for level';
    if (subEl)      subEl.textContent = 'Add your bodyweight in the form above.';
    if (exNameEl)   exNameEl.textContent = exName;
    return;
  }

  const ratio = orm1RM / bw;
  const level = classifyLevel(ratio, exKey, gender);
  const meta  = LEVEL_META[level];

  if (iconEl)     iconEl.textContent = meta.icon;
  if (exNameEl)   exNameEl.textContent = exName;
  if (headlineEl) headlineEl.textContent = `${meta.headline} — ${(ratio).toFixed(2)}× bodyweight`;
  if (subEl)      subEl.textContent = `Your 1RM (${orm1RM} kg) is ${((orm1RM / bw) * 100).toFixed(0)}% of your bodyweight`;

  if (levelEl) {
    LEVELS.concat(['none']).forEach(l => levelEl.classList.remove(`lvl-${l}`));
    levelEl.className = `orm-level-badge ${meta.cls}`;
    levelEl.textContent = meta.label;
  }
}

function renderStandardsTable(orm1RM, bw, exKey, gender) {
  const tbody = document.getElementById('orm-standards-tbody');
  if (!tbody) return;

  const std    = STANDARDS[gender]?.[exKey];
  if (!std) { tbody.innerHTML = '<tr><td colspan="6">No standards data for this exercise.</td></tr>'; return; }

  const ratio  = bw > 0 ? orm1RM / bw : null;
  const level  = ratio ? classifyLevel(ratio, exKey, gender) : null;

  tbody.innerHTML = '';

  LEVELS.forEach(lvl => {
    const multiplier = std[lvl];
    const meta       = LEVEL_META[lvl];
    const isUserLevel = lvl === level;
    const userLiftPct = ratio ? Math.min(100, (ratio / multiplier) * 100) : 0;

    const tr = document.createElement('tr');
    if (isUserLevel) tr.className = 'is-user-level';

    // Level name cell
    const tdName = document.createElement('td');
    tdName.innerHTML = `<span class="orm-level-dot ${meta.dotCls}" aria-hidden="true"></span>${meta.label}`;
    if (isUserLevel) tdName.innerHTML += ` <span style="font-size:0.55rem;background:var(--color-accent);color:#fff;padding:1px 5px;border-radius:99px;margin-left:4px;letter-spacing:0.1em;">YOU</span>`;
    tr.appendChild(tdName);

    // Ratio cell
    const tdRatio = document.createElement('td');
    tdRatio.textContent = `${multiplier.toFixed(2)}×`;
    tr.appendChild(tdRatio);

    // Fixed BW columns: 70, 80, 90 kg
    [70, 80, 90].forEach(fixedBW => {
      const td = document.createElement('td');
      td.textContent = `${Math.round(multiplier * fixedBW)} kg`;
      tr.appendChild(td);
    });

    // User's lift column with progress bar
    const tdUser = document.createElement('td');
    if (bw > 0) {
      const targetKg = Math.round(multiplier * bw);
      tdUser.innerHTML = `
        <div class="orm-progress-cell">
          <span>${targetKg} kg</span>
          <div class="orm-progress-track" aria-hidden="true">
            <div class="orm-progress-fill" style="width:${isUserLevel ? userLiftPct.toFixed(0) : (orm1RM >= targetKg ? 100 : (orm1RM/targetKg*100).toFixed(0))}%"></div>
          </div>
        </div>`;
    } else {
      tdUser.textContent = '—';
    }
    tr.appendChild(tdUser);

    tbody.appendChild(tr);
  });
}

function renderRepsTable(orm1RM, inputReps) {
  const tbody = document.getElementById('orm-reps-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  REP_PERCENTAGES.forEach(row => {
    const tr = document.createElement('tr');
    // Check if this row is close to the user's input reps
    const isTarget = row.reps === inputReps || (row.reps === 1 && inputReps === 1);
    if (isTarget) tr.className = 'is-target-rep';

    const weightAtPct = Math.round(orm1RM * row.pct / 100 * 10) / 10;
    tr.innerHTML = `
      <td>${row.pct}%</td>
      <td>${weightAtPct} kg</td>
      <td>${row.reps} rep${row.reps > 1 ? 's' : ''}</td>
      <td>${row.zone}</td>`;
    tbody.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// Main calculate function
// ---------------------------------------------------------------------------

function calculateORM(e) {
  e.preventDefault();

  const exKey = document.getElementById('orm-exercise')?.value;
  const w     = parseFloat(document.getElementById('orm-weight')?.value);
  const r     = parseInt(document.getElementById('orm-reps')?.value, 10);
  const bw    = parseFloat(document.getElementById('orm-bodyweight')?.value) || 0;
  const gender = document.getElementById('orm-gender-select')?.value || 'male';

  if (!exKey || !w || w <= 0 || !r || r < 1 || r > 20) {
    alert('Please enter a valid exercise, weight (> 0 kg) and reps (1–20).');
    return;
  }

  // Show output, hide placeholder
  document.getElementById('orm-placeholder').hidden = true;
  document.getElementById('orm-output').hidden      = false;

  // Render 3 formula cards
  const primary1RM = renderORMFormulas(w, r);

  // Render level badge
  renderLevelBadge(primary1RM, bw, exKey, gender);

  // Render standards table
  renderStandardsTable(primary1RM, bw, exKey, gender);

  // Render reps table
  renderRepsTable(primary1RM, r);

  // Smooth scroll to results
  document.getElementById('orm-output').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Init 1RM form
// ---------------------------------------------------------------------------

function initORM() {
  const form = document.getElementById('orm-form');
  if (!form) return;
  form.addEventListener('submit', calculateORM);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initORM);
} else {
  initORM();
}
