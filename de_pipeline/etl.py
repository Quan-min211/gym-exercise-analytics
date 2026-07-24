"""
ETL Pipeline: exercises.json → PostgreSQL

Flow
----
  1. Extract  — Load and parse exercises.json
  2. Validate — Check schema compliance, detect anomalies
  3. Transform — Normalise strings, build lookup maps, resolve FKs
  4. Load     — Upsert data into PostgreSQL in batches

Run
---
    python -m de_pipeline.etl
    # or with explicit connection override:
    DB_HOST=localhost DB_PORT=5432 python -m de_pipeline.etl
"""

import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from de_pipeline.config import (
    BATCH_SIZE,
    DATABASE_URL,
    EXERCISES_JSON,
    SUPPORTED_LANGUAGES,
)
from de_pipeline.models import (
    Base,
    BodyPart,
    EquipmentType,
    Exercise,
    ExerciseMuscle,
    Instruction,
    Muscle,
)

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Step 1 — Extract
# ---------------------------------------------------------------------------


def extract(path: Path) -> list[dict]:
    """Load exercises.json and return the raw list of records."""
    log.info("Extracting data from: %s", path)
    if not path.exists():
        log.error("File not found: %s", path)
        sys.exit(1)

    with path.open(encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        log.error("Expected a JSON array at root level.")
        sys.exit(1)

    log.info("Extracted %d raw records.", len(data))
    return data


# ---------------------------------------------------------------------------
# Step 2 — Validate (lightweight, no external deps)
# ---------------------------------------------------------------------------

REQUIRED_FIELDS = {
    "id", "name", "category", "body_part", "equipment",
    "instructions", "instruction_steps", "muscle_group",
    "secondary_muscles", "target", "media_id", "image",
    "gif_url", "attribution", "created_at",
}


def validate(records: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Validate each record against basic rules.

    Returns
    -------
    valid   : records that passed all checks
    invalid : records that failed (with an added '_errors' key)
    """
    valid: list[dict] = []
    invalid: list[dict] = []
    seen_ids: set[str] = set()

    for i, rec in enumerate(records):
        errors: list[str] = []

        # Required fields present
        missing = REQUIRED_FIELDS - rec.keys()
        if missing:
            errors.append(f"Missing fields: {missing}")

        # ID format
        rec_id = rec.get("id", "")
        if not (isinstance(rec_id, str) and rec_id.isdigit() and len(rec_id) == 4):
            errors.append(f"Invalid id format: {rec_id!r}")

        # Duplicate IDs
        if rec_id in seen_ids:
            errors.append(f"Duplicate id: {rec_id}")
        else:
            seen_ids.add(rec_id)

        # Instructions completeness
        instructions = rec.get("instructions", {})
        steps = rec.get("instruction_steps", {})
        for lang in SUPPORTED_LANGUAGES:
            if lang not in instructions:
                errors.append(f"Missing instruction lang: {lang}")
            if lang not in steps:
                errors.append(f"Missing instruction_steps lang: {lang}")

        if errors:
            rec["_errors"] = errors
            invalid.append(rec)
        else:
            valid.append(rec)

    log.info(
        "Validation complete — valid: %d, invalid: %d",
        len(valid),
        len(invalid),
    )
    if invalid:
        for rec in invalid[:5]:  # show first 5 only
            log.warning("  id=%s errors=%s", rec.get("id"), rec.get("_errors"))
        if len(invalid) > 5:
            log.warning("  ... and %d more invalid records.", len(invalid) - 5)

    return valid, invalid


# ---------------------------------------------------------------------------
# Step 3 — Transform helpers
# ---------------------------------------------------------------------------


def get_or_create_lookup(
    session: Session,
    model_class,
    name: str,
    cache: dict[str, Any],
) -> Any:
    """
    Return the ORM instance for *name* from *cache*, inserting it if missing.
    Keeps one round-trip per unique value instead of one per exercise.
    """
    name = name.strip().lower()
    if name not in cache:
        instance = session.query(model_class).filter_by(name=name).first()
        if instance is None:
            instance = model_class(name=name)
            session.add(instance)
            session.flush()  # get the generated id
        cache[name] = instance
    return cache[name]


# ---------------------------------------------------------------------------
# Step 4 — Load
# ---------------------------------------------------------------------------


def load(session: Session, records: list[dict]) -> None:
    """Transform and upsert all valid records into the database."""

    # Lookup caches (name → ORM instance) — avoids repeated DB lookups
    body_part_cache: dict[str, BodyPart] = {}
    equipment_cache: dict[str, EquipmentType] = {}
    muscle_cache: dict[str, Muscle] = {}

    total = len(records)
    loaded = 0

    for batch_start in range(0, total, BATCH_SIZE):
        batch = records[batch_start : batch_start + BATCH_SIZE]

        for rec in batch:
            try:
                # --- Lookup rows ---
                bp = get_or_create_lookup(
                    session, BodyPart, rec["body_part"], body_part_cache
                )
                eq = get_or_create_lookup(
                    session, EquipmentType, rec["equipment"], equipment_cache
                )
                target_muscle = get_or_create_lookup(
                    session, Muscle, rec["target"], muscle_cache
                )

                # --- Upsert exercise ---
                exercise = session.get(Exercise, rec["id"])
                if exercise is None:
                    exercise = Exercise(id=rec["id"])
                    session.add(exercise)

                exercise.name = rec["name"].strip()
                exercise.category = rec["category"].strip().lower()
                exercise.body_part_ref = bp
                exercise.equipment_ref = eq
                exercise.muscle_group = rec["muscle_group"].strip().lower()
                exercise.target_muscle_ref = target_muscle
                exercise.media_id = rec["media_id"]
                exercise.image = rec["image"]
                exercise.gif_url = rec["gif_url"]
                exercise.attribution = rec["attribution"]
                exercise.created_at = datetime.fromisoformat(rec["created_at"])

                # Flush to ensure exercise.id is available for FKs
                session.flush()

                # --- Secondary muscles (M2M) ---
                # Remove existing links then re-add to handle updates cleanly
                for link in list(exercise.muscle_links):
                    session.delete(link)
                session.flush()

                # Primary target
                session.add(
                    ExerciseMuscle(
                        exercise_id=exercise.id,
                        muscle_id=target_muscle.id,
                        is_primary=True,
                    )
                )

                # Secondary muscles (may overlap with primary; deduped via unique constraint)
                for sec_name in rec.get("secondary_muscles", []):
                    sec_muscle = get_or_create_lookup(
                        session, Muscle, sec_name, muscle_cache
                    )
                    if sec_muscle.id != target_muscle.id:  # skip duplicate of primary
                        session.add(
                            ExerciseMuscle(
                                exercise_id=exercise.id,
                                muscle_id=sec_muscle.id,
                                is_primary=False,
                            )
                        )

                # --- Instructions (one row per language) ---
                for link in list(exercise.instructions):
                    session.delete(link)
                session.flush()

                for lang in SUPPORTED_LANGUAGES:
                    session.add(
                        Instruction(
                            exercise_id=exercise.id,
                            lang_code=lang,
                            full_text=rec["instructions"][lang],
                            steps=rec["instruction_steps"][lang],
                        )
                    )

                loaded += 1

            except Exception as exc:
                log.error("Failed to process record id=%s: %s", rec.get("id"), exc)
                raise

        # Commit each batch
        session.commit()
        log.info(
            "  Batch %d–%d committed (%d/%d total).",
            batch_start + 1,
            batch_start + len(batch),
            loaded,
            total,
        )

    log.info("Load complete — %d exercises inserted/updated.", loaded)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def run_etl() -> None:
    start = time.perf_counter()
    log.info("=" * 60)
    log.info("FitData Hub — ETL Pipeline")
    log.info("=" * 60)

    # Extract
    raw_records = extract(EXERCISES_JSON)

    # Validate
    valid_records, invalid_records = validate(raw_records)

    if not valid_records:
        log.error("No valid records to load. Aborting.")
        sys.exit(1)

    # Create DB engine and tables
    log.info("Connecting to database: %s", DATABASE_URL.split("@")[-1])
    engine = create_engine(DATABASE_URL, echo=False, future=True)

    log.info("Creating tables if they do not exist...")
    Base.metadata.create_all(engine)

    # Verify connection
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    log.info("Database connection OK.")

    # Load
    with Session(engine) as session:
        load(session, valid_records)

    elapsed = time.perf_counter() - start
    log.info("=" * 60)
    log.info("ETL finished in %.2f seconds.", elapsed)
    log.info("  Total records:   %d", len(raw_records))
    log.info("  Valid / loaded:  %d", len(valid_records))
    log.info("  Invalid skipped: %d", len(invalid_records))
    log.info("=" * 60)


if __name__ == "__main__":
    run_etl()
