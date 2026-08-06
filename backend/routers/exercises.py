"""
Exercise router — browse, search, and filter the exercise library.

Endpoints
---------
GET  /api/exercises              paginated list with optional filters
GET  /api/exercises/filters      available filter values
GET  /api/exercises/search       full-text search by name
GET  /api/exercises/{id}         single exercise detail
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from backend.database import get_db
from backend.schemas import (
    ExerciseDetail,
    ExerciseListResponse,
    ExerciseSummary,
    FilterOptions,
    InstructionOut,
)

# Re-use the ORM models from the DE pipeline package
from de_pipeline.models import (
    BodyPart,
    EquipmentType,
    Exercise,
    ExerciseMuscle,
    Instruction,
    Muscle,
)

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


# ---------------------------------------------------------------------------
# Helper: map ORM Exercise → ExerciseSummary dict
# ---------------------------------------------------------------------------

def _exercise_to_summary(ex: Exercise) -> dict:
    return {
        "id": ex.id,
        "name": ex.name,
        "category": ex.category,
        "body_part_name": ex.body_part_ref.name if ex.body_part_ref else "",
        "equipment_name": ex.equipment_ref.name if ex.equipment_ref else "",
        "target_muscle_name": ex.target_muscle_ref.name if ex.target_muscle_ref else "",
        "muscle_group": ex.muscle_group,
        "image": ex.image,
        "gif_url": ex.gif_url,
    }


# ---------------------------------------------------------------------------
# GET /api/exercises/filters
# ---------------------------------------------------------------------------

@router.get("/filters", response_model=FilterOptions)
def get_filters(db: Session = Depends(get_db)):
    """Return all distinct filter values for the UI filter panel."""
    body_parts = [r.name for r in db.query(BodyPart).order_by(BodyPart.name).all()]
    equipment = [r.name for r in db.query(EquipmentType).order_by(EquipmentType.name).all()]
    muscles = [r.name for r in db.query(Muscle).order_by(Muscle.name).all()]
    muscle_groups = [
        r[0]
        for r in db.query(Exercise.muscle_group)
        .distinct()
        .order_by(Exercise.muscle_group)
        .all()
    ]
    return FilterOptions(
        body_parts=body_parts,
        equipment_types=equipment,
        target_muscles=muscles,
        muscle_groups=muscle_groups,
    )


# ---------------------------------------------------------------------------
# GET /api/exercises/search
# ---------------------------------------------------------------------------

@router.get("/search", response_model=ExerciseListResponse)
def search_exercises(
    q: str = Query(..., min_length=1, description="Search term"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Case-insensitive substring search on exercise name."""
    term = f"%{q.lower()}%"
    query = (
        db.query(Exercise)
        .options(
            joinedload(Exercise.body_part_ref),
            joinedload(Exercise.equipment_ref),
            joinedload(Exercise.target_muscle_ref),
        )
        .filter(func.lower(Exercise.name).like(term))
        .order_by(Exercise.name)
    )
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return ExerciseListResponse(
        items=[ExerciseSummary(**_exercise_to_summary(ex)) for ex in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


# ---------------------------------------------------------------------------
# GET /api/exercises
# ---------------------------------------------------------------------------

@router.get("", response_model=ExerciseListResponse)
def list_exercises(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    body_part: str | None = Query(None),
    equipment: str | None = Query(None),
    target: str | None = Query(None),
    muscle_group: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """
    Paginated exercise list with optional filters.
    All filter values are case-insensitive exact matches against the
    normalised (lowercase) lookup table names.
    """
    query = (
        db.query(Exercise)
        .options(
            joinedload(Exercise.body_part_ref),
            joinedload(Exercise.equipment_ref),
            joinedload(Exercise.target_muscle_ref),
        )
    )

    if body_part:
        query = query.join(Exercise.body_part_ref).filter(
            func.lower(BodyPart.name) == body_part.lower()
        )
    if equipment:
        query = query.join(Exercise.equipment_ref).filter(
            func.lower(EquipmentType.name) == equipment.lower()
        )
    if target:
        query = query.join(Exercise.target_muscle_ref).filter(
            func.lower(Muscle.name) == target.lower()
        )
    if muscle_group:
        query = query.filter(
            func.lower(Exercise.muscle_group) == muscle_group.lower()
        )

    query = query.order_by(Exercise.name)
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return ExerciseListResponse(
        items=[ExerciseSummary(**_exercise_to_summary(ex)) for ex in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


# ---------------------------------------------------------------------------
# GET /api/exercises/{id}
# ---------------------------------------------------------------------------

@router.get("/{exercise_id}", response_model=ExerciseDetail)
def get_exercise(
    exercise_id: str,
    lang: str = Query("en", description="Instruction language code (e.g. en, es, fr)"),
    db: Session = Depends(get_db),
):
    """Full exercise detail including instructions in the requested language."""
    ex = (
        db.query(Exercise)
        .options(
            joinedload(Exercise.body_part_ref),
            joinedload(Exercise.equipment_ref),
            joinedload(Exercise.target_muscle_ref),
            joinedload(Exercise.muscle_links).joinedload(ExerciseMuscle.muscle),
            joinedload(Exercise.instructions),
        )
        .filter(Exercise.id == exercise_id)
        .first()
    )

    if not ex:
        raise HTTPException(status_code=404, detail=f"Exercise '{exercise_id}' not found.")

    # Secondary muscle names
    secondary_muscles = [
        link.muscle.name
        for link in ex.muscle_links
        if not link.is_primary
    ]

    # Instruction for requested language (fall back to English)
    instruction_row = next(
        (i for i in ex.instructions if i.lang_code == lang),
        next((i for i in ex.instructions if i.lang_code == "en"), None),
    )
    instruction_out = (
        InstructionOut(
            lang_code=instruction_row.lang_code,
            full_text=instruction_row.full_text,
            steps=instruction_row.steps,
        )
        if instruction_row
        else None
    )

    return ExerciseDetail(
        id=ex.id,
        name=ex.name,
        category=ex.category,
        body_part=ex.body_part_ref.name if ex.body_part_ref else "",
        equipment=ex.equipment_ref.name if ex.equipment_ref else "",
        target=ex.target_muscle_ref.name if ex.target_muscle_ref else "",
        muscle_group=ex.muscle_group,
        secondary_muscles=secondary_muscles,
        image=ex.image,
        gif_url=ex.gif_url,
        attribution=ex.attribution,
        created_at=ex.created_at,
        instructions=instruction_out,
    )


# ---------------------------------------------------------------------------
# GET /api/exercises/{id}/alternatives
# ---------------------------------------------------------------------------

@router.get("/{exercise_id}/alternatives", response_model=list[ExerciseSummary])
def get_alternatives(
    exercise_id: str,
    limit: int = Query(default=6, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """
    Return up to *limit* alternative exercises that target the same primary muscle.

    Ordering priority:
      1. Exercises with a **different** equipment type (useful substitutions).
      2. Exercises with the same body part (closest movement pattern).
      3. Alphabetical by name (deterministic fallback).
    """
    source = (
        db.query(Exercise)
        .options(
            joinedload(Exercise.body_part_ref),
            joinedload(Exercise.equipment_ref),
            joinedload(Exercise.target_muscle_ref),
        )
        .filter(Exercise.id == exercise_id)
        .first()
    )
    if not source:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Exercise '{exercise_id}' not found.")

    query = (
        db.query(Exercise)
        .options(
            joinedload(Exercise.body_part_ref),
            joinedload(Exercise.equipment_ref),
            joinedload(Exercise.target_muscle_ref),
        )
        .filter(Exercise.target_muscle_id == source.target_muscle_id)
        .filter(Exercise.id != exercise_id)
        # Prefer different equipment (True sorts after False in SQL, so negate)
        .order_by(
            (Exercise.equipment_id == source.equipment_id),   # 0 = different equipment first
            (Exercise.body_part_id != source.body_part_id),   # 0 = same body part first
            Exercise.name,
        )
        .limit(limit)
    )

    return [ExerciseSummary(**_exercise_to_summary(ex)) for ex in query.all()]

