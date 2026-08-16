/**
 * i18n.js — Internationalisation module for FitData Hub.
 *
 * Supports EN (default) and VI.
 * Translates all elements with [data-i18n] attribute.
 * Persists language choice in localStorage.
 *
 * Usage:
 *   - Static HTML:  <span data-i18n="nav.exercises">Exercises</span>
 *   - Dynamic JS :  import { t } from './i18n.js';  el.textContent = t('nav.exercises');
 */

const STORAGE_KEY = 'fitdata_lang';
const DEFAULT_LANG = 'en';

// ---------------------------------------------------------------------------
// Translation dictionaries
// ---------------------------------------------------------------------------

const translations = {
  vi: {
    // ── Navigation ──
    'nav.exercises': 'Bài tập',
    'nav.recommender': 'Gợi ý',
    'nav.schedule': 'Lịch tập',
    'nav.analytics': 'Thống kê',
    'nav.calculator': 'Máy tính',
    'nav.favourites': 'Yêu thích',

    // ── Common ──
    'common.view_exercise': 'Xem bài tập',
    'common.view_all': 'Xem tất cả',
    'common.loading': 'Đang tải…',
    'common.error_api': 'Không tải được dữ liệu. API có đang chạy không?',
    'common.no_results': 'Không tìm thấy bài tập phù hợp.',

    // ── Footer ──
    'footer.source': 'Dữ liệu từ',
    'footer.tagline': 'FitData Hub — Dự án học Data Engineering & Analytics.',

    // ── Index page ──
    'index.title': 'Thư viện\nBài tập',
    'index.hero_text': 'bài tập qua tất cả nhóm cơ, thiết bị và vùng cơ thể. Tìm động tác của bạn.',
    'index.browse': 'Duyệt',
    'index.cta_plan': 'Tạo lịch tập',
    'index.cta_stats': 'Xem thống kê',
    'index.search_placeholder': 'Tìm theo tên, cơ, hoặc động tác…',
    'index.filter_body_part': 'Vùng cơ thể',
    'index.filter_equipment': 'Thiết bị',
    'index.filter_muscle': 'Cơ mục tiêu',
    'index.clear_filters': 'Xóa bộ lọc',
    'index.eod_badge': '⭐ Bài tập trong ngày',

    // ── Exercise detail ──
    'detail.back': '← Quay lại thư viện',
    'detail.body_part': 'Vùng cơ thể',
    'detail.equipment': 'Thiết bị',
    'detail.target': 'Cơ mục tiêu',
    'detail.muscles': 'Nhóm cơ',
    'detail.instructions': 'Hướng dẫn từng bước',
    'detail.benefits': 'Lợi ích',
    'detail.tips': 'Mẹo & Lưu ý',
    'detail.add_schedule': 'Thêm vào lịch',
    'detail.alternatives': 'Bài tập thay thế',
    'detail.alt_subtitle': 'Cùng cơ mục tiêu — khác thiết bị',
    'detail.related': 'Bài tập liên quan',
    'detail.attribution': 'Nguồn',
    'detail.notes_title': 'Ghi chú của tôi',
    'detail.notes_hint': 'Ghi chú cá nhân được lưu trên trình duyệt của bạn.',
    'detail.notes_save': 'Lưu ghi chú',
    'detail.compare_title': 'So sánh bài tập',
    'detail.compare_hint': 'So sánh bài tập này với một bài tập khác.',
    'detail.compare_btn': '🔀 So sánh với bài tập khác',

    // ── Compare page ──
    'compare.title': 'So sánh<br><strong>Bài tập</strong>',
    'compare.subtitle': 'Chọn hai bài tập để so sánh song song — GIF, nhóm cơ, thiết bị và hướng dẫn chi tiết.',
    'compare.select_a': 'Tìm và chọn bài tập đầu tiên',
    'compare.select_b': 'Tìm và chọn bài tập thứ hai',

    // ── Recommend page ──
    'recommend.title': 'Gợi ý\nThông minh',
    'recommend.subtitle': 'Tạo lịch tập cá nhân hóa dựa trên mục tiêu, thiết bị và trình độ của bạn.',
    'recommend.templates_title': '⚡ Lịch tập mẫu nhanh',
    'recommend.templates_hint': 'Nhấp để tự động thiết lập tùy chọn',
    'recommend.step1': 'Chọn mục tiêu',
    'recommend.step2': 'Thiết bị của bạn',
    'recommend.step3': 'Chi tiết',
    'recommend.step4': 'Lịch tập',
    'recommend.goal_muscle': 'Tăng cơ',
    'recommend.goal_weight': 'Giảm cân',
    'recommend.goal_endurance': 'Tăng sức bền',
    'recommend.goal_flexibility': 'Linh hoạt',
    'recommend.goal_general': 'Thể hình tổng hợp',
    'recommend.next': 'Tiếp theo',
    'recommend.back': 'Quay lại',
    'recommend.generate': 'Tạo lịch tập',
    'recommend.fitness_level': 'Trình độ',
    'recommend.beginner': 'Người mới',
    'recommend.intermediate': 'Trung cấp',
    'recommend.advanced': 'Nâng cao',
    'recommend.duration': 'Thời lượng buổi tập',
    'recommend.days_per_week': 'Số ngày tập / tuần',
    'recommend.body_parts': 'Vùng cơ thể tập trung (tùy chọn)',
    'recommend.save_schedule': 'Lưu lịch tập',
    'recommend.plan_result': 'Lịch tập của bạn',
    'recommend.exercises_label': 'bài tập',
    'recommend.rest_day': 'Ngày nghỉ',

    // ── Schedule page ──
    'schedule.title': 'Lịch tập\ncủa tôi',
    'schedule.loading': 'Đang tải lịch tập…',
    'schedule.empty_title': 'Chưa có lịch tập',
    'schedule.empty_text': 'Bạn chưa có lịch tập. Tạo ngay trong vài giây.',
    'schedule.generate': 'Tạo lịch tập',
    'schedule.generate_new': 'Tạo lịch mới',
    'schedule.delete': 'Xóa lịch',

    // ── Analytics page ──
    'analytics.title': 'Thống kê\nDữ liệu',
    'analytics.subtitle': 'Khám phá phân bố bài tập, thiết bị và cơ mục tiêu trong thư viện FitData Hub.',
    'analytics.chart_hint': '💡 Mẹo: Nhấp vào bất kỳ cột hoặc phần biểu đồ nào để lọc bài tập trong Thư viện.',
    'analytics.export_csv': '📥 Xuất CSV',
    'analytics.export_json': '📥 Xuất JSON',
    'analytics.total_exercises': 'Tổng bài tập',
    'analytics.equipment_types': 'Loại thiết bị',
    'analytics.target_muscles': 'Cơ mục tiêu',
    'analytics.body_regions': 'Vùng cơ thể',
    'analytics.equipment_chart': 'Thiết bị phổ biến',
    'analytics.equipment_desc': 'Top 15 loại thiết bị phổ biến nhất.',
    'analytics.muscle_chart': 'Phân bố cơ mục tiêu',
    'analytics.muscle_desc': 'Bài tập theo cơ mục tiêu chính.',
    'analytics.bodypart_chart': 'Phân bố vùng cơ thể',
    'analytics.bodypart_desc': 'Tổng quan theo vùng.',
    'analytics.cooccurrence': 'Cặp cơ thường tập chung',
    'analytics.cooccurrence_desc': 'Các cơ hay tập cùng nhau nhất.',
    'analytics.muscle_a': 'Cơ A',
    'analytics.muscle_b': 'Cơ B',
    'analytics.count': 'Số lần',
    'analytics.etl_title': 'Lịch sử ETL Pipeline',
    'analytics.etl_desc': '10 lần chạy gần nhất (mới nhất trước)',
    'analytics.run_id': 'ID chạy',
    'analytics.status': 'Trạng thái',
    'analytics.extracted': 'Trích xuất',
    'analytics.valid': 'Hợp lệ',
    'analytics.invalid': 'Không hợp lệ',
    'analytics.loaded': 'Đã nạp',
    'analytics.duration': 'Thời gian',
    'analytics.started': 'Bắt đầu',

    // ── Favourites page ──
    'fav.title': 'Yêu thích\ncủa tôi',
    'fav.count_label': 'bài tập đã lưu',
    'fav.empty_title': 'Chưa có yêu thích',
    'fav.empty_text': 'Duyệt bài tập và nhấn ❤️ để lưu vào đây.',
    'fav.browse': 'Duyệt bài tập',
    'fav.clear_all': 'Xóa tất cả',
    'fav.remove_hint': 'Nhấn ❤️ trên bài tập để xóa khỏi yêu thích.',
    'fav.toast_added': 'Đã thêm vào yêu thích ❤️',
    'fav.toast_removed': 'Đã xóa khỏi yêu thích',
    'fav.sort_label': 'Sắp xếp',
    'fav.sort_newest': '🕐 Mới nhất',
    'fav.sort_oldest': '🕐 Cũ nhất',
    'fav.sort_alpha': '🔤 A → Z',
    'fav.filter_bp_label': 'Lọc theo vùng cơ thể',
    'fav.filter_bp_all': 'Tất cả vùng cơ thể',
    'fav.filter_eq_label': 'Lọc theo thiết bị',
    'fav.filter_eq_all': 'Tất cả thiết bị',
    'fav.bulk_select': '☑ Chọn nhiều',
    'fav.bulk_remove': 'Xóa đã chọn',
    'fav.bulk_cancel': 'Hủy',
    'fav.export_csv': '📥 Xuất CSV',
    'fav.export_json': '📥 Xuất JSON',
    'fav.share': '🔗 Chia sẻ',

    // ── Language ──
    'lang.label': 'Ngôn ngữ',
    'lang.en': 'English',
    'lang.vi': 'Tiếng Việt',

    // ── Calculator page ──
    'calc.title': 'Máy tính\nChỉ số cơ thể',
    'calc.subtitle': 'Tính chỉ số BMI, BMR và TDEE để hiểu thành phần cơ thể và nhu cầu calo hàng ngày.',
    'calc.your_stats': 'Chỉ số cơ thể',
    'calc.metric': 'Hệ mét (kg/cm)',
    'calc.imperial': 'Hệ Anh (lb/in)',
    'calc.gender': 'Giới tính',
    'calc.male': 'Nam',
    'calc.female': 'Nữ',
    'calc.age': 'Tuổi',
    'calc.height_cm': 'Chiều cao (cm)',
    'calc.weight_kg': 'Cân nặng (kg)',
    'calc.activity_level': 'Mức vận động',
    'calc.sedentary': 'Ít vận động (ngồi văn phòng)',
    'calc.light': 'Nhẹ (1–3 ngày/tuần)',
    'calc.moderate': 'Trung bình (3–5 ngày/tuần)',
    'calc.very_active': 'Nhiều (6–7 ngày/tuần)',
    'calc.extra_active': 'Rất nhiều (vận động viên)',
    'calc.calculate': 'Tính toán',
    'calc.bmi_title': 'Chỉ số khối cơ thể (BMI)',
    'calc.daily_calories': 'Nhu cầu Calo hàng ngày',
    'calc.bmr_label': 'BMR',
    'calc.tdee_label': 'TDEE',
    'calc.lose_label': 'Để giảm cân',
    'calc.gain_label': 'Để tăng cơ',
    'calc.recommendation': 'Khuyến nghị',
  },
};

// English is the source language — keys map to themselves
// We don't need an EN dictionary; we just use the HTML's original text.

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _currentLang = DEFAULT_LANG;

export function getLang() { return _currentLang; }

export function setLang(lang) {
  _currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  applyTranslations();
  window.dispatchEvent(new CustomEvent('lang-changed', { detail: { lang } }));
}

/**
 * Translate a key. Returns the Vietnamese string if lang=vi,
 * or the fallback (English default text) otherwise.
 */
export function t(key, fallback) {
  if (_currentLang === 'en') return fallback || key;
  return translations.vi?.[key] || fallback || key;
}

// ---------------------------------------------------------------------------
// DOM translation
// ---------------------------------------------------------------------------

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (_currentLang === 'en') {
      // Restore original English text (stored on first pass)
      const original = el.getAttribute('data-i18n-original');
      if (original !== null) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = original;
        } else {
          el.innerHTML = original;
        }
      }
    } else {
      // Save original English text if not saved yet
      if (!el.hasAttribute('data-i18n-original')) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.setAttribute('data-i18n-original', el.placeholder);
        } else {
          el.setAttribute('data-i18n-original', el.innerHTML);
        }
      }
      const translated = translations.vi?.[key];
      if (translated) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = translated;
        } else {
          // Support \n → <br> for multi-line headings
          el.innerHTML = translated.replace(/\n/g, '<br>');
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Language switcher component (injected into header)
// ---------------------------------------------------------------------------

function createLangSwitcher() {
  const header = document.querySelector('.header-inner');
  if (!header) return;

  // Check-mark SVG (shown next to active language)
  const checkSVG = `<svg class="lang-check" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  const wrapper = document.createElement('nav');
  wrapper.className = 'lang-switcher';
  wrapper.setAttribute('aria-label', 'Language selector');

  wrapper.innerHTML = `
    <button type="button" class="lang-toggle" id="lang-toggle-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="Change language — current: ${_currentLang === 'vi' ? 'Tiếng Việt' : 'English'}">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/>
      </svg>
      <span class="lang-current">${_currentLang === 'vi' ? '🇻🇳 VI' : '🇺🇸 EN'}</span>
    </button>
    <ul class="lang-dropdown" role="listbox" id="lang-dropdown" aria-labelledby="lang-toggle-btn">
      <li role="option" data-lang="en" tabindex="-1" ${_currentLang === 'en' ? 'aria-selected="true"' : 'aria-selected="false"'}>
        <span class="lang-option-left">
          <span class="lang-flag">🇺🇸</span>
          <span>English</span>
        </span>
        ${checkSVG}
      </li>
      <li role="option" data-lang="vi" tabindex="-1" ${_currentLang === 'vi' ? 'aria-selected="true"' : 'aria-selected="false"'}>
        <span class="lang-option-left">
          <span class="lang-flag">🇻🇳</span>
          <span>Tiếng Việt</span>
        </span>
        ${checkSVG}
      </li>
    </ul>`;

  header.appendChild(wrapper);

  const toggle   = wrapper.querySelector('.lang-toggle');
  const dropdown = wrapper.querySelector('.lang-dropdown');
  const label    = wrapper.querySelector('.lang-current');
  const options  = [...dropdown.querySelectorAll('[data-lang]')];

  // ── Helpers ──────────────────────────────────────────────
  function openDropdown() {
    dropdown.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    // Focus the active option
    const active = dropdown.querySelector('[aria-selected="true"]');
    (active || options[0])?.focus();
  }

  function closeDropdown() {
    dropdown.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }

  function selectLang(lang) {
    setLang(lang);
    label.textContent = lang === 'vi' ? '🇻🇳 VI' : '🇺🇸 EN';
    toggle.setAttribute('aria-label', `Change language — current: ${lang === 'vi' ? 'Tiếng Việt' : 'English'}`);
    options.forEach(opt => {
      opt.setAttribute('aria-selected', opt.dataset.lang === lang ? 'true' : 'false');
    });
    closeDropdown();
  }

  // ── Toggle button ─────────────────────────────────────────
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('is-open');
    isOpen ? closeDropdown() : openDropdown();
  });

  // ── Option click ──────────────────────────────────────────
  options.forEach(opt => {
    opt.addEventListener('click', () => selectLang(opt.dataset.lang));
  });

  // ── Keyboard navigation ───────────────────────────────────
  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openDropdown();
    }
  });

  dropdown.addEventListener('keydown', (e) => {
    const focused = document.activeElement;
    const idx     = options.indexOf(focused);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        options[(idx + 1) % options.length]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        options[(idx - 1 + options.length) % options.length]?.focus();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focused?.dataset?.lang) selectLang(focused.dataset.lang);
        break;
      case 'Escape':
      case 'Tab':
        closeDropdown();
        break;
    }
  });

  // ── Close on outside click ────────────────────────────────
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) closeDropdown();
  });
}


// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && (saved === 'en' || saved === 'vi')) {
    _currentLang = saved;
  }
  document.documentElement.lang = _currentLang;
  createLangSwitcher();
  if (_currentLang !== 'en') {
    applyTranslations();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
