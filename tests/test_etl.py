"""
Unit tests for de_pipeline.etl — extract, validate, and transform steps.
Uses isolated in-memory data (no real DB connection required).
"""

import json
import tempfile
from pathlib import Path

import pytest

from de_pipeline.etl import extract, validate, REQUIRED_FIELDS
from de_pipeline.config import SUPPORTED_LANGUAGES


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_valid_record(id_str: str = "0001", name: str = "Push Up") -> dict:
    """Build a minimal valid exercise record."""
    instructions = {lang: f"{name} instructions in {lang}" for lang in SUPPORTED_LANGUAGES}
    steps = {lang: [f"Step 1 in {lang}", f"Step 2 in {lang}"] for lang in SUPPORTED_LANGUAGES}
    return {
        "id": id_str,
        "name": name,
        "category": "strength",
        "body_part": "chest",
        "equipment": "body weight",
        "instructions": instructions,
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
# Tests: extract()
# ---------------------------------------------------------------------------

class TestExtract:
    def test_extract_valid_json(self, tmp_path):
        data = [make_valid_record("0001"), make_valid_record("0002")]
        json_file = tmp_path / "exercises.json"
        json_file.write_text(json.dumps(data), encoding="utf-8")

        result = extract(json_file)

        assert len(result) == 2
        assert result[0]["id"] == "0001"

    def test_extract_missing_file_exits(self, tmp_path):
        nonexistent = tmp_path / "missing.json"
        with pytest.raises(SystemExit):
            extract(nonexistent)

    def test_extract_non_array_json_exits(self, tmp_path):
        json_file = tmp_path / "wrong.json"
        json_file.write_text(json.dumps({"not": "an array"}), encoding="utf-8")
        with pytest.raises(SystemExit):
            extract(json_file)

    def test_extract_empty_array(self, tmp_path):
        json_file = tmp_path / "empty.json"
        json_file.write_text("[]", encoding="utf-8")
        result = extract(json_file)
        assert result == []


# ---------------------------------------------------------------------------
# Tests: validate()
# ---------------------------------------------------------------------------

class TestValidate:
    def test_all_valid_records(self):
        records = [make_valid_record("0001"), make_valid_record("0002")]
        valid, invalid = validate(records)
        assert len(valid) == 2
        assert len(invalid) == 0

    def test_missing_required_field(self):
        rec = make_valid_record("0001")
        del rec["name"]  # Remove required field
        valid, invalid = validate([rec])
        assert len(valid) == 0
        assert len(invalid) == 1
        assert "_errors" in invalid[0]
        assert any("Missing fields" in e for e in invalid[0]["_errors"])

    def test_invalid_id_format_non_numeric(self):
        rec = make_valid_record()
        rec["id"] = "ABCD"  # must be 4 digits
        valid, invalid = validate([rec])
        assert len(invalid) == 1
        assert any("Invalid id format" in e for e in invalid[0]["_errors"])

    def test_invalid_id_format_wrong_length(self):
        rec = make_valid_record()
        rec["id"] = "001"  # 3 chars, not 4
        valid, invalid = validate([rec])
        assert len(invalid) == 1

    def test_duplicate_ids(self):
        rec1 = make_valid_record("0001")
        rec2 = make_valid_record("0001")  # same ID
        valid, invalid = validate([rec1, rec2])
        assert len(valid) == 1  # first accepted
        assert len(invalid) == 1  # second rejected
        assert any("Duplicate id" in e for e in invalid[0]["_errors"])

    def test_missing_instruction_language(self):
        rec = make_valid_record("0001")
        del rec["instructions"]["fr"]  # Remove one language
        valid, invalid = validate([rec])
        assert len(invalid) == 1
        assert any("Missing instruction lang: fr" in e for e in invalid[0]["_errors"])

    def test_missing_instruction_steps_language(self):
        rec = make_valid_record("0001")
        del rec["instruction_steps"]["ko"]
        valid, invalid = validate([rec])
        assert len(invalid) == 1
        assert any("Missing instruction_steps lang: ko" in e for e in invalid[0]["_errors"])

    def test_empty_id_string(self):
        rec = make_valid_record()
        rec["id"] = ""
        valid, invalid = validate([rec])
        assert len(invalid) == 1

    def test_mixed_valid_and_invalid(self):
        records = [
            make_valid_record("0001"),
            make_valid_record("0002"),
            {**make_valid_record("0003"), "name": ""},  # empty name is technically valid field-presence wise
            {"id": "XXXX", "name": "Bad Record"},        # missing many fields + bad id
        ]
        valid, invalid = validate(records)
        assert len(invalid) >= 1  # at least the XXXX record is invalid
        assert len(valid) >= 2

    def test_all_required_fields_checked(self):
        """Each missing required field should produce an error."""
        for field_name in REQUIRED_FIELDS:
            rec = make_valid_record("0001")
            del rec[field_name]
            valid, invalid = validate([rec])
            assert len(invalid) == 1, f"Expected invalid when '{field_name}' is missing"
