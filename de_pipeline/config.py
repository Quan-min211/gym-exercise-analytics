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
