"""
Pydantic request / response schemas for the FitData Hub API.

All response models use model_config = ConfigDict(from_attributes=True)
so they can be constructed directly from SQLAlchemy ORM instances.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Enums (mirrors the exercises schema)
# ---------------------------------------------------------------------------


class BodyPartEnum(str, Enum):
    back = "back"
    cardio = "cardio"
    chest = "chest"
    lower_arms = "lower arms"
    lower_legs = "lower legs"
    neck = "neck"
    shoulders = "shoulders"
    upper_arms = "upper arms"
    upper_legs = "upper legs"
    waist = "waist"


class FitnessLevel(str, Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class WorkoutGoal(str, Enum):
    build_muscle = "build_muscle"
    lose_weight = "lose_weight"
    improve_endurance = "improve_endurance"
    flexibility = "flexibility"
    general_fitness = "general_fitness"


class SessionDuration(int, Enum):
    short = 30
    medium = 45
    standard = 60
    long = 90


# ---------------------------------------------------------------------------
# Exercise schemas
# ---------------------------------------------------------------------------


class MuscleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class InstructionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    lang_code: str
    full_text: str
    steps: list[str]


class ExerciseSummary(BaseModel):
    """Lightweight exercise card — used in list responses."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    category: str
    body_part: str = Field(alias="body_part_name")
    equipment: str = Field(alias="equipment_name")
    target: str = Field(alias="target_muscle_name")
    muscle_group: str
    image: str
    gif_url: str


class ExerciseDetail(BaseModel):
    """Full exercise record — used in single-item responses."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    category: str
    body_part: str
    equipment: str
    target: str
    muscle_group: str
    secondary_muscles: list[str]
    image: str
    gif_url: str
    attribution: str
    created_at: datetime
    instructions: Optional[InstructionOut] = None   # filtered to requested lang


class ExerciseListResponse(BaseModel):
    items: list[ExerciseSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Filter options schema
# ---------------------------------------------------------------------------


class FilterOptions(BaseModel):
    body_parts: list[str]
    equipment_types: list[str]
    target_muscles: list[str]
    muscle_groups: list[str]


# ---------------------------------------------------------------------------
# Recommendation schemas
# ---------------------------------------------------------------------------


class RecommendRequest(BaseModel):
    goal: WorkoutGoal = WorkoutGoal.general_fitness
    fitness_level: FitnessLevel = FitnessLevel.beginner
    available_equipment: list[str] = Field(
        default_factory=lambda: ["body weight"],
        description="List of equipment the user has access to.",
    )
    target_body_parts: list[str] = Field(
        default_factory=list,
        description="Body parts to focus on. Empty means full-body.",
    )
    session_duration: SessionDuration = SessionDuration.standard
    days_per_week: int = Field(default=3, ge=1, le=7)
    exclude_exercise_ids: list[str] = Field(
        default_factory=list,
        description="Exercise IDs to exclude from recommendations.",
    )


class WorkoutDay(BaseModel):
    day_label: str               # e.g. "Monday", "Day 1"
    focus: str                   # e.g. "Upper body", "Full body"
    exercises: list[ExerciseSummary]
    estimated_duration_min: int
    muscle_groups_covered: list[str]
    is_rest_day: bool = False


class WeeklyPlan(BaseModel):
    goal: str
    fitness_level: str
    days: list[WorkoutDay]
    total_exercises: int
    muscles_covered: list[str]


# ---------------------------------------------------------------------------
# Schedule schemas
# ---------------------------------------------------------------------------


class ScheduledExercise(BaseModel):
    exercise_id: str
    sets: int = Field(default=3, ge=1, le=10)
    reps: Optional[str] = "10-12"    # e.g. "8-10", "AMRAP", "30s"
    rest_seconds: int = Field(default=60, ge=0)
    notes: Optional[str] = None


class ScheduleDay(BaseModel):
    day_index: int                    # 0 = first day of week/month
    label: str                        # e.g. "Monday" or "2026-08-01"
    is_rest_day: bool = False
    exercises: list[ScheduledExercise] = Field(default_factory=list)


class ScheduleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    schedule_type: str = Field(default="weekly", pattern="^(weekly|monthly)$")
    days: list[ScheduleDay]


class ScheduleOut(BaseModel):
    id: str
    name: str
    schedule_type: str
    days: list[ScheduleDay]
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Analytics schemas
# ---------------------------------------------------------------------------


class DistributionItem(BaseModel):
    label: str
    count: int
    percentage: float


class DatasetOverview(BaseModel):
    total_exercises: int
    total_body_parts: int
    total_equipment_types: int
    total_target_muscles: int
    by_body_part: list[DistributionItem]
    by_equipment: list[DistributionItem]
    by_target_muscle: list[DistributionItem]


class MuscleCoOccurrence(BaseModel):
    muscle_a: str
    muscle_b: str
    co_occurrence_count: int
