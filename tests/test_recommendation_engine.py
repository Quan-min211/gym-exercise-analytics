"""
Unit tests for rule-based recommendation engine.
"""

from backend.schemas import FitnessLevel, RecommendRequest, WorkoutGoal
from backend.services.recommendation_engine import build_weekly_plan


def test_build_weekly_plan_basic(db_session):
    request = RecommendRequest(
        goal=WorkoutGoal.build_muscle,
        fitness_level=FitnessLevel.beginner,
        available_equipment=["body weight"],
        days_per_week=3,
        session_duration=30,
    )
    plan = build_weekly_plan(db_session, request)

    assert plan.goal == "build_muscle"
    assert plan.fitness_level == "beginner"
    assert len(plan.days) == 3
    assert plan.total_exercises >= 1


def test_build_weekly_plan_rest_days(db_session):
    request = RecommendRequest(
        goal=WorkoutGoal.general_fitness,
        fitness_level=FitnessLevel.intermediate,
        available_equipment=["body weight", "dumbbell"],
        days_per_week=7,
        session_duration=45,
    )
    plan = build_weekly_plan(db_session, request)

    assert len(plan.days) == 7
    # 7-day split has Sunday as rest day
    assert plan.days[6].is_rest_day is True
    assert plan.days[6].focus == "Rest"
