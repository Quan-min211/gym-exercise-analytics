"""
ETL Metrics — track pipeline run history and performance.

Each ETL run writes a JSON record to docs/etl_runs.jsonl (newline-delimited).
The backend API exposes this via GET /api/analytics/etl-history.

Usage in etl.py:
    from de_pipeline.etl_metrics import ETLMetrics
    with ETLMetrics() as m:
        m.set_extracted(876)
        m.set_valid(876, invalid=0)
        m.set_loaded(876)
    # metrics auto-saved on __exit__
"""

import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

METRICS_FILE = Path(__file__).resolve().parent.parent / "docs" / "etl_runs.jsonl"


@dataclass
class ETLMetrics:
    """Context manager that records one ETL run as a JSONL entry."""

    run_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    started_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    finished_at: Optional[str] = None
    duration_seconds: Optional[float] = None

    records_extracted: int = 0
    records_valid: int = 0
    records_invalid: int = 0
    records_loaded: int = 0

    tables_created: bool = False
    status: str = "RUNNING"
    error_message: Optional[str] = None

    _start_ts: float = field(default=0.0, repr=False, compare=False)

    def __post_init__(self) -> None:
        import time
        self._start_ts = time.perf_counter()

    # ------------------------------------------------------------------ #
    # Setters called from etl.py                                           #
    # ------------------------------------------------------------------ #

    def set_extracted(self, count: int) -> None:
        self.records_extracted = count

    def set_valid(self, valid: int, invalid: int) -> None:
        self.records_valid = valid
        self.records_invalid = invalid

    def set_loaded(self, count: int) -> None:
        self.records_loaded = count

    def set_tables_created(self, created: bool = True) -> None:
        self.tables_created = created

    # ------------------------------------------------------------------ #
    # Context manager                                                       #
    # ------------------------------------------------------------------ #

    def __enter__(self) -> "ETLMetrics":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        import time

        self.finished_at = datetime.now(timezone.utc).isoformat()
        self.duration_seconds = round(time.perf_counter() - self._start_ts, 2)

        if exc_type is None:
            self.status = "SUCCESS"
        else:
            self.status = "FAILED"
            self.error_message = str(exc_val)

        self.save()
        # Do NOT suppress the exception
        return False

    # ------------------------------------------------------------------ #
    # Persistence                                                           #
    # ------------------------------------------------------------------ #

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("_start_ts", None)
        return d

    def save(self) -> None:
        METRICS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with METRICS_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(self.to_dict()) + "\n")


# ---------------------------------------------------------------------------
# Reader utility (used by the API)
# ---------------------------------------------------------------------------

def load_run_history(limit: int = 20) -> list[dict]:
    """Return the last *limit* ETL run records, newest first."""
    if not METRICS_FILE.exists():
        return []

    lines = METRICS_FILE.read_text(encoding="utf-8").strip().splitlines()
    records = []
    for line in lines:
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    # newest first
    return list(reversed(records))[:limit]
