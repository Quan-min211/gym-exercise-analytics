# FitData Hub — System Context & Architecture Reference

> **Mục đích**: File này ghi lại toàn bộ kiến trúc, ý tưởng, công nghệ, và nội dung chi tiết của từng phần trong hệ thống FitData Hub. AI agent hoặc developer mới **BẮT BUỘC** phải đọc file này trước khi thực hiện bất kỳ task nào để không phá vỡ những gì đã xây dựng.
>
> **Cập nhật lần cuối**: 2026-08-10

---

## Tổng quan dự án

**FitData Hub** là một nền tảng phân tích và khám phá bài tập gym, được xây dựng theo mô hình Data Engineering + Full-stack Web Application. Dự án bao gồm 5 tầng chính:

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (SPA)                          │
│         Vanilla HTML5/CSS/JS — Iron Plate Design            │
├─────────────────────────────────────────────────────────────┤
│                     BACKEND API                             │
│            FastAPI + Pydantic + SQLAlchemy ORM              │
├─────────────────────────────────────────────────────────────┤
│                  RECOMMENDATION ENGINE                      │
│             Rule-based goal→muscle→exercise                 │
├─────────────────────────────────────────────────────────────┤
│                   DE PIPELINE (ETL)                         │
│     exercises.json → Validate → Normalize → PostgreSQL      │
├─────────────────────────────────────────────────────────────┤
│                     DATABASE                                │
│           PostgreSQL 16 — 3NF Normalized Schema             │
├─────────────────────────────────────────────────────────────┤
│                     INFRASTRUCTURE                          │
│        Docker Compose + GitHub Actions CI/CD                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. DATA LAYER — Dữ liệu gốc

### Ý tưởng
Sử dụng bộ dataset `exercises.json` (~17MB, 800+ bài tập) từ GymVisual làm nguồn dữ liệu chính. Mỗi bài tập chứa: tên, body part, equipment, target muscle, secondary muscles, instructions (đa ngôn ngữ), hình ảnh thumbnail và GIF minh họa.

### Công nghệ
- **Format**: JSON (1 file chính `data/exercises.json`)
- **Schema**: Có file `data/exercises.schema.json` định nghĩa cấu trúc chuẩn
- **Media**: ~800 ảnh JPG (`images/`) và ~800 GIF (`videos/`)

### Nội dung chi tiết

| File/Thư mục | Mô tả |
|---|---|
| `data/exercises.json` | Bộ dataset chính — mảng JSON chứa 800+ exercise objects |
| `data/exercises.schema.json` | JSON Schema validation cho từng exercise record |
| `images/` | Ảnh thumbnail JPG cho mỗi bài tập |
| `videos/` | GIF minh họa động tác cho mỗi bài tập |

### Cấu trúc 1 exercise record
```json
{
  "id": "0001",
  "name": "3/4 Sit-Up",
  "category": "strength",
  "body_part": "waist",
  "equipment": "body weight",
  "target": "abs",
  "muscle_group": "abs",
  "secondary_muscles": ["hip flexors", "obliques"],
  "instructions": { "en": "...", "es": "...", ... },
  "instruction_steps": { "en": ["Step 1...", ...], ... },
  "media_id": "0001",
  "image": "images/0001.jpg",
  "gif_url": "videos/0001.gif",
  "attribution": "© GymVisual",
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## 2. DE PIPELINE — Data Engineering (ETL)

### Ý tưởng
Xây dựng pipeline ETL (Extract → Transform → Load) chuyên nghiệp để đưa dữ liệu thô JSON vào database PostgreSQL đã chuẩn hóa 3NF. Pipeline chạy 1 lần duy nhất khi khởi tạo hệ thống (seed data), sau đó exit.

### Công nghệ
- **Python 3.12** — ngôn ngữ chính
- **SQLAlchemy 2.0** — ORM + DDL (tự tạo bảng từ model)
- **psycopg2** — PostgreSQL driver
- **Alembic** — migration (dự phòng)

### Nội dung chi tiết

| File | Vai trò |
|---|---|
| `de_pipeline/config.py` | Cấu hình: paths, database URL, batch size, supported languages |
| `de_pipeline/models.py` | ORM models — định nghĩa toàn bộ schema database (6 bảng, xem bên dưới) |
| `de_pipeline/etl.py` | Pipeline ETL chính: Extract JSON → Validate → Normalize → Upsert PostgreSQL |
| `de_pipeline/data_quality.py` | Module kiểm tra chất lượng dữ liệu: completeness, uniqueness, consistency, referential integrity |
| `de_pipeline/Dockerfile` | Docker image cho ETL container |

### Database Schema (3NF)

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  body_parts  │     │    exercises      │     │   muscles    │
│──────────────│     │──────────────────│     │──────────────│
│ id (PK, int) │◄────│ body_part_id (FK)│     │ id (PK, int) │
│ name (uniq)  │     │ equipment_id (FK)│────►│ name (uniq)  │
└──────────────┘     │ target_muscle_id │     └──────┬───────┘
                     │ (FK → muscles)   │            │
┌──────────────┐     │ id (PK, str "0001")│    ┌─────┴────────┐
│equipment_types│     │ name, category   │    │exercise_muscles│
│──────────────│     │ muscle_group     │    │──────────────  │
│ id (PK, int) │◄────│ media_id, image  │    │ exercise_id(FK)│
│ name (uniq)  │     │ gif_url, attrib  │    │ muscle_id (FK) │
└──────────────┘     │ created_at       │    │ is_primary     │
                     └────────┬─────────┘    └────────────────┘
                              │
                     ┌────────┴─────────┐
                     │  instructions    │
                     │─────────────────│
                     │ exercise_id (FK) │
                     │ lang_code ("en") │
                     │ full_text        │
                     │ steps (JSON)     │
                     └─────────────────┘
```

**6 bảng ORM** (trong `de_pipeline/models.py`):
1. **`BodyPart`** — 10 body parts: back, cardio, chest, lower arms, lower legs, neck, shoulders, upper arms, upper legs, waist
2. **`Muscle`** — Tất cả muscles (target + secondary) — dùng chung 1 bảng
3. **`EquipmentType`** — Các loại thiết bị: body weight, dumbbell, barbell, cable, machine...
4. **`Exercise`** — Bảng chính: FK đến 3 lookup tables, string PK 4 ký tự ("0001")
5. **`ExerciseMuscle`** — Junction M2M: exercise ↔ muscle, có cờ `is_primary`
6. **`Instruction`** — Instructions đa ngôn ngữ (10 ngôn ngữ), cột `steps` kiểu JSON

### ETL Flow
```
exercises.json
     │
     ▼
 [EXTRACT] — json.load(), parse 800+ records
     │
     ▼
 [VALIDATE] — data_quality.py checks (completeness, uniqueness, schema)
     │
     ▼
 [TRANSFORM] — Normalize strings (lowercase), build lookup maps,
                resolve FK IDs, split M2M muscles, extract instructions
     │
     ▼
  [LOAD] — Batch upsert vào PostgreSQL (batch_size=100)
            Base.metadata.create_all() tự tạo bảng nếu chưa có
```

> **LƯU Ý QUAN TRỌNG**: Column `steps` trong bảng `instructions` dùng `sqlalchemy.JSON` (KHÔNG phải `JSONB` của PostgreSQL) để tương thích với SQLite trong testing.

---

## 3. BACKEND API — FastAPI REST

### Ý tưởng
Cung cấp REST API cho frontend SPA: duyệt bài tập, tìm kiếm, lọc, xem chi tiết, gợi ý lịch tập, quản lý schedule, và dashboard analytics. API cũng serve static files (frontend + media).

### Công nghệ
- **FastAPI** — web framework (async, auto-docs, type validation)
- **Pydantic v2** — request/response schemas, serialization
- **SQLAlchemy 2.0** — ORM queries (reuse models từ de_pipeline)
- **Uvicorn** — ASGI server
- **psycopg2** — PostgreSQL driver

### Nội dung chi tiết

| File | Vai trò |
|---|---|
| `backend/main.py` | App entry point — CORS, route registration, static file mounts |
| `backend/database.py` | Engine + SessionLocal + `get_db()` dependency |
| `backend/schemas.py` | Pydantic models: request/response cho tất cả endpoints |
| `backend/routers/exercises.py` | CRUD exercises: list, search, filter, detail |
| `backend/routers/recommendations.py` | Thin wrapper gọi recommendation_engine |
| `backend/routers/schedules.py` | CRUD schedules: create, get, update, delete (raw SQL, bảng tự quản lý) |
| `backend/routers/analytics.py` | Dataset overview + muscle co-occurrence |
| `backend/services/recommendation_engine.py` | Rule-based recommendation logic |
| `backend/Dockerfile` | Docker image: Python 3.12-slim + uvicorn |

### API Endpoints

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/health` | Health check — trả `{"status": "ok"}` |
| `GET` | `/api/exercises` | Danh sách bài tập (phân trang, filter: body_part, equipment, target, muscle_group) |
| `GET` | `/api/exercises/search?q=` | Tìm kiếm theo tên (case-insensitive substring) |
| `GET` | `/api/exercises/filters` | Lấy tất cả giá trị filter (body_parts, equipment_types, target_muscles, muscle_groups) |
| `GET` | `/api/exercises/{id}` | Chi tiết 1 bài tập (kèm instructions theo ngôn ngữ) |
| `POST` | `/api/recommend/weekly` | Gợi ý lịch tập tuần (input: goal, equipment, duration, days_per_week) |
| `POST` | `/api/schedules` | Lưu schedule mới |
| `GET` | `/api/schedules/{id}` | Lấy schedule theo ID |
| `PUT` | `/api/schedules/{id}` | Cập nhật schedule |
| `DELETE` | `/api/schedules/{id}` | Xóa schedule |
| `GET` | `/api/analytics/overview` | Tổng quan dataset: counts + distributions |
| `GET` | `/api/analytics/muscle-cooccurrence` | Top cặp cơ thường tập chung |
| `GET` | `/api/analytics/etl-history` | Lịch sử ETL runs (từ etl_runs.jsonl) |
| `GET` | `/api/exercises/{id}/alternatives` | Top 6 bài tập cùng target muscle, ưu tiên khác equipment |

### API Performance

- **In-memory TTL cache** (`_cached()` — 10 phút) cho `/api/exercises/filters` — static data chỉ thay đổi khi ETL chạy lại.
- **ETL Metrics**: Mỗi ETL run tự ghi metrics (records, duration, status) vào `docs/etl_runs.jsonl` qua module `de_pipeline/etl_metrics.py`.

### Lưu ý kỹ thuật quan trọng

1. **Route registration order**: Trong `main.py`, health check và tất cả `include_router()` **PHẢI** được đăng ký **TRƯỚC** mọi `app.mount()`. Lý do: `mount("/")` trong Starlette là terminal — nó chặn mọi request đến sau đó.

2. **Schedules table**: Bảng `schedules` KHÔNG có ORM model riêng — nó được tạo bằng raw SQL trong `_ensure_table(db)` (lazy, chạy per-request). KHÔNG được gọi `_ensure_table()` ở module-level (sẽ crash khi import vì chưa có DB connection).

3. **Static file mounts** có kiểm tra `if dir.exists()` để không crash trong CI khi thư mục media chưa có.

---

## 4. RECOMMENDATION ENGINE — Thuật toán gợi ý

### Ý tưởng
Engine gợi ý lịch tập theo phương pháp rule-based (không dùng ML). Dựa trên: mục tiêu tập (goal), thiết bị có sẵn (equipment), thời lượng (duration), và số ngày tập/tuần (days_per_week), engine sẽ tạo ra một WeeklyPlan tối ưu.

### Công nghệ
- **Pure Python** — không cần thư viện ML
- **SQLAlchemy ORM** — query candidates từ database

### Nội dung chi tiết (`backend/services/recommendation_engine.py`)

**Luồng xử lý:**
```
RecommendRequest
     │
     ▼
 [1] Chọn DAY_SPLIT theo days_per_week
     (VD: 3 ngày → [chest+arms, back+waist, legs+cardio])
     │
     ▼
 [2] Query candidate exercises (filter by equipment + body_parts)
     │
     ▼
 [3] Với mỗi ngày:
     ├── Score exercises theo goal → body_part priority
     ├── Ưu tiên muscle groups chưa tập hôm qua (recovery rule)
     ├── Đa dạng hóa: không lặp muscle group trong cùng ngày
     └── Chọn N exercises (N = DURATION_TO_EXERCISES[duration])
     │
     ▼
 [4] Trả về WeeklyPlan (days[], total_exercises, muscles_covered)
```

**Bảng mapping quan trọng:**

| Constant | Nội dung |
|---|---|
| `GOAL_BODY_PART_PRIORITY` | Mỗi goal → danh sách body parts ưu tiên (VD: build_muscle → chest, back, upper legs...) |
| `DURATION_TO_EXERCISES` | 30min→4, 45min→6, 60min→8, 90min→12 exercises |
| `LEVEL_TO_SETS` | beginner→2, intermediate→3, advanced→4 sets |
| `DAY_SPLITS` | 1-7 ngày → phân chia body parts theo ngày (VD: 3 ngày = Push/Pull/Legs) |

---

## 5. FRONTEND — SPA (Single Page Application)

### Ý tưởng
Giao diện web SPA phong cách **"Iron Plate / Powerlifting Meet"** — mạnh mẽ, năng lượng cao, cảm giác app thể thao chuyên nghiệp. Không dùng framework JS — 100% Vanilla HTML5/CSS/JS theo chuẩn Semantic HTML.

### Công nghệ
- **HTML5 Semantic** — `<article>`, `<section>`, `<nav>`, `<aside>`, `<figure>`, `<search>`, `<time>`, `<details>`, `<dialog>`...
- **Vanilla CSS** — Design tokens (`tokens.css`) + global styles (`main.css`)
- **Vanilla JavaScript (ES Modules)** — fetch API, DOM manipulation
- **Chart.js** — Biểu đồ trên trang Analytics
- **Google Fonts** — Barlow Condensed (headings) + Barlow (body)

### Design System — "Iron Plate"

| Token | Giá trị | Dùng cho |
|---|---|---|
| Background | `#111318` (iron-black) | Nền trang |
| Surface | `#1e2028` (steel plate) | Cards, panels |
| Accent | `#D32F2F` (steel red) | CTA, active nav, stat borders |
| Accent hover | `#EF5350` | Hover state |
| Gold | `#FFC107` | Achievement/highlight |
| Text primary | `#F5F5F5` | Headlines |
| Text secondary | `#B0B8C8` | Body copy |
| Font display | Barlow Condensed 800-900 | UPPERCASE headings |
| Font body | Barlow 400-500 | Normal text |
| Border radius | 3-8px max | Angular, not rounded |

### Nội dung chi tiết — Pages

| File | Trang | Chức năng |
|---|---|---|
| `frontend/index.html` | Exercise Library | Hero banner + search bar + filter sidebar + exercise grid (phân trang) + mini ❤️ fav button |
| `frontend/exercise.html` | Exercise Detail | GIF player + metadata strip + instructions + secondary muscles + ❤️ fav button + alternative exercises + related exercises |
| `frontend/recommend.html` | Smart Recommender | Wizard 3 bước: Goal → Equipment → Details → Generate Plan |
| `frontend/schedule.html` | My Schedule | Hiển thị lịch tập tuần, empty state, delete/regenerate |
| `frontend/analytics.html` | Analytics Dashboard | 4 stat cards + equipment bar chart (đỏ) + muscle bar chart (vàng) + body part doughnut + co-occurrence table + ETL history table |
| `frontend/favorites.html` | My Favourites | Grid view bài tập đã lưu, animated remove, empty state, clear all |

### Nội dung chi tiết — JavaScript Modules

| File | Vai trò |
|---|---|
| `frontend/js/app.js` | Core utilities: `$()`, `$$()`, `el()`, `api` (fetch wrapper), `buildExerciseCard()` (với mini ❤️), pagination builder, mobile hamburger menu toggle, scroll-to-top button, Rest Timer floating widget (30s/45s/60s/90s + Web Audio API beep) |
| `frontend/js/exercises.js` | Trang index: load filters, bind search/filter events, render exercise grid, Exercise of the Day (seeded rotation) |
| `frontend/js/exercise-detail.js` | Trang detail: load exercise by ID, render GIF + instructions + fav button + alternatives + personal notes (localStorage) + compare link |
| `frontend/js/recommend.js` | Wizard logic: step navigation, quick workout templates (PPL, Upper/Lower, Full Body, HIIT), equipment checkboxes, form submit → render results with target guidance banner & warmup tips, copy summary |
| `frontend/js/schedule.js` | Schedule controller: GET /api/schedules list dropdown selector, switch active plans, PUT rename schedule, delete schedule, today's workout highlight (🔥 Today), exercise completion checkboxes & session progress bar |
| `frontend/js/analytics.js` | Chart.js initialization + ETL history table rendering |
| `frontend/js/favorites.js` | Favorites module: localStorage CRUD, heart button builder, nav badge (auto-init), toast notifications (i18n-aware), cross-component events |
| `frontend/js/favorites-page.js` | Favorites page controller: parallel API fetch, animated card removal, clear-all |
| `frontend/js/i18n.js` | Internationalisation module: EN/VI dictionaries, `t()` translate function, `data-i18n` DOM translation, language switcher dropdown, localStorage persistence, `lang-changed` event |
| `frontend/js/calculator.js` | BMI/BMR/TDEE calculator: Mifflin-St Jeor equation, metric/imperial toggle, BMI gauge, calorie targets, personalized recommendations |
| `frontend/js/compare.js` | Exercise comparison page: dual search autocomplete, side-by-side render (GIF/meta/muscles/instructions), VS header, swap, URL param pre-load |

### Nội dung chi tiết — CSS

| File | Vai trò |
|---|---|
| `frontend/css/tokens.css` | Design tokens: colors, fonts, spacing, shadows, transitions — biến `--var` dùng toàn cục |
| `frontend/css/main.css` | Global styles: reset, layout, header, buttons, cards, tags, stat cards, hero, pagination, forms, skeleton, charts, step indicator, mobile hamburger menu, scroll-to-top button, mini favourite button overlay, nav badge, language switcher dropdown, Rest Timer widget, Exercise of the Day card, @media print schedule styles |

### Anti-patterns (CẤM trong design này)
- ❌ Không dùng teal, purple, hoặc generic blue CTA
- ❌ Không dùng pill buttons (border-radius > 5px)
- ❌ Không dùng glassmorphism/frosted panels
- ❌ Không dùng gradient backgrounds trên cards
- ❌ Không dùng Inter hoặc Outfit cho headings
- ❌ Không dùng bounce/elastic easing

---

## 6. INFRASTRUCTURE — Docker & CI/CD

### Ý tưởng
Containerize toàn bộ hệ thống bằng Docker Compose để chạy 1 lệnh `docker compose up`. CI/CD tự động kiểm tra FE, BE, Docker mỗi khi push lên GitHub.

### Công nghệ
- **Docker** + **Docker Compose** — container orchestration
- **GitHub Actions** — CI/CD pipeline
- **PostgreSQL 16 Alpine** — database container
- **Pytest** + **flake8** + **HTMLHint** — testing & linting

### Docker Compose Architecture

```
docker compose up
     │
     ├── [db]       PostgreSQL 16 Alpine
     │              Port: 5432
     │              Volume: postgres_data
     │              Healthcheck: pg_isready
     │
     ├── [etl]      de_pipeline container
     │              Depends: db (healthy)
     │              Restart: "no" (chạy 1 lần rồi exit)
     │              Mounts: ./data (read-only)
     │
     ├── [backend]  FastAPI + Uvicorn
     │              Depends: db (healthy) + etl (completed_successfully)
     │              Port: 8000
     │              Mounts: ./images, ./videos (read-only)
     │
     └── [jupyter]  JupyterLab (profile: dev only)
                    Depends: db (healthy)
                    Port: 8888
```

### File quan trọng

| File | Vai trò |
|---|---|
| `docker-compose.yml` | Orchestration: 4 services (db, etl, backend, jupyter) |
| `docker/init.sql` | DB init script: tạo pg_trgm + unaccent extensions |
| `.env.example` | Template biến môi trường (copy thành `.env`) |
| `backend/Dockerfile` | Backend image: Python 3.12-slim + backend + de_pipeline + frontend |
| `de_pipeline/Dockerfile` | ETL image: Python 3.12-slim + de_pipeline + data |

### GitHub Actions CI/CD (`.github/workflows/ci.yml`)

```
Push/PR → GitHub Actions
     │
     ├── [Job 1: frontend-check]
     │    ├── HTMLHint validation (all HTML files)
     │    ├── Node --check (JS syntax)
     │    └── CSS core files exist
     │
     ├── [Job 2: backend-ci]
     │    ├── flake8 syntax check (E9,F63,F7,F82)
     │    ├── flake8 style (warnings only)
     │    └── pytest tests/ --cov (coverage ≥ 50%)
     │
     └── [Job 3: docker-ci] (needs: Job 1 + Job 2)
          ├── docker compose config
          ├── Build DE Pipeline image
          ├── Build Backend image
          └── Integration test: DB + Backend + curl /api/health
```

### Test Suite (`tests/`)

| File | Nội dung |
|---|---|
| `tests/conftest.py` | SQLite in-memory DB + test data seed (3 exercises, 3 body parts, 2 equipment, 3 muscles, 3 instructions) + FastAPI TestClient with dependency override |
| `tests/test_backend_api.py` | 9 tests: health, list, get by ID, 404, filters, search, recommend, analytics, schedule CRUD |
| `tests/test_recommendation_engine.py` | 2 tests: basic plan generation, rest day assignment |

> **LƯU Ý**: Tests dùng SQLite in-memory (KHÔNG phải PostgreSQL). Do đó:
> - Column `steps` phải dùng `JSON` (không phải `JSONB`)
> - Schedules table tạo bằng `_ensure_table(db)` lazy (không phải top-level)
> - Fixture `conftest.py` override `get_db` dependency của FastAPI

---

## 7. DESIGN DOCUMENTS

| File | Mục đích |
|---|---|
| `DESIGN.md` | Design authority — ghi rõ visual world, color palette, typography, components, anti-patterns |
| `PRODUCT.md` | Product context cho Impeccable design tool |
| `AGENTS.md` | Quy tắc bắt buộc cho AI agents (Semantic HTML, a11y, CSS conventions) |
| `.htmlhintrc` | HTMLHint config: tag-pair, alt-require, id-unique, src-not-empty |

---

## Changelog (Lịch sử thay đổi quan trọng)

| Ngày | Thay đổi |
|---|---|
| 2026-07-24 | Tạo design system Iron Plate: `tokens.css`, `main.css`, `index.html` redesign |
| 2026-07-27 | Redesign 3 trang: `recommend.html`, `schedule.html`, `analytics.html` |
| 2026-07-28 | Thêm CI/CD pipeline (`.github/workflows/ci.yml`) + test suite (`tests/`) |
| 2026-07-29 | Fix: schedules.py top-level DB connection crash, exercise.html empty img src |
| 2026-07-30 | Fix: TargetMuscle ImportError → dùng Muscle, integer PKs trong conftest |
| 2026-07-31 | Fix: JSONB → JSON cho SQLite compatibility |
| 2026-08-01 | Fix: route registration order trong main.py (health check trước mount) |
| 2026-08-02 | Fix: ci.yml python-version typo, Docker integration test không cần ETL data |

---

> **Khi thêm tính năng mới, hãy cập nhật file này với phần mới và thêm entry vào Changelog.**
