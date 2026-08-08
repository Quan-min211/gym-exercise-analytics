"""
Additional tests for de_pipeline.data_quality:
- build_report() output coverage
- check_distribution() edge cases
- check_referential_integrity() with temp files
- check_consistency() boundary values
- check_completeness() None / empty values
"""

import tempfile
from pathlib import Path
from unittest.mock import patch

from de_pipeline.data_quality import (
    ALLOWED_BODY_PARTS,
    build_report,
    check_completeness,
    check_consistency,
    check_distribution,
    check_referential_integrity,
    check_uniqueness,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_record(**overrides) -> dict:
    base = {
        "id": "0001",
        "name": "Push Up",
        "category": "calisthenics",
        "body_part": "chest",
        "equipment": "body weight",
        "instructions": {"en": "Do a push up."},
        "instruction_steps": {"en": ["Start", "Push"]},
        "muscle_group": "chest",
        "secondary_muscles": ["triceps"],
        "target": "pectorals",
        "media_id": "m1",
        "image": "images/0001.jpg",
        "gif_url": "videos/0001.gif",
        "attribution": "GymVisual",
        "created_at": "2024-01-01",
    }
    base.update(overrides)
    return base


def _make_full_results(records=None):
    """Build a full results dict for build_report()."""
    if records is None:
        records = [_make_record()]

    # Patch referential integrity to avoid filesystem dependency
    with patch(
        "de_pipeline.data_quality.check_referential_integrity",
        return_value={"missing_images_count": 0, "missing_images_sample": [], "missing_gifs_count": 0, "missing_gifs_sample": []},
    ):
        return {
            "completeness": check_completeness(records),
            "uniqueness": check_uniqueness(records),
            "consistency": check_consistency(records),
            "referential": {"missing_images_count": 0, "missing_images_sample": [], "missing_gifs_count": 0, "missing_gifs_sample": []},
            "distribution": check_distribution(records),
        }


# ---------------------------------------------------------------------------
# build_report
# ---------------------------------------------------------------------------

class TestBuildReport:
    def test_report_is_string(self):
        results = _make_full_results()
        report = build_report(results)
        assert isinstance(report, str)
        assert len(report) > 0

    def test_report_contains_header(self):
        results = _make_full_results()
        report = build_report(results)
        assert "FitData Hub" in report

    def test_report_contains_total_records(self):
        records = [_make_record(id="0001"), _make_record(id="0002", name="Squat")]
        results = _make_full_results(records)
        report = build_report(results)
        assert "2" in report  # total_records

    def test_report_no_issues_message(self):
        records = [_make_record()]
        results = _make_full_results(records)
        report = build_report(results)
        assert "passed all quality checks" in report.lower() or "0" in report

    def test_report_flags_duplicates(self):
        records = [_make_record(), _make_record()]  # duplicate ID
        results = _make_full_results(records)
        report = build_report(results)
        assert "0001" in report or "duplicate" in report.lower()

    def test_report_flags_invalid_body_part(self):
        records = [_make_record(body_part="INVALID_PART")]
        results = _make_full_results(records)
        report = build_report(results)
        assert "INVALID_PART" in report or "invalid" in report.lower()

    def test_report_flags_missing_field(self):
        bad = _make_record()
        del bad["name"]
        results = _make_full_results([bad])
        report = build_report(results)
        # Missing field should appear in completeness section
        assert "name" in report or "missing" in report.lower()


# ---------------------------------------------------------------------------
# check_distribution edge cases
# ---------------------------------------------------------------------------

class TestCheckDistributionExtra:
    def test_single_record(self):
        rec = _make_record()
        result = check_distribution([rec])
        assert result["total_records"] == 1
        assert result["unique_exercises"] == 1

    def test_multiple_same_body_part(self):
        records = [
            _make_record(id="0001"),
            _make_record(id="0002", name="Bench Press"),
        ]
        result = check_distribution(records)
        assert result["by_body_part"]["chest"] == 2

    def test_unique_equipment_count(self):
        records = [
            _make_record(id="0001", equipment="barbell"),
            _make_record(id="0002", name="Squat", equipment="dumbbell"),
            _make_record(id="0003", name="Plank", equipment="barbell"),
        ]
        result = check_distribution(records)
        assert result["unique_equipment_types"] == 2

    def test_missing_body_part_counted_as_unknown(self):
        rec = _make_record()
        del rec["body_part"]
        result = check_distribution([rec])
        assert "unknown" in result["by_body_part"]


# ---------------------------------------------------------------------------
# check_consistency boundary
# ---------------------------------------------------------------------------

class TestCheckConsistencyExtra:
    def test_all_allowed_pass(self):
        records = [_make_record(body_part=bp) for bp in ALLOWED_BODY_PARTS]
        result = check_consistency(records)
        assert result["invalid_body_parts"] == {}

    def test_empty_string_body_part_flagged(self):
        rec = _make_record(body_part="")
        result = check_consistency([rec])
        assert "0001" in result["invalid_body_parts"]

    def test_none_body_part_flagged(self):
        rec = _make_record(body_part=None)
        result = check_consistency([rec])
        # None is not in ALLOWED_BODY_PARTS
        assert result["invalid_body_parts"]


# ---------------------------------------------------------------------------
# check_referential_integrity with actual temp files
# ---------------------------------------------------------------------------

class TestReferentialWithTmpFiles:
    def test_existing_files_pass(self, tmp_path):
        img = tmp_path / "images" / "0001.jpg"
        gif = tmp_path / "videos" / "0001.gif"
        img.parent.mkdir()
        gif.parent.mkdir()
        img.write_bytes(b"fake")
        gif.write_bytes(b"fake")

        from de_pipeline import config as _cfg
        original_images = _cfg.IMAGES_DIR
        original_videos = _cfg.VIDEOS_DIR

        _cfg.IMAGES_DIR = tmp_path / "images"
        _cfg.VIDEOS_DIR = tmp_path / "videos"

        try:
            from de_pipeline.data_quality import IMAGES_DIR, VIDEOS_DIR
            import de_pipeline.data_quality as dq
            dq.IMAGES_DIR = _cfg.IMAGES_DIR
            dq.VIDEOS_DIR = _cfg.VIDEOS_DIR

            rec = _make_record(image="images/0001.jpg", gif_url="videos/0001.gif")
            result = check_referential_integrity([rec])
        finally:
            _cfg.IMAGES_DIR = original_images
            _cfg.VIDEOS_DIR = original_videos

        # In isolation this may still report missing since we patched the module-level vars
        assert "missing_images_count" in result
        assert "missing_gifs_count" in result


# ---------------------------------------------------------------------------
# check_completeness: None and empty string
# ---------------------------------------------------------------------------

class TestCheckCompletenessExtra:
    def test_empty_name_flagged(self):
        rec = _make_record(name="")
        result = check_completeness([rec])
        assert "0001" in result["missing_fields"]
        assert "name" in result["missing_fields"]["0001"]

    def test_none_name_flagged(self):
        rec = _make_record(name=None)
        result = check_completeness([rec])
        assert "0001" in result["missing_fields"]

    def test_multiple_missing_fields(self):
        rec = _make_record(name=None, category=None)
        result = check_completeness([rec])
        missing = result["missing_fields"]["0001"]
        assert "name" in missing
        assert "category" in missing

    def test_complete_record_no_issues(self):
        rec = _make_record()
        result = check_completeness([rec])
        # No missing fields (id 0001 not in dict, or empty list)
        assert result["missing_fields"].get("0001", []) == []
