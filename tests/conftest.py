"""
Pytest configuration & fixtures.
Uses an in-memory SQLite database pre-populated with test exercises.
"""

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import get_db
from backend.main import app
from de_pipeline.models import Base, BodyPart, EquipmentType, Exercise, Instruction, Muscle

# In-memory SQLite engine for fast testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create fresh database tables & seed minimal test data for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    now = datetime.now(timezone.utc)

    # Seed BodyParts (integer PK)
    bp_chest = BodyPart(id=1, name="chest")
    bp_back = BodyPart(id=2, name="back")
    bp_legs = BodyPart(id=3, name="upper legs")
    session.add_all([bp_chest, bp_back, bp_legs])

    # Seed Equipment (integer PK)
    eq_bw = EquipmentType(id=1, name="body weight")
    eq_db = EquipmentType(id=2, name="dumbbell")
    session.add_all([eq_bw, eq_db])

    # Seed Muscles (integer PK)
    tm_pectorals = Muscle(id=1, name="pectorals")
    tm_lats = Muscle(id=2, name="lats")
    tm_quads = Muscle(id=3, name="quads")
    session.add_all([tm_pectorals, tm_lats, tm_quads])

    # Seed Exercises
    ex1 = Exercise(
        id="0001",
        name="Push Up",
        category="calisthenics",
        body_part_id=1,
        equipment_id=1,
        target_muscle_id=1,
        muscle_group="chest",
        media_id="m1",
        image="images/0001.jpg",
        gif_url="videos/0001.gif",
        attribution="GymVisual",
        created_at=now,
    )
    ex2 = Exercise(
        id="0002",
        name="Dumbbell Row",
        category="strength",
        body_part_id=2,
        equipment_id=2,
        target_muscle_id=2,
        muscle_group="back",
        media_id="m2",
        image="images/0002.jpg",
        gif_url="videos/0002.gif",
        attribution="GymVisual",
        created_at=now,
    )
    ex3 = Exercise(
        id="0003",
        name="Squat",
        category="calisthenics",
        body_part_id=3,
        equipment_id=1,
        target_muscle_id=3,
        muscle_group="upper legs",
        media_id="m3",
        image="images/0003.jpg",
        gif_url="videos/0003.gif",
        attribution="GymVisual",
        created_at=now,
    )
    session.add_all([ex1, ex2, ex3])

    # Extra exercises to test alternatives (same target muscle as Push Up)
    ex4 = Exercise(
        id="0004",
        name="Dumbbell Fly",
        category="strength",
        body_part_id=1,          # chest
        equipment_id=2,          # dumbbell (different from Push Up)
        target_muscle_id=1,      # pectorals (same as Push Up)
        muscle_group="chest",
        media_id="m4",
        image="images/0004.jpg",
        gif_url="videos/0004.gif",
        attribution="GymVisual",
        created_at=now,
    )
    ex5 = Exercise(
        id="0005",
        name="Chest Dip",
        category="calisthenics",
        body_part_id=1,          # chest
        equipment_id=1,          # body weight (same as Push Up)
        target_muscle_id=1,      # pectorals (same as Push Up)
        muscle_group="chest",
        media_id="m5",
        image="images/0005.jpg",
        gif_url="videos/0005.gif",
        attribution="GymVisual",
        created_at=now,
    )
    session.add_all([ex4, ex5])

    # Seed Instructions
    inst1 = Instruction(
        id=1,
        exercise_id="0001",
        lang_code="en",
        full_text="Get into plank position and push.",
        steps=["Get into plank position.", "Lower chest to ground.", "Push back up."],
    )
    inst2 = Instruction(
        id=2,
        exercise_id="0002",
        lang_code="en",
        full_text="Pull dumbbell to ribcage.",
        steps=["Hinge at hips.", "Pull dumbbell to ribcage."],
    )
    inst3 = Instruction(
        id=3,
        exercise_id="0003",
        lang_code="en",
        full_text="Squat down and up.",
        steps=["Stand feet shoulder-width.", "Bend knees.", "Stand back up."],
    )
    session.add_all([inst1, inst2, inst3])
    session.commit()

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI TestClient with overridden get_db dependency."""
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
