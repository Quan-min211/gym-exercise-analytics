<div align="center">

# 🏋️ FitData Hub

**A Full-Stack Gym Exercise Platform — Data Engineering × Analytics × Smart Recommendations**

[![CI/CD](https://github.com/Quan-min211/gym-exercise-analytics/actions/workflows/ci.yml/badge.svg)](https://github.com/Quan-min211/gym-exercise-analytics/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

<br>

*Browse 800+ gym exercises with animated GIF demonstrations, generate personalised weekly workout plans, manage training schedules, and explore rich dataset analytics — all in one platform.*

</div>

---

## 📸 Screenshots

<table>
  <tr>
    <td align="center"><strong>Exercise Library</strong><br><em>Search, filter by body part / equipment / muscle</em></td>
    <td align="center"><strong>Smart Recommender</strong><br><em>3-step wizard: Goal → Equipment → Details</em></td>
  </tr>
  <tr>
    <td align="center"><strong>Analytics Dashboard</strong><br><em>Chart.js: equipment popularity, muscle distribution, co-occurrence</em></td>
    <td align="center"><strong>Exercise Detail</strong><br><em>Animated GIF, metadata strip, step-by-step instructions</em></td>
  </tr>
</table>

---

## ✨ Features

| Feature | Description |
|---|---|
| **Exercise Library** | Browse 800+ exercises with animated GIF demos, filter by body part, equipment, target muscle, or search by name |
| **Smart Recommender** | Generate a personalised weekly workout plan based on your goal (Build Muscle, Lose Weight, Endurance, Flexibility, General Fitness), available equipment, session duration, and fitness level |
| **My Schedule** | Save generated plans as weekly schedules, view in calendar format, today auto-highlighted |
| **Analytics Dashboard** | Interactive Chart.js visualisations: equipment popularity bar chart, target muscle distribution, body part doughnut, muscle co-occurrence table |
| **Multi-language Instructions** | Exercise instructions available in 10 languages (EN, ES, IT, TR, RU, ZH, HI, PL, KO, FR) |
| **REST API** | Full OpenAPI/Swagger documentation at `/docs`, 12 endpoints covering exercises, recommendations, schedules, and analytics |
| **Data Quality Pipeline** | Automated checks for completeness, uniqueness, consistency, and referential integrity |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (SPA)                          │
│         Vanilla HTML5 / CSS / JS — Iron Plate Design        │
├─────────────────────────────────────────────────────────────┤
│                     BACKEND API                             │
│            FastAPI + Pydantic v2 + SQLAlchemy 2.0           │
├─────────────────────────────────────────────────────────────┤
│                  RECOMMENDATION ENGINE                      │
│         Rule-based: Goal → Body-Part Priority → Score       │
├─────────────────────────────────────────────────────────────┤
│                   DE PIPELINE (ETL)                         │
│     exercises.json → Validate → Normalize 3NF → PostgreSQL  │
├─────────────────────────────────────────────────────────────┤
│                     DATABASE                                │
│         PostgreSQL 16 — 6 tables, 3NF Normalized            │
├─────────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE                            │
│      Docker Compose (4 services) + GitHub Actions CI/CD     │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
gym-exercise-analytics/
├── backend/                    # FastAPI REST API
│   ├── main.py                 #   App entry point, CORS, route & mount registration
│   ├── database.py             #   SQLAlchemy engine + session dependency
│   ├── schemas.py              #   Pydantic request/response models
│   ├── routers/
│   │   ├── exercises.py        #   GET /api/exercises, /search, /filters, /{id}
│   │   ├── recommendations.py  #   POST /api/recommend/weekly
│   │   ├── schedules.py        #   CRUD /api/schedules
│   │   └── analytics.py        #   GET /api/analytics/overview, /muscle-cooccurrence
│   ├── services/
│   │   └── recommendation_engine.py  # Rule-based workout plan generator
│   ├── Dockerfile
│   └── requirements.txt
│
├── de_pipeline/                # Data Engineering ETL Pipeline
│   ├── etl.py                  #   Extract → Validate → Transform → Load
│   ├── models.py               #   SQLAlchemy ORM models (6 tables, 3NF)
│   ├── data_quality.py         #   Dataset quality checks & reports
│   ├── config.py               #   Paths, DB URL, batch settings
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                   # Vanilla SPA (no framework)
│   ├── index.html              #   Exercise Library (hero + grid + filters)
│   ├── exercise.html           #   Exercise Detail (GIF + instructions)
│   ├── recommend.html          #   Smart Recommender (3-step wizard)
│   ├── schedule.html           #   My Schedule (weekly calendar)
│   ├── analytics.html          #   Analytics Dashboard (charts + tables)
│   ├── css/
│   │   ├── tokens.css          #   Design tokens (colors, fonts, spacing)
│   │   └── main.css            #   Global component styles
│   └── js/
│       ├── app.js              #   Core utilities, API wrapper, card builder
│       ├── exercises.js        #   Exercise list page logic
│       ├── exercise-detail.js  #   Detail page logic
│       ├── recommend.js        #   Recommender wizard logic
│       ├── schedule.js         #   Schedule page logic
│       └── analytics.js        #   Chart.js dashboard logic
│
├── data/                       # Raw dataset
│   ├── exercises.json          #   800+ exercises (17MB)
│   └── exercises.schema.json   #   JSON Schema validation
│
├── docker/
│   └── init.sql                # PostgreSQL init (pg_trgm, unaccent)
│
├── tests/                      # Automated test suite
│   ├── conftest.py             #   SQLite in-memory fixtures + TestClient
│   ├── test_backend_api.py     #   9 API endpoint tests
│   └── test_recommendation_engine.py  # 2 engine logic tests
│
├── .github/workflows/ci.yml   # GitHub Actions CI/CD (3 jobs)
├── docker-compose.yml          # 4 services: db, etl, backend, jupyter
├── .env.example                # Environment variables template
├── AGENTS.md                   # AI agent coding rules
├── DESIGN.md                   # Iron Plate design system reference
├── PRODUCT.md                  # Product context
└── docs/
    └── SYSTEM_CONTEXT.md       # Full system architecture documentation
```

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/Quan-min211/gym-exercise-analytics.git
cd gym-exercise-analytics

# 2. Configure environment
cp .env.example .env

# 3. Launch all services
docker compose up -d

# 4. Open in browser
#    Web App:  http://localhost:8000
#    API Docs: http://localhost:8000/docs
```

> **What happens**: PostgreSQL starts → ETL seeds 800+ exercises into the database → Backend API starts serving the frontend and API.

### Option 2: Manual Setup

**Prerequisites**: Python 3.12+, PostgreSQL 16+

```bash
# 1. Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate         # Windows

# 2. Install dependencies
pip install -r de_pipeline/requirements.txt
pip install -r backend/requirements.txt

# 3. Configure database
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# 4. Run ETL pipeline (seeds the database)
python -m de_pipeline.etl

# 5. (Optional) Run data quality checks
python -m de_pipeline.data_quality

# 6. Start the API server
uvicorn backend.main:app --reload
# → http://localhost:8000
```

### Option 3: Development with JupyterLab

```bash
docker compose --profile dev up -d
# → JupyterLab: http://localhost:8888
```

---

## 📡 API Reference

All endpoints are documented via OpenAPI at [`/docs`](http://localhost:8000/docs) when the server is running.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/exercises` | List exercises (paginated, filterable) |
| `GET` | `/api/exercises/search?q=` | Full-text search by name |
| `GET` | `/api/exercises/filters` | Available filter values |
| `GET` | `/api/exercises/{id}` | Exercise detail with instructions |
| `POST` | `/api/recommend/weekly` | Generate weekly workout plan |
| `POST` | `/api/schedules` | Create schedule |
| `GET` | `/api/schedules/{id}` | Get schedule by ID |
| `PUT` | `/api/schedules/{id}` | Update schedule |
| `DELETE` | `/api/schedules/{id}` | Delete schedule |
| `GET` | `/api/analytics/overview` | Dataset statistics & distributions |
| `GET` | `/api/analytics/muscle-cooccurrence` | Muscle pair frequency |

<details>
<summary><strong>Example: Generate a Workout Plan</strong></summary>

```bash
curl -X POST http://localhost:8000/api/recommend/weekly \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "build_muscle",
    "fitness_level": "intermediate",
    "available_equipment": ["body weight", "dumbbell", "barbell"],
    "days_per_week": 4,
    "session_duration": 60
  }'
```

</details>

---

## 🧪 Testing & CI/CD

### Run Tests Locally

```bash
# Install test dependencies
pip install pytest pytest-cov httpx flake8

# Run tests with coverage
PYTHONPATH=. pytest tests/ -v --cov=backend --cov=de_pipeline --cov-report=term-missing
```

### GitHub Actions Pipeline

Every push triggers a 3-job CI/CD pipeline:

```
┌──────────────────────┐     ┌──────────────────────┐
│  Job 1: Frontend     │     │  Job 2: Backend      │
│  ├─ HTMLHint         │     │  ├─ flake8 lint      │
│  ├─ JS syntax check  │     │  └─ pytest + coverage│
│  └─ CSS verification │     │                      │
└──────────┬───────────┘     └──────────┬───────────┘
           │                            │
           └──────────┬─────────────────┘
                      ▼
           ┌──────────────────────┐
           │  Job 3: Docker       │
           │  ├─ Compose config   │
           │  ├─ Build images     │
           │  └─ Integration test │
           └──────────────────────┘
```

---

## 🗄️ Database Schema

6 tables in **Third Normal Form (3NF)**:

```
body_parts ─────┐
                 │     exercises ──── exercise_muscles ──── muscles
equipment_types ─┤         │                                  │
                 │         └── instructions              (target_muscle FK)
    muscles ─────┘
```

| Table | Description | PK Type |
|---|---|---|
| `body_parts` | 10 body regions (chest, back, waist...) | `int` |
| `muscles` | All muscle names (pectorals, lats, quads...) | `int` |
| `equipment_types` | Equipment (body weight, dumbbell, barbell...) | `int` |
| `exercises` | 800+ exercise records with FK references | `str(4)` |
| `exercise_muscles` | M2M junction with `is_primary` flag | `int` |
| `instructions` | Multi-language text + step arrays (JSON) | `int` |

---

## 🎨 Design System — "Iron Plate"

The frontend uses a custom design direction called **Iron Plate / Powerlifting Meet**:

| Element | Value |
|---|---|
| **Background** | `#111318` — iron-black |
| **Accent** | `#D32F2F` — steel red |
| **Gold** | `#FFC107` — achievement highlights |
| **Headings** | Barlow Condensed, 800-900 weight, UPPERCASE |
| **Body** | Barlow, 400-500 weight |
| **Border Radius** | 3-8px max (angular, not rounded) |

> See [`DESIGN.md`](DESIGN.md) for the full design system specification.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5 (Semantic), Vanilla CSS, Vanilla JS (ES Modules), Chart.js |
| **Backend** | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, Uvicorn |
| **Database** | PostgreSQL 16 with pg_trgm and unaccent extensions |
| **ETL** | Python, SQLAlchemy ORM, custom data quality framework |
| **Testing** | Pytest, pytest-cov, flake8, HTMLHint |
| **Infrastructure** | Docker, Docker Compose, GitHub Actions CI/CD |
| **Fonts** | Google Fonts (Barlow, Barlow Condensed, JetBrains Mono) |

---

## 📖 Documentation

| Document | Purpose |
|---|---|
| [`docs/SYSTEM_CONTEXT.md`](docs/SYSTEM_CONTEXT.md) | **Complete system architecture** — ideas, tech, content for every layer |
| [`DESIGN.md`](DESIGN.md) | Iron Plate design system — colors, typography, components, anti-patterns |
| [`PRODUCT.md`](PRODUCT.md) | Product context for design tooling |
| [`AGENTS.md`](AGENTS.md) | Mandatory AI coding rules (Semantic HTML, a11y, CSS conventions) |
| [`/docs`](http://localhost:8000/docs) | Interactive API documentation (Swagger UI) |
| [`/redoc`](http://localhost:8000/redoc) | Alternative API documentation (ReDoc) |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Read [`docs/SYSTEM_CONTEXT.md`](docs/SYSTEM_CONTEXT.md) to understand the architecture
4. Follow the rules in [`AGENTS.md`](AGENTS.md) (Semantic HTML, a11y, design system)
5. Run tests (`pytest tests/ -v`)
6. Commit with conventional commits (`feat:`, `fix:`, `docs:`, `ci:`)
7. Push and open a Pull Request

---

## 📝 License

This project is built for educational purposes as a **Data Engineering & Analytics** learning project at HCMUTE.

Exercise data sourced from [GymVisual](https://gymvisual.com/) — © GymVisual.

---

<div align="center">

**Built with ❤️ for the gym community**

[Report Bug](https://github.com/Quan-min211/gym-exercise-analytics/issues) · [Request Feature](https://github.com/Quan-min211/gym-exercise-analytics/issues)

</div>
