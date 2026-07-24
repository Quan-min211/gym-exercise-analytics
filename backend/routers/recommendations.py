"""Recommendations router."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas import RecommendRequest, WeeklyPlan
from backend.services.recommendation_engine import build_weekly_plan

router = APIRouter(prefix="/api/recommend", tags=["recommendations"])


@router.post("/weekly", response_model=WeeklyPlan)
def recommend_weekly(request: RecommendRequest, db: Session = Depends(get_db)):
    """Generate a personalised weekly workout plan based on user preferences."""
    return build_weekly_plan(db, request)
