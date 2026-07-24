"""
Schedules router — create and retrieve custom workout schedules.

Schedules are stored as JSON in a simple schedules table (managed here
without a dedicated ORM model for simplicity; raw SQL via SQLAlchemy core).

For a production system this would use a proper ORM model with user FK;
for this project we use a UUID-keyed JSON blob in PostgreSQL.
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Column, DateTime, String, Text, text
from sqlalchemy.orm import Session

from backend.database import get_db, engine
from backend.schemas import ScheduleCreate, ScheduleOut

router = APIRouter(prefix="/api/schedules", tags=["schedules"])

# ---------------------------------------------------------------------------
# Ensure schedules table exists (created lazily on first request)
# ---------------------------------------------------------------------------

_SCHEDULES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS schedules (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    schedule_type TEXT NOT NULL DEFAULT 'weekly',
    days_json   TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

def _ensure_table() -> None:
    with engine.connect() as conn:
        conn.execute(text(_SCHEDULES_TABLE_SQL))
        conn.commit()

_ensure_table()


# ---------------------------------------------------------------------------
# Helper: row → ScheduleOut
# ---------------------------------------------------------------------------

def _row_to_out(row) -> ScheduleOut:
    return ScheduleOut(
        id=row.id,
        name=row.name,
        schedule_type=row.schedule_type,
        days=json.loads(row.days_json),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=ScheduleOut, status_code=201)
def create_schedule(payload: ScheduleCreate, db: Session = Depends(get_db)):
    """Persist a new custom workout schedule."""
    schedule_id = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc)
    days_json = json.dumps([d.model_dump() for d in payload.days])

    db.execute(
        text(
            "INSERT INTO schedules (id, name, schedule_type, days_json, created_at, updated_at) "
            "VALUES (:id, :name, :type, :days, :created, :updated)"
        ),
        {
            "id": schedule_id,
            "name": payload.name,
            "type": payload.schedule_type,
            "days": days_json,
            "created": now,
            "updated": now,
        },
    )
    db.commit()

    row = db.execute(
        text("SELECT * FROM schedules WHERE id = :id"), {"id": schedule_id}
    ).fetchone()
    return _row_to_out(row)


@router.get("/{schedule_id}", response_model=ScheduleOut)
def get_schedule(schedule_id: str, db: Session = Depends(get_db)):
    """Retrieve a schedule by ID."""
    row = db.execute(
        text("SELECT * FROM schedules WHERE id = :id"), {"id": schedule_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return _row_to_out(row)


@router.put("/{schedule_id}", response_model=ScheduleOut)
def update_schedule(
    schedule_id: str, payload: ScheduleCreate, db: Session = Depends(get_db)
):
    """Update an existing schedule."""
    existing = db.execute(
        text("SELECT id FROM schedules WHERE id = :id"), {"id": schedule_id}
    ).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Schedule not found.")

    now = datetime.now(tz=timezone.utc)
    days_json = json.dumps([d.model_dump() for d in payload.days])

    db.execute(
        text(
            "UPDATE schedules SET name=:name, schedule_type=:type, "
            "days_json=:days, updated_at=:updated WHERE id=:id"
        ),
        {
            "name": payload.name,
            "type": payload.schedule_type,
            "days": days_json,
            "updated": now,
            "id": schedule_id,
        },
    )
    db.commit()

    row = db.execute(
        text("SELECT * FROM schedules WHERE id = :id"), {"id": schedule_id}
    ).fetchone()
    return _row_to_out(row)


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(schedule_id: str, db: Session = Depends(get_db)):
    """Delete a schedule."""
    result = db.execute(
        text("DELETE FROM schedules WHERE id = :id"), {"id": schedule_id}
    )
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Schedule not found.")
