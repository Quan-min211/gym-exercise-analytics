"""
Unit tests for de_pipeline.data_quality — all 5 check functions.
Uses in-memory data only (no file I/O to real dataset).
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from de_pipeline.data_quality import (
    check_completeness,
    check_consistency,
    check_distribution,
    check_referential_integrity,
    check_uniqueness,
    ALLOWED_BODY_PARTS,
    REQUIRED_FIELDS,
)
from de_pipeline.config import SUPPORTED_LANGUAGES


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_record(id_str: str = "0001", body_part: str = "chest", name: str = "Push Up") -> dict:
    instr = {lang: f"{name} in {lang}" for lang in SUPPORTED_LANGUAGES}
    steps = {lang: [f"Step {lang}"] for lang in SUPPORTED_LANGUAGES}
    return {
        "id": id_str,
        "name": name,
        "category": "strength",
        "body_part": body_part,
        "equipment": "body weight",
        "instructions": instr,
        "instruction_steps": steps,
        "muscle_group": "chest",
        "secondary_muscles": ["triceps"],
        "target": "pectorals",
        "media_id": id_str,
        "image": f"images/{id_str}.jpg",
        "gif_url": f"videos/{id_str}.gif",
        "attribution": "GymVisual",
        "created_at": "2025-01-01T00:00:00Z",
    }


# ---------------------------------------------------------------------------
# check_completeness
# ---------------------------------------------------------------------------

class TestCheckCompleteness:
    def test_all_complete(self):
        records = [make_record("0001"), make_record("0002")]
        result = check_completeness(records)
        assert result["missing_fields"] == {}
        assert result["missing_languages"] == {}

    def test_missing_field(self):
        rec = make_record("0001")
        del rec["name"]
        result = check_completeness([rec])
        assert "0001" in result["missing_fields"]
        assert "name" in result["missing_fields"]["0001"]

    def test_missing_instruction_language(self):
        rec = make_record("0001")
        del rec["instructions"]["fr"]
        result = check_completeness([rec])
        assert "0001" in result["missing_languages"]
        assert any("instructions.fr" in s for s in result["missing_languages"]["0001"])

    def test_missing_steps_language(self):
        rec = make_record("0001")
        del rec["instruction_steps"]["ko"]
        result = check_completeness([rec])
        assert "0001" in result["missing_languages"]
        assert any("instruction_steps.ko" in s for s in result["missing_languages"]["0001"])

    def test_empty_required_field(self):
        rec = make_record("0001")
        rec["name"] = ""  # empty string counts as missing
        result = check_completeness([rec])
        assert "0001" in result["missing_fields"]

    def test_none_required_field(self):
        rec = make_record("0001")
        rec["category"] = None
        result = check_completeness([rec])
        assert "0001" in result["missing_fields"]


# ---------------------------------------------------------------------------
# check_uniqueness
# ---------------------------------------------------------------------------

class TestCheckUniqueness:
    def test_all_unique(self):
        records = [make_record("0001"), make_record("0002"), make_record("0003")]
        result = check_uniqueness(records)
        assert result["duplicate_ids"] == {}

    def test_one_duplicate(self):
        records = [make_record("0001"), make_record("0001"), make_record("0002")]
        result = check_uniqueness(records)
        assert "0001" in result["duplicate_ids"]
        assert result["duplicate_ids"]["0001"] == 2

    def test_triple_duplicate(self):
        records = [make_record("0001")] * 3
        result = check_uniqueness(records)
        assert result["duplicate_ids"]["0001"] == 3

    def test_empty_dataset(self):
        result = check_uniqueness([])
        assert result["duplicate_ids"] == {}


# ---------------------------------------------------------------------------
# check_consistency
# ---------------------------------------------------------------------------

class TestCheckConsistency:
    def test_all_valid_body_parts(self):
        records = [make_record("0001", bp) for bp in list(ALLOWED_BODY_PARTS)[:3]]
        result = check_consistency(records)
        assert result["invalid_body_parts"] == {}

    def test_invalid_body_part(self):
        rec = make_record("0001", body_part="INVALID_BODY_PART")
        result = check_consistency([rec])
        assert "0001" in result["invalid_body_parts"]
        assert result["invalid_body_parts"]["0001"] == "INVALID_BODY_PART"

    def test_mixed_valid_invalid(self):
        records = [
            make_record("0001", "chest"),       # valid
            make_record("0002", "UNKNOWN"),      # invalid
            make_record("0003", "back"),         # valid
        ]
        result = check_consistency(records)
        assert len(result["invalid_body_parts"]) == 1
        assert "0002" in result["invalid_body_parts"]

    def test_all_allowed_body_parts_pass(self):
        records = [make_record(f"000{i+1}", bp) for i, bp in enumerate(ALLOWED_BODY_PARTS)]
        result = check_consistency(records)
        assert result["invalid_body_parts"] == {}


# ---------------------------------------------------------------------------
# check_referential_integrity
# ---------------------------------------------------------------------------

class TestCheckReferentialIntegrity:
    def test_all_files_exist(self, tmp_path):
        # Create fake image and gif files
        img_dir = tmp_path / "images"
        vid_dir = tmp_path / "videos"
        img_dir.mkdir()
        vid_dir.mkdir()
        (img_dir / "0001.jpg").write_text("fake")
        (vid_dir / "0001.gif").write_text("fake")

        rec = make_record("0001")
        rec["image"] = "images/0001.jpg"
        rec["gif_url"] = "videos/0001.gif"

        with (
            patch("de_pipeline.data_quality.IMAGES_DIR", img_dir),
            patch("de_pipeline.data_quality.VIDEOS_DIR", vid_dir),
        ):
            result = check_referential_integrity([rec])

        assert result["missing_images_count"] == 0
        assert result["missing_gifs_count"] == 0

    def test_missing_image(self, tmp_path):
        img_dir = tmp_path / "images"
        vid_dir = tmp_path / "videos"
        img_dir.mkdir()
        vid_dir.mkdir()
        # gif exists, image does NOT
        (vid_dir / "0001.gif").write_text("fake")

        rec = make_record("0001")
        with (
            patch("de_pipeline.data_quality.IMAGES_DIR", img_dir),
            patch("de_pipeline.data_quality.VIDEOS_DIR", vid_dir),
        ):
            result = check_referential_integrity([rec])

        assert result["missing_images_count"] == 1
        assert "0001" in result["missing_images_sample"]

    def test_missing_gif(self, tmp_path):
        img_dir = tmp_path / "images"
        vid_dir = tmp_path / "videos"
        img_dir.mkdir()
        vid_dir.mkdir()
        (img_dir / "0001.jpg").write_text("fake")
        # gif does NOT exist

        rec = make_record("0001")
        with (
            patch("de_pipeline.data_quality.IMAGES_DIR", img_dir),
            patch("de_pipeline.data_quality.VIDEOS_DIR", vid_dir),
        ):
            result = check_referential_integrity([rec])

        assert result["missing_gifs_count"] == 1


# ---------------------------------------------------------------------------
# check_distribution
# ---------------------------------------------------------------------------

class TestCheckDistribution:
    def test_basic_counts(self):
        records = [
            make_record("0001", "chest"),
            make_record("0002", "back"),
            make_record("0003", "chest"),
        ]
        result = check_distribution(records)
        assert result["total_records"] == 3
        assert result["by_body_part"]["chest"] == 2
        assert result["by_body_part"]["back"] == 1

    def test_unique_counts(self):
        records = [
            make_record("0001", name="Push Up"),
            make_record("0002", name="Pull Up"),
            make_record("0003", name="Push Up"),  # duplicate name
        ]
        result = check_distribution(records)
        assert result["unique_exercises"] == 2  # only 2 unique names
        assert result["total_records"] == 3

    def test_empty_dataset(self):
        result = check_distribution([])
        assert result["total_records"] == 0

    def test_equipment_distribution(self):
        records = [make_record("0001"), make_record("0002"), make_record("0003")]
        result = check_distribution(records)
        assert "body weight" in result["by_equipment"]
        assert result["by_equipment"]["body weight"] == 3
