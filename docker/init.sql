-- FitData Hub — Database initialization script
-- Runs automatically when the PostgreSQL container starts for the first time.
-- Creates the database and grants privileges.
-- Tables are created by SQLAlchemy (Base.metadata.create_all) in the ETL step.

-- (Database and user are created via POSTGRES_* env vars in docker-compose;
--  this file handles any additional one-time setup.)

-- Enable extensions useful for analytics
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- trigram index for fast LIKE searches
CREATE EXTENSION IF NOT EXISTS unaccent;  -- accent-insensitive search

-- Performance indexes (created after ETL loads data, but safe to run early)
-- Actual table-level indexes are defined in SQLAlchemy models.
