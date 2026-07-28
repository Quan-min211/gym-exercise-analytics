"""
Pytest configuration & fixtures.
Uses an in-memory SQLite database pre-populated with test exercises.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import get_db
from backend.main import app
from de_pipeline.models import Base, BodyPart, EquipmentType, Exercise, Muscle, TargetMuscle

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

    # Seed BodyParts
    bp_chest = BodyPart(id="bp_1", name="chest")
    bp_back = BodyPart(id="bp_2", name="back")
    bp_legs = BodyPart(id="bp_3", name="upper legs")
    session.add_all([bp_chest, bp_back, bp_legs])

    # Seed Equipment
    eq_bw = EquipmentType(id="eq_1", name="body weight")
    eq_db = EquipmentType(id="eq_2", name="dumbbell")
    session.add_all([eq_bw, eq_db])

    # Seed TargetMuscles
    tm_pectorals = TargetMuscle(id="tm_1", name="pectorals")
    tm_lats = TargetMuscle(id="tm_2", name="lats")
    tm_quads = TargetMuscle(id="tm_3", name="quads")
    session.add_all([tm_pectorals, tm_lats, tm_quads])

    # Seed Exercises
    ex1 = Exercise(
        id="ex_1",
        name="Push Up",
        category="calisthenics",
        body_part_id="bp_1",
        equipment_id="eq_1",
        target_muscle_id="tm_1",
        muscle_group="chest",
        image="images/ex_1.jpg",
        gif_url="videos/ex_1.gif",
        instructions_json={"steps": ["Get into plank position.", "Lower chest to ground.", "Push back up."]},
    )
    ex2 = Exercise(
        id="ex_2",
        name="Dumbbell Row",
        category="strength",
        body_part_id="bp_2",
        equipment_id="eq_2",
        target_muscle_id="tm_2",
        muscle_group="back",
        image="images/ex_2.jpg",
        gif_url="videos/ex_2.gif",
        instructions_json={"steps": ["Hinge at hips.", "Pull dumbbell to ribcage."]},
    )
    ex3 = Exercise(
        id="ex_3",
        name="Squat",
        category="calisthenics",
        body_part_id="bp_3",
        equipment_id="eq_1",
        target_muscle_id="tm_3",
        muscle_group="upper legs",
        image="images/ex_3.jpg",
        gif_url="videos/ex_3.gif",
        instructions_json={"steps": ["Stand feet shoulder-width.", "Bend knees.", "Stand back up."]},
    )
    session.add_all([ex1, ex2, ex3])
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
