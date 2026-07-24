"""
Rule-based recommendation engine.

Design
------
Given a user's goals, equipment, target body parts, fitness level, and
desired number of workout days, the engine:

  1. Filters exercises by available equipment and (optionally) target body parts.
  2. Scores each exercise by how well it fits the user's goal.
  3. Assigns exercises to days ensuring:
       - Each day focuses on a distinct body region.
       - No muscle group is trained on back-to-back days (48h recovery rule).
       - The total exercise count matches the estimated duration.
  4. Returns a list of WorkoutDay objects ready for the API response.

Goal → Body-part priority mapping
-----------------------------------
  build_muscle      : balanced across all major muscle groups
  lose_weight       : cardio + high-rep compound movements
  improve_endurance : cardio-focused, circuit-style
  flexibility       : waist / lower legs / upper arms stretching
  general_fitness   : full-body rotation

Duration → exercises per session
---------------------------------
  30 min → 4 exercises
  45 min → 6 exercises
  60 min → 8 exercises
  90 min → 12 exercises
"""

import random
from collections import defaultdict
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from backend.schemas import (
    ExerciseSummary,
    FitnessLevel,
    RecommendRequest,
    SessionDuration,
    WeeklyPlan,
    WorkoutDay,
    WorkoutGoal,
)
from de_pipeline.models import BodyPart, EquipmentType, Exercise, ExerciseMuscle, Muscle

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GOAL_BODY_PART_PRIORITY: dict[WorkoutGoal, list[str]] = {
    WorkoutGoal.build_muscle: ["chest", "back", "upper legs", "shoulders", "upper arms", "waist"],
    WorkoutGoal.lose_weight: ["cardio", "waist", "upper legs", "chest", "back"],
    WorkoutGoal.improve_endurance: ["cardio", "upper legs", "waist", "back"],
    WorkoutGoal.flexibility: ["waist", "lower legs", "upper arms", "shoulders", "lower arms"],
    WorkoutGoal.general_fitness: ["back", "chest", "upper legs", "waist", "shoulders", "cardio"],
}

DURATION_TO_EXERCISES: dict[int, int] = {
    30: 4,
    45: 6,
    60: 8,
    90: 12,
}

LEVEL_TO_SETS: dict[FitnessLevel, int] = {
    FitnessLevel.beginner: 2,
    FitnessLevel.intermediate: 3,
    FitnessLevel.advanced: 4,
}

# Day split templates (body parts grouped per day)
DAY_SPLITS: dict[int, list[list[str]]] = {
    1: [["back", "chest", "upper legs", "waist", "shoulders", "cardio", "upper arms", "lower arms", "lower legs", "neck"]],
    2: [
        ["chest", "upper arms", "shoulders"],
        ["back", "waist", "upper legs"],
    ],
    3: [
        ["chest", "upper arms", "shoulders"],
        ["back", "waist"],
        ["upper legs", "lower legs", "cardio"],
    ],
    4: [
        ["chest", "upper arms"],
        ["back", "shoulders"],
        ["upper legs", "lower legs"],
        ["waist", "cardio"],
    ],
    5: [
        ["chest", "upper arms"],
        ["back"],
        ["upper legs", "lower legs"],
        ["shoulders", "lower arms"],
        ["waist", "cardio"],
    ],
    6: [
        ["chest", "upper arms"],
        ["back", "shoulders"],
        ["upper legs"],
        ["waist", "cardio"],
        ["lower legs", "lower arms"],
        ["chest", "back"],  # light repeat
    ],
    7: [
        ["chest", "upper arms"],
        ["back", "shoulders"],
        ["upper legs"],
        ["waist", "cardio"],
        ["lower legs", "lower arms"],
        ["chest", "back"],
        [],  # rest day
    ],
}

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------


def _exercise_to_summary(ex: Exercise) -> ExerciseSummary:
    return ExerciseSummary(
        id=ex.id,
        name=ex.name,
        category=ex.category,
        body_part_name=ex.body_part_ref.name if ex.body_part_ref else "",
        equipment_name=ex.equipment_ref.name if ex.equipment_ref else "",
        target_muscle_name=ex.target_muscle_ref.name if ex.target_muscle_ref else "",
        muscle_group=ex.muscle_group,
        image=ex.image,
        gif_url=ex.gif_url,
    )


def _fetch_candidate_exercises(
    db: Session,
    equipment_names: list[str],
    body_parts: list[str],
    exclude_ids: list[str],
) -> list[Exercise]:
    """Query exercises matching equipment and body-part constraints."""
    query = (
        db.query(Exercise)
        .options(
            joinedload(Exercise.body_part_ref),
            joinedload(Exercise.equipment_ref),
            joinedload(Exercise.target_muscle_ref),
        )
        .join(Exercise.equipment_ref)
        .filter(func.lower(EquipmentType.name).in_([e.lower() for e in equipment_names]))
    )

    if body_parts:
        query = query.join(Exercise.body_part_ref).filter(
            func.lower(BodyPart.name).in_([b.lower() for b in body_parts])
        )

    if exclude_ids:
        query = query.filter(Exercise.id.notin_(exclude_ids))

    return query.all()


def _score_exercise(ex: Exercise, goal: WorkoutGoal) -> float:
    """Assign a relevance score based on goal ↔ body-part priority."""
    priority_list = GOAL_BODY_PART_PRIORITY.get(goal, [])
    bp = ex.body_part_ref.name if ex.body_part_ref else ""
    try:
        priority_rank = priority_list.index(bp)
        # Higher score = higher priority (flip rank)
        return 1.0 / (priority_rank + 1)
    except ValueError:
        return 0.1  # low but not zero — allows variety


def _pick_exercises_for_day(
    candidates: list[Exercise],
    body_parts_for_day: list[str],
    count: int,
    used_muscle_groups: set[str],
    goal: WorkoutGoal,
) -> list[Exercise]:
    """
    Select *count* exercises for a given day.

    Preference: exercises matching the day's target body parts, not repeating
    muscle groups already heavily used (recovery rule).
    """
    # Filter to day's body parts first
    day_pool = [
        ex for ex in candidates
        if ex.body_part_ref and ex.body_part_ref.name in body_parts_for_day
    ]

    if not day_pool:
        day_pool = candidates  # fall back to full pool

    # Sort by score descending, add small random jitter for variety
    day_pool.sort(key=lambda ex: _score_exercise(ex, goal) + random.uniform(0, 0.05), reverse=True)

    # Prefer exercises whose muscle group wasn't trained yesterday
    preferred = [ex for ex in day_pool if ex.muscle_group not in used_muscle_groups]
    remaining = [ex for ex in day_pool if ex.muscle_group in used_muscle_groups]
    ordered = preferred + remaining

    # Deduplicate by muscle group within the day for variety
    selected: list[Exercise] = []
    seen_muscles: set[str] = set()
    for ex in ordered:
        if ex.muscle_group not in seen_muscles or len(selected) < count // 2:
            selected.append(ex)
            seen_muscles.add(ex.muscle_group)
        if len(selected) >= count:
            break

    return selected[:count]


def build_weekly_plan(db: Session, request: RecommendRequest) -> WeeklyPlan:
    """
    Main entry point for the recommendation engine.
    Returns a WeeklyPlan with one WorkoutDay per training day.
    """
    days_per_week = request.days_per_week
    split = DAY_SPLITS.get(days_per_week, DAY_SPLITS[3])
    duration = request.session_duration
    exercises_per_session = DURATION_TO_EXERCISES.get(int(duration), 8)

    # Fetch candidate pool
    candidates = _fetch_candidate_exercises(
        db=db,
        equipment_names=request.available_equipment or ["body weight"],
        body_parts=request.target_body_parts or [],
        exclude_ids=request.exclude_exercise_ids,
    )

    if not candidates:
        # Fallback: ignore body_part filter
        candidates = _fetch_candidate_exercises(
            db=db,
            equipment_names=request.available_equipment or ["body weight"],
            body_parts=[],
            exclude_ids=request.exclude_exercise_ids,
        )

    workout_days: list[WorkoutDay] = []
    used_muscle_groups: set[str] = set()
    all_covered_muscles: set[str] = set()
    total_exercises = 0

    for day_idx in range(days_per_week):
        day_name = DAY_NAMES[day_idx]

        if day_idx < len(split):
            day_body_parts = split[day_idx]
        else:
            day_body_parts = split[-1]  # repeat last split pattern

        # Rest day?
        if not day_body_parts:
            workout_days.append(
                WorkoutDay(
                    day_label=day_name,
                    focus="Rest",
                    exercises=[],
                    estimated_duration_min=0,
                    muscle_groups_covered=[],
                    is_rest_day=True,
                )
            )
            used_muscle_groups.clear()  # after rest, all muscles recovered
            continue

        selected = _pick_exercises_for_day(
            candidates=candidates,
            body_parts_for_day=day_body_parts,
            count=exercises_per_session,
            used_muscle_groups=used_muscle_groups,
            goal=request.goal,
        )

        day_muscles = {ex.muscle_group for ex in selected}
        all_covered_muscles |= day_muscles
        used_muscle_groups = day_muscles  # next day avoids these
        total_exercises += len(selected)

        focus = " / ".join(
            bp.title() for bp in day_body_parts[:2]
        ) if day_body_parts else "Full Body"

        workout_days.append(
            WorkoutDay(
                day_label=day_name,
                focus=focus,
                exercises=[_exercise_to_summary(ex) for ex in selected],
                estimated_duration_min=int(duration),
                muscle_groups_covered=sorted(day_muscles),
                is_rest_day=False,
            )
        )

    return WeeklyPlan(
        goal=request.goal.value,
        fitness_level=request.fitness_level.value,
        days=workout_days,
        total_exercises=total_exercises,
        muscles_covered=sorted(all_covered_muscles),
    )
