"""
Database session management for the FastAPI backend.

Uses SQLAlchemy 2.0 with a connection pool suitable for a single-node
PostgreSQL instance. The Session dependency is injected into route handlers
via FastAPI's dependency injection system.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

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
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "fitdata")
    DB_USER = os.getenv("DB_USER", "fitdata")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "fitdata")
    DATABASE_URL = (
        f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

connect_args = {}
if "mysql" in DATABASE_URL and ("tidb" in DATABASE_URL.lower() or "ssl" in DATABASE_URL.lower()):
    import ssl
    connect_args["ssl"] = ssl.create_default_context()

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,   # detect stale connections
    pool_size=10,
    max_overflow=20,
    echo=False,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    """FastAPI dependency — yields a DB session and ensures it is closed."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
