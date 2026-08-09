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

    // ── Recommend page ──
    'recommend.title': 'Gợi ý\nThông minh',
    'recommend.subtitle': 'Tạo lịch tập cá nhân hóa dựa trên mục tiêu, thiết bị và trình độ của bạn.',
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

    // ── Language ──
    'lang.label': 'Ngôn ngữ',
    'lang.en': 'English',
    'lang.vi': 'Tiếng Việt',
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

  const wrapper = document.createElement('div');
  wrapper.className = 'lang-switcher';
  wrapper.innerHTML = `
    <button type="button" class="lang-toggle" aria-label="Change language" aria-expanded="false">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/>
      </svg>
      <span class="lang-current">${_currentLang === 'vi' ? 'VI' : 'EN'}</span>
    </button>
    <ul class="lang-dropdown" role="listbox" aria-label="Select language">
      <li role="option" data-lang="en" ${_currentLang === 'en' ? 'aria-selected="true"' : ''}>
        <span class="lang-flag">🇺🇸</span> English
      </li>
      <li role="option" data-lang="vi" ${_currentLang === 'vi' ? 'aria-selected="true"' : ''}>
        <span class="lang-flag">🇻🇳</span> Tiếng Việt
      </li>
    </ul>`;

  header.appendChild(wrapper);

  const toggle = wrapper.querySelector('.lang-toggle');
  const dropdown = wrapper.querySelector('.lang-dropdown');
  const currentLabel = wrapper.querySelector('.lang-current');

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  dropdown.querySelectorAll('[data-lang]').forEach(option => {
    option.addEventListener('click', () => {
      const lang = option.dataset.lang;
      setLang(lang);
      currentLabel.textContent = lang.toUpperCase();
      dropdown.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');

      // Update aria-selected
      dropdown.querySelectorAll('[role="option"]').forEach(opt => {
        opt.setAttribute('aria-selected', opt.dataset.lang === lang ? 'true' : 'false');
      });
    });
  });

  // Close on click outside
  document.addEventListener('click', () => {
    dropdown.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
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
