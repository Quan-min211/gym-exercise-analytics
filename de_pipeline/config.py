import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Base paths
# ---------------------------------------------------------------------------

# Project root is two levels up from this file (de_pipeline/config.py)
BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
IMAGES_DIR = BASE_DIR / "images"
VIDEOS_DIR = BASE_DIR / "videos"

EXERCISES_JSON = DATA_DIR / "exercises.json"
EXERCISES_SCHEMA = DATA_DIR / "exercises.schema.json"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

_raw_url = os.getenv("DATABASE_URL")
if _raw_url:
    if _raw_url.startswith("postgres://"):
        DATABASE_URL = _raw_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif _raw_url.startswith("postgresql://") and not _raw_url.startswith("postgresql+psycopg2://"):
        DATABASE_URL = _raw_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    elif _raw_url.startswith("mysql://") and not _raw_url.startswith("mysql+pymysql://"):
        DATABASE_URL = _raw_url.replace("mysql://", "mysql+pymysql://", 1)
    else:
        DATABASE_URL = _raw_url
else:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "5432"))
    DB_NAME = os.getenv("DB_NAME", "fitdata")
    DB_USER = os.getenv("DB_USER", "fitdata")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "fitdata")
    DATABASE_URL = (
        f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )


# ---------------------------------------------------------------------------
# ETL settings
# ---------------------------------------------------------------------------

# Batch size for bulk inserts
BATCH_SIZE = 100

# Supported instruction languages (from schema)
SUPPORTED_LANGUAGES = ["en", "es", "it", "tr", "ru", "zh", "hi", "pl", "ko", "fr"]
