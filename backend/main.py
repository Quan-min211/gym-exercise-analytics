"""
FitData Hub — FastAPI application entry point.

Serves:
  - REST API  at /api/...
  - Static media  at /images/ and /videos/ (exercise thumbnails & GIFs)
  - Frontend HTML/CSS/JS  at / (SPA)
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routers import analytics, exercises, recommendations, schedules

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent

app = FastAPI(
    title="FitData Hub API",
    description=(
        "REST API for the FitData Hub gym exercise platform. "
        "Provides exercise browsing, smart recommendations, schedule management, "
        "and dataset analytics."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS (allow all origins for local development; tighten for production)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# API routers
# ---------------------------------------------------------------------------

app.include_router(exercises.router)
app.include_router(recommendations.router)
app.include_router(schedules.router)
app.include_router(analytics.router)

# ---------------------------------------------------------------------------
# Static file mounts
# ---------------------------------------------------------------------------

# Exercise thumbnails (JPG)
app.mount("/images", StaticFiles(directory=str(PROJECT_ROOT / "images")), name="images")

# Exercise animation GIFs
app.mount("/videos", StaticFiles(directory=str(PROJECT_ROOT / "videos")), name="videos")

# Frontend SPA (served last so it doesn't shadow API routes)
app.mount("/", StaticFiles(directory=str(PROJECT_ROOT / "frontend"), html=True), name="frontend")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "FitData Hub API"}
