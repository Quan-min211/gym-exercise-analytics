"""
FitData Hub — FastAPI application entry point.

Serves:
  - REST API  at /api/...
  - Static media  at /images/ and /videos/ (exercise thumbnails & GIFs)
  - Frontend HTML/CSS/JS  at / (SPA)

Route registration order is critical: all API routes (include_router + bare
@app.get decorators) MUST be registered before any app.mount() call.
In Starlette, mount("/") is terminal — it intercepts every request that
reaches it, so API routes defined after the mount are unreachable.
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
# Health check — registered FIRST, before any mount()
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "FitData Hub API"}


# ---------------------------------------------------------------------------
# API routers — registered before static file mounts
# ---------------------------------------------------------------------------

app.include_router(exercises.router)
app.include_router(recommendations.router)
app.include_router(schedules.router)
app.include_router(analytics.router)

# ---------------------------------------------------------------------------
# Static file mounts — registered LAST
# Mount("/") is terminal: it intercepts all remaining requests.
# Everything above this point is safe from being shadowed.
# ---------------------------------------------------------------------------

# Exercise thumbnails (JPG)
_images_dir = PROJECT_ROOT / "images"
if _images_dir.exists():
    app.mount("/images", StaticFiles(directory=str(_images_dir)), name="images")

# Exercise animation GIFs
_videos_dir = PROJECT_ROOT / "videos"
if _videos_dir.exists():
    app.mount("/videos", StaticFiles(directory=str(_videos_dir)), name="videos")

# Frontend SPA — must be last
_frontend_dir = PROJECT_ROOT / "frontend"
if _frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
