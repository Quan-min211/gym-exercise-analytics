"""Analytics router — pre-computed dataset statistics for the DA dashboard."""

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas import DatasetOverview, DistributionItem, MuscleCoOccurrence
from de_pipeline.models import BodyPart, EquipmentType, Exercise, ExerciseMuscle, Muscle

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _make_distribution(rows: list[tuple], total: int) -> list[DistributionItem]:
    return [
        DistributionItem(
            label=label,
            count=count,
            percentage=round(count / total * 100, 2) if total else 0.0,
        )
        for label, count in rows
    ]


@router.get("/overview", response_model=DatasetOverview)
def get_overview(db: Session = Depends(get_db)):
    """Return dataset-wide counts and distribution breakdowns."""
    total = db.query(func.count(Exercise.id)).scalar() or 0

    by_body_part = (
        db.query(BodyPart.name, func.count(Exercise.id))
        .join(Exercise.body_part_ref)
        .group_by(BodyPart.name)
        .order_by(func.count(Exercise.id).desc())
        .all()
    )

    by_equipment = (
        db.query(EquipmentType.name, func.count(Exercise.id))
        .join(Exercise.equipment_ref)
        .group_by(EquipmentType.name)
        .order_by(func.count(Exercise.id).desc())
        .limit(20)
        .all()
    )

    by_target = (
        db.query(Muscle.name, func.count(Exercise.id))
        .join(Exercise.target_muscle_ref)
        .group_by(Muscle.name)
        .order_by(func.count(Exercise.id).desc())
        .limit(20)
        .all()
    )

    return DatasetOverview(
        total_exercises=total,
        total_body_parts=db.query(func.count(BodyPart.id)).scalar() or 0,
        total_equipment_types=db.query(func.count(EquipmentType.id)).scalar() or 0,
        total_target_muscles=db.query(func.count(Muscle.id)).scalar() or 0,
        by_body_part=_make_distribution(by_body_part, total),
        by_equipment=_make_distribution(by_equipment, total),
        by_target_muscle=_make_distribution(by_target, total),
    )


@router.get("/muscle-cooccurrence", response_model=list[MuscleCoOccurrence])
def get_muscle_cooccurrence(
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """
    Return muscle pairs that appear together (primary + secondary)
    across exercises, ordered by frequency.
    Used for the heatmap chart on the analytics dashboard.
    """
    # Self-join exercise_muscles to find co-occurring muscles
    em1 = ExerciseMuscle.__table__.alias("em1")
    em2 = ExerciseMuscle.__table__.alias("em2")
    m1 = Muscle.__table__.alias("m1")
    m2 = Muscle.__table__.alias("m2")

    from sqlalchemy import select, join as sqla_join

    stmt = (
        select(
            m1.c.name.label("muscle_a"),
            m2.c.name.label("muscle_b"),
            func.count().label("co_occurrence_count"),
        )
        .select_from(
            sqla_join(em1, em2, em1.c.exercise_id == em2.c.exercise_id)
            .join(m1, em1.c.muscle_id == m1.c.id)
            .join(m2, em2.c.muscle_id == m2.c.id)
        )
        .where(m1.c.name < m2.c.name)  # avoid duplicates (a,b) and (b,a)
        .group_by(m1.c.name, m2.c.name)
        .order_by(func.count().desc())
        .limit(limit)
    )

    rows = db.execute(stmt).fetchall()
    return [
        MuscleCoOccurrence(
            muscle_a=r.muscle_a,
            muscle_b=r.muscle_b,
            co_occurrence_count=r.co_occurrence_count,
        )
        for r in rows
    ]
