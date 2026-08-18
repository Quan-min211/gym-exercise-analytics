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
