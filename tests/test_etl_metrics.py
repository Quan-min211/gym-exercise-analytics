"""
Unit tests for de_pipeline.etl_metrics — context manager, serialization, persistence.
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from de_pipeline.etl_metrics import ETLMetrics, load_run_history


class TestETLMetrics:
    """Tests for the ETLMetrics dataclass context manager."""

    def test_basic_context_manager(self, tmp_path):
        metrics_file = tmp_path / "etl_runs.jsonl"

        with patch("de_pipeline.etl_metrics.METRICS_FILE", metrics_file):
            with ETLMetrics() as m:
                m.set_extracted(100)
                m.set_valid(95, 5)
                m.set_loaded(95)
                m.set_tables_created(True)

        assert m.status == "SUCCESS"
        assert m.records_extracted == 100
        assert m.records_valid == 95
        assert m.records_invalid == 5
        assert m.records_loaded == 95
        assert m.tables_created is True
        assert m.duration_seconds is not None
        assert m.duration_seconds >= 0
        assert m.finished_at is not None
        assert m.run_id  # non-empty

    def test_saves_to_jsonl_file(self, tmp_path):
        metrics_file = tmp_path / "etl_runs.jsonl"

        with patch("de_pipeline.etl_metrics.METRICS_FILE", metrics_file):
            with ETLMetrics() as m:
                m.set_extracted(10)

        assert metrics_file.exists()
        content = metrics_file.read_text(encoding="utf-8").strip()
        record = json.loads(content)
        assert record["records_extracted"] == 10
        assert record["status"] == "SUCCESS"

    def test_failed_status_on_exception(self, tmp_path):
        metrics_file = tmp_path / "etl_runs.jsonl"

        with patch("de_pipeline.etl_metrics.METRICS_FILE", metrics_file):
            with pytest.raises(ValueError):
                with ETLMetrics() as m:
                    m.set_extracted(50)
                    raise ValueError("Test failure")

        assert m.status == "FAILED"
        assert "Test failure" in m.error_message

    def test_to_dict_excludes_private(self, tmp_path):
        metrics_file = tmp_path / "etl_runs.jsonl"

        with patch("de_pipeline.etl_metrics.METRICS_FILE", metrics_file):
            with ETLMetrics() as m:
                pass

        d = m.to_dict()
        assert "_start_ts" not in d
        assert "run_id" in d
        assert "status" in d

    def test_multiple_runs_appended(self, tmp_path):
        metrics_file = tmp_path / "etl_runs.jsonl"

        with patch("de_pipeline.etl_metrics.METRICS_FILE", metrics_file):
            with ETLMetrics() as m1:
                m1.set_extracted(10)

            with ETLMetrics() as m2:
                m2.set_extracted(20)

        lines = metrics_file.read_text(encoding="utf-8").strip().splitlines()
        assert len(lines) == 2
        r1 = json.loads(lines[0])
        r2 = json.loads(lines[1])
        assert r1["records_extracted"] == 10
        assert r2["records_extracted"] == 20


class TestLoadRunHistory:
    """Tests for the load_run_history reader."""

    def test_empty_file(self, tmp_path):
        metrics_file = tmp_path / "etl_runs.jsonl"
        metrics_file.write_text("", encoding="utf-8")

        with patch("de_pipeline.etl_metrics.METRICS_FILE", metrics_file):
            result = load_run_history()

        assert result == []

    def test_nonexistent_file(self, tmp_path):
        metrics_file = tmp_path / "does_not_exist.jsonl"

        with patch("de_pipeline.etl_metrics.METRICS_FILE", metrics_file):
            result = load_run_history()

        assert result == []

    def test_returns_newest_first(self, tmp_path):
        metrics_file = tmp_path / "etl_runs.jsonl"

        with patch("de_pipeline.etl_metrics.METRICS_FILE", metrics_file):
            with ETLMetrics() as m1:
                m1.set_extracted(10)
            with ETLMetrics() as m2:
                m2.set_extracted(20)

            result = load_run_history()

        assert len(result) == 2
        assert result[0]["records_extracted"] == 20  # newest first
        assert result[1]["records_extracted"] == 10

    def test_limit_parameter(self, tmp_path):
        metrics_file = tmp_path / "etl_runs.jsonl"

        with patch("de_pipeline.etl_metrics.METRICS_FILE", metrics_file):
            for i in range(5):
                with ETLMetrics() as m:
                    m.set_extracted(i)

            result = load_run_history(limit=2)

        assert len(result) == 2

    def test_handles_corrupt_line(self, tmp_path):
        metrics_file = tmp_path / "etl_runs.jsonl"
        metrics_file.write_text(
            '{"run_id":"a","status":"SUCCESS"}\nNOT_JSON\n{"run_id":"b","status":"FAILED"}\n',
            encoding="utf-8",
        )

        with patch("de_pipeline.etl_metrics.METRICS_FILE", metrics_file):
            result = load_run_history()

        # Should skip corrupt line and return the valid 2
        assert len(result) == 2
