/**
 * calculator.js — BMI / BMR / TDEE calculator logic.
 *
 * All calculations are client-side. No API calls needed.
 *
 * Formulas:
 *   BMI  = weight(kg) / height(m)²
 *   BMR  = Mifflin–St Jeor equation
 *          Male:   10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5
 *          Female: 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161
 *   TDEE = BMR × activity multiplier
 */

// ---------------------------------------------------------------------------
// Unit conversion helpers
// ---------------------------------------------------------------------------

function lbToKg(lb) { return lb * 0.453592; }
function inToCm(inches) { return inches * 2.54; }

// ---------------------------------------------------------------------------
// Core calculations
// ---------------------------------------------------------------------------

function calcBMI(weightKg, heightCm) {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function calcBMR(weightKg, heightCm, age, gender) {
  // Mifflin–St Jeor equation
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return { key: 'underweight', label: 'Underweight', cls: 'bmi-underweight' };
  if (bmi < 25)   return { key: 'normal',      label: 'Normal Weight', cls: 'bmi-normal' };
  if (bmi < 30)   return { key: 'overweight',   label: 'Overweight', cls: 'bmi-overweight' };
  return { key: 'obese', label: 'Obese', cls: 'bmi-obese' };
}

function bmiToGaugePercent(bmi) {
  // Map BMI 15–40 to 0%–100%
  const clamped = Math.max(15, Math.min(40, bmi));
  return ((clamped - 15) / 25) * 100;
}

function healthyWeightRange(heightCm) {
  const hm = heightCm / 100;
  return {
    min: Math.round(18.5 * hm * hm * 10) / 10,
    max: Math.round(24.9 * hm * hm * 10) / 10,
  };
}

function getRecommendation(bmi, tdee, gender) {
  const cat = bmiCategory(bmi);
  const recs = {
    underweight: `Your BMI indicates you are <strong>underweight</strong>. Focus on a calorie surplus of <strong>~${Math.round(tdee + 400)} kcal/day</strong> with protein-rich meals and compound exercises like squats, deadlifts, and bench press to build lean mass safely.`,
    normal: `Great news — your BMI is in the <strong>healthy range</strong>! Maintain your current calorie intake of <strong>~${Math.round(tdee)} kcal/day</strong>. Mix strength training with cardio to stay fit. Consider a lean bulk (+200 kcal) if you want more muscle.`,
    overweight: `Your BMI suggests you are slightly <strong>overweight</strong>. A moderate calorie deficit of <strong>~${Math.round(tdee - 500)} kcal/day</strong> combined with 3–5 weekly workouts (mix of strength + HIIT) can help you get back on track.`,
    obese: `Your BMI is in the <strong>obese</strong> range. Start with a <strong>~${Math.round(tdee - 600)} kcal/day</strong> target and focus on low-impact exercises: walking, swimming, light resistance training. Consider consulting a healthcare professional.`,
  };
  return recs[cat.key];
}

// ---------------------------------------------------------------------------
// DOM interaction
// ---------------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);

function init() {
  // Unit toggle
  document.querySelectorAll('input[name="unit"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isMetric = radio.value === 'metric';
      $('#metric-fields').style.display = isMetric ? '' : 'none';
      $('#imperial-fields').style.display = isMetric ? 'none' : '';
    });
  });

  // Form submit
  $('#calc-form').addEventListener('submit', (e) => {
    e.preventDefault();
    calculate();
  });
}

function calculate() {
  const gender = $('#calc-gender').value;
  const age = parseInt($('#calc-age').value, 10);
  const activity = parseFloat($('#calc-activity').value);
  const isMetric = $('input[name="unit"]:checked').value === 'metric';

  let weightKg, heightCm;

  if (isMetric) {
    heightCm = parseFloat($('#calc-height-cm').value);
    weightKg = parseFloat($('#calc-weight-kg').value);
  } else {
    heightCm = inToCm(parseFloat($('#calc-height-in').value));
    weightKg = lbToKg(parseFloat($('#calc-weight-lb').value));
  }

  if (!age || !weightKg || !heightCm) return;

  // Calculate
  const bmi = calcBMI(weightKg, heightCm);
  const bmr = calcBMR(weightKg, heightCm, age, gender);
  const tdee = bmr * activity;
  const cat = bmiCategory(bmi);
  const range = healthyWeightRange(heightCm);

  // Show results panel
  $('#results-panel').classList.add('is-visible');

  // BMI
  $('#bmi-value').textContent = bmi.toFixed(1);
  const catEl = $('#bmi-category');
  catEl.textContent = cat.label;
  catEl.className = 'bmi-category ' + cat.cls;

  // Gauge marker
  $('#bmi-marker').style.left = bmiToGaugePercent(bmi) + '%';

  // Healthy range
  const unit = isMetric ? 'kg' : 'lb';
  const rangeMin = isMetric ? range.min : Math.round(range.min / 0.453592 * 10) / 10;
  const rangeMax = isMetric ? range.max : Math.round(range.max / 0.453592 * 10) / 10;
  $('#healthy-range-text').textContent = `Healthy weight for your height: ${rangeMin}–${rangeMax} ${unit}`;

  // BMR & TDEE
  $('#bmr-value').innerHTML = `${Math.round(bmr)} <small>kcal/day</small>`;
  $('#tdee-value').innerHTML = `${Math.round(tdee)} <small>kcal/day</small>`;
  $('#lose-value').innerHTML = `${Math.round(tdee - 500)} <small>kcal/day</small>`;
  $('#gain-value').innerHTML = `${Math.round(tdee + 300)} <small>kcal/day</small>`;

  // Recommendation
  $('#recommendation-text').innerHTML = getRecommendation(bmi, tdee, gender);

  // Scroll to results on mobile
  if (window.innerWidth < 768) {
    $('#results-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
