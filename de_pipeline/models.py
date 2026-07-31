"""
SQLAlchemy ORM models for the FitData Hub database.

Schema design follows 3NF normalization of exercises.json:
  - exercises          : core exercise record
  - body_parts         : lookup table for body part categories
  - muscles            : lookup table for muscle names
  - equipment_types    : lookup table for equipment names
  - exercise_muscles   : M2M junction — exercise ↔ muscle (with is_primary flag)
  - instructions       : one row per exercise per language
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Lookup tables
# ---------------------------------------------------------------------------


class BodyPart(Base):
    """Normalized body part / category (e.g. 'back', 'chest', 'waist')."""

    __tablename__ = "body_parts"

    id = Column(Integer, primary_key=True)
    name = Column(String(64), nullable=False, unique=True)

    exercises = relationship("Exercise", back_populates="body_part_ref")

    def __repr__(self) -> str:
        return f"<BodyPart id={self.id} name={self.name!r}>"


class Muscle(Base):
    """Normalized muscle name (e.g. 'abs', 'biceps', 'glutes')."""

    __tablename__ = "muscles"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False, unique=True)

    exercise_links = relationship("ExerciseMuscle", back_populates="muscle")

    def __repr__(self) -> str:
        return f"<Muscle id={self.id} name={self.name!r}>"


class EquipmentType(Base):
    """Normalized equipment type (e.g. 'dumbbell', 'body weight', 'barbell')."""

    __tablename__ = "equipment_types"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False, unique=True)

    exercises = relationship("Exercise", back_populates="equipment_ref")

    def __repr__(self) -> str:
        return f"<EquipmentType id={self.id} name={self.name!r}>"


# ---------------------------------------------------------------------------
# Core exercise table
# ---------------------------------------------------------------------------


class Exercise(Base):
    """
    One row per exercise in exercises.json.

    Foreign keys to lookup tables replace the original string columns for
    body_part, equipment, and muscle_group to enable efficient filtering.
    """

    __tablename__ = "exercises"

    # Primary key — preserve original 4-digit string ID from dataset
    id = Column(String(4), primary_key=True)

    name = Column(String(256), nullable=False, index=True)
    category = Column(String(64), nullable=False)

    # FK to lookup tables
    body_part_id = Column(Integer, ForeignKey("body_parts.id"), nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment_types.id"), nullable=False, index=True)

    # Primary muscle group label (e.g. 'hip flexors') — kept as string because
    # it often overlaps with or differs from target; FK to muscles for target.
    muscle_group = Column(String(128), nullable=False)

    # FK to muscles for the primary targeted muscle
    target_muscle_id = Column(Integer, ForeignKey("muscles.id"), nullable=False, index=True)

    # Media paths (relative to project root)
    media_id = Column(String(64), nullable=False)
    image = Column(String(256), nullable=False)
    gif_url = Column(String(256), nullable=False)

    attribution = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)

    # Relationships
    body_part_ref = relationship("BodyPart", back_populates="exercises")
    equipment_ref = relationship("EquipmentType", back_populates="exercises")
    target_muscle_ref = relationship("Muscle", foreign_keys=[target_muscle_id])
    muscle_links = relationship("ExerciseMuscle", back_populates="exercise", cascade="all, delete-orphan")
    instructions = relationship("Instruction", back_populates="exercise", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Exercise id={self.id!r} name={self.name!r}>"


# ---------------------------------------------------------------------------
# Many-to-many: exercises ↔ muscles
# ---------------------------------------------------------------------------


class ExerciseMuscle(Base):
    """
    Junction table linking exercises to muscles.

    is_primary = True  → this is the target (primary) muscle
    is_primary = False → this is a secondary / synergist muscle
    """

    __tablename__ = "exercise_muscles"
    __table_args__ = (
        UniqueConstraint("exercise_id", "muscle_id", name="uq_exercise_muscle"),
    )

    id = Column(Integer, primary_key=True)
    exercise_id = Column(String(4), ForeignKey("exercises.id"), nullable=False, index=True)
    muscle_id = Column(Integer, ForeignKey("muscles.id"), nullable=False, index=True)
    is_primary = Column(Boolean, nullable=False, default=False)

    exercise = relationship("Exercise", back_populates="muscle_links")
    muscle = relationship("Muscle", back_populates="exercise_links")

    def __repr__(self) -> str:
        tag = "primary" if self.is_primary else "secondary"
        return f"<ExerciseMuscle exercise={self.exercise_id} muscle={self.muscle_id} {tag}>"


# ---------------------------------------------------------------------------
# Instructions (one row per exercise × language)
# ---------------------------------------------------------------------------


class Instruction(Base):
    """
    Stores multilingual instructions for each exercise.

    full_text    : the full instruction paragraph
    steps        : JSONB array of individual instruction steps
    """

    __tablename__ = "instructions"
    __table_args__ = (
        UniqueConstraint("exercise_id", "lang_code", name="uq_instruction_lang"),
        Index("ix_instructions_exercise_lang", "exercise_id", "lang_code"),
    )

    id = Column(Integer, primary_key=True)
    exercise_id = Column(String(4), ForeignKey("exercises.id"), nullable=False, index=True)
    lang_code = Column(String(8), nullable=False)   # ISO 639-1 code, e.g. 'en'
    full_text = Column(Text, nullable=False)
    steps = Column(JSON, nullable=False)            # list[str]

    exercise = relationship("Exercise", back_populates="instructions")

    def __repr__(self) -> str:
        return f"<Instruction exercise={self.exercise_id} lang={self.lang_code!r}>"
