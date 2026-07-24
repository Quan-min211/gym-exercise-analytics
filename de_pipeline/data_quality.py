"""
Data quality checks for the FitData Hub exercise dataset.

Produces a human-readable report covering:
  - Completeness  : required fields, languages
  - Uniqueness    : duplicate IDs
  - Consistency   : body_part values against allowed enum
  - Referential   : image/gif paths reference existing files
  - Distribution  : record counts by body_part, equipment, target muscle

Run
---
    python -m de_pipeline.data_quality
    python -m de_pipeline.data_quality --report quality_report.md
"""

import argparse
import json
import logging
import sys
from collections import Counter, defaultdict
from pathlib import Path

from de_pipeline.config import (
    EXERCISES_JSON,
    EXERCISES_SCHEMA,
    IMAGES_DIR,
    SUPPORTED_LANGUAGES,
    VIDEOS_DIR,
)

log = logging.getLogger(__name__)

ALLOWED_BODY_PARTS = {
    "back", "cardio", "chest", "lower arms", "lower legs",
    "neck", "shoulders", "upper arms", "upper legs", "waist",
}

REQUIRED_FIELDS = {
    "id", "name", "category", "body_part", "equipment",
    "instructions", "instruction_steps", "muscle_group",
    "secondary_muscles", "target", "media_id", "image",
    "gif_url", "attribution", "created_at",
}


# ---------------------------------------------------------------------------
# Individual checks
# ---------------------------------------------------------------------------


def check_completeness(records: list[dict]) -> dict:
    missing_fields: dict[str, list[str]] = defaultdict(list)
    missing_languages: dict[str, list[str]] = defaultdict(list)

    for rec in records:
        rec_id = rec.get("id", "UNKNOWN")
        for field in REQUIRED_FIELDS:
            if field not in rec or rec[field] is None or rec[field] == "":
                missing_fields[rec_id].append(field)

        for lang in SUPPORTED_LANGUAGES:
            if lang not in rec.get("instructions", {}):
                missing_languages[rec_id].append(f"instructions.{lang}")
            if lang not in rec.get("instruction_steps", {}):
                missing_languages[rec_id].append(f"instruction_steps.{lang}")

    return {
        "missing_fields": dict(missing_fields),
        "missing_languages": dict(missing_languages),
    }


def check_uniqueness(records: list[dict]) -> dict:
    id_counts: Counter = Counter(rec.get("id") for rec in records)
    duplicates = {k: v for k, v in id_counts.items() if v > 1}
    return {"duplicate_ids": duplicates}


def check_consistency(records: list[dict]) -> dict:
    invalid_body_parts: dict[str, str] = {}
    for rec in records:
        bp = rec.get("body_part", "")
        if bp not in ALLOWED_BODY_PARTS:
            invalid_body_parts[rec.get("id", "UNKNOWN")] = bp
    return {"invalid_body_parts": invalid_body_parts}


def check_referential_integrity(records: list[dict]) -> dict:
    missing_images: list[str] = []
    missing_gifs: list[str] = []

    for rec in records:
        img_path = IMAGES_DIR.parent / rec.get("image", "")
        gif_path = VIDEOS_DIR.parent / rec.get("gif_url", "")

        if not img_path.exists():
            missing_images.append(rec.get("id", "UNKNOWN"))
        if not gif_path.exists():
            missing_gifs.append(rec.get("id", "UNKNOWN"))

    return {
        "missing_images_count": len(missing_images),
        "missing_images_sample": missing_images[:10],
        "missing_gifs_count": len(missing_gifs),
        "missing_gifs_sample": missing_gifs[:10],
    }


def check_distribution(records: list[dict]) -> dict:
    body_part_dist = Counter(rec.get("body_part", "unknown") for rec in records)
    equipment_dist = Counter(rec.get("equipment", "unknown") for rec in records)
    target_dist = Counter(rec.get("target", "unknown") for rec in records)
    muscle_group_dist = Counter(rec.get("muscle_group", "unknown") for rec in records)

    return {
        "total_records": len(records),
        "by_body_part": dict(body_part_dist.most_common()),
        "by_equipment": dict(equipment_dist.most_common(20)),
        "by_target_muscle": dict(target_dist.most_common(20)),
        "by_muscle_group": dict(muscle_group_dist.most_common(20)),
        "unique_exercises": len({rec.get("name") for rec in records}),
        "unique_equipment_types": len(equipment_dist),
        "unique_target_muscles": len(target_dist),
    }


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------


def build_report(results: dict) -> str:
    lines: list[str] = []

    def h1(text: str) -> None:
        lines.append(f"# {text}\n")

    def h2(text: str) -> None:
        lines.append(f"\n## {text}\n")

    def para(text: str) -> None:
        lines.append(f"{text}\n")

    def table_row(*cols: str) -> None:
        lines.append("| " + " | ".join(str(c) for c in cols) + " |")

    h1("FitData Hub — Data Quality Report")
    para(f"Dataset: `{EXERCISES_JSON}`")

    # --- Distribution ---
    h2("Dataset Overview")
    dist = results["distribution"]
    para(f"- Total records: **{dist['total_records']}**")
    para(f"- Unique exercise names: **{dist['unique_exercises']}**")
    para(f"- Unique equipment types: **{dist['unique_equipment_types']}**")
    para(f"- Unique target muscles: **{dist['unique_target_muscles']}**")

    h2("Distribution by Body Part")
    table_row("Body Part", "Count")
    table_row("---", "---")
    for bp, count in dist["by_body_part"].items():
        table_row(bp, count)

    h2("Top 20 — By Equipment")
    table_row("Equipment", "Count")
    table_row("---", "---")
    for eq, count in dist["by_equipment"].items():
        table_row(eq, count)

    h2("Top 20 — By Target Muscle")
    table_row("Muscle", "Count")
    table_row("---", "---")
    for m, count in dist["by_target_muscle"].items():
        table_row(m, count)

    # --- Completeness ---
    h2("Completeness")
    comp = results["completeness"]
    mf = comp["missing_fields"]
    ml = comp["missing_languages"]
    if not mf and not ml:
        para("All records have required fields and all language instructions present.")
    else:
        if mf:
            para(f"Records with missing fields: **{len(mf)}**")
            for rec_id, fields in list(mf.items())[:10]:
                para(f"  - id={rec_id}: {fields}")
        if ml:
            para(f"Records with missing language instructions: **{len(ml)}**")
            for rec_id, langs in list(ml.items())[:10]:
                para(f"  - id={rec_id}: {langs}")

    # --- Uniqueness ---
    h2("Uniqueness")
    dupes = results["uniqueness"]["duplicate_ids"]
    if dupes:
        para(f"Duplicate IDs found: **{len(dupes)}**")
        for id_, count in dupes.items():
            para(f"  - id={id_}: appears {count} times")
    else:
        para("No duplicate IDs found.")

    # --- Consistency ---
    h2("Consistency")
    inv_bp = results["consistency"]["invalid_body_parts"]
    if inv_bp:
        para(f"Records with invalid body_part values: **{len(inv_bp)}**")
        for rec_id, bp in list(inv_bp.items())[:10]:
            para(f"  - id={rec_id}: {bp!r}")
    else:
        para("All body_part values match allowed enum.")

    # --- Referential integrity ---
    h2("Referential Integrity (Media Files)")
    ref = results["referential"]
    para(f"- Missing images: **{ref['missing_images_count']}**")
    if ref["missing_images_sample"]:
        para(f"  Sample: {ref['missing_images_sample']}")
    para(f"- Missing GIFs: **{ref['missing_gifs_count']}**")
    if ref["missing_gifs_sample"]:
        para(f"  Sample: {ref['missing_gifs_sample']}")

    # --- Summary ---
    h2("Summary")
    total_issues = (
        len(comp["missing_fields"])
        + len(comp["missing_languages"])
        + len(dupes)
        + len(inv_bp)
        + ref["missing_images_count"]
        + ref["missing_gifs_count"]
    )
    if total_issues == 0:
        para("Dataset passed all quality checks.")
    else:
        para(f"Total issues found: **{total_issues}**. Review sections above for details.")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def run_quality_checks(report_path: Path | None = None) -> dict:
    log.info("Loading dataset for quality checks...")
    with EXERCISES_JSON.open(encoding="utf-8") as f:
        records = json.load(f)

    log.info("Running checks on %d records...", len(records))

    results = {
        "completeness": check_completeness(records),
        "uniqueness": check_uniqueness(records),
        "consistency": check_consistency(records),
        "referential": check_referential_integrity(records),
        "distribution": check_distribution(records),
    }

    report_text = build_report(results)

    if report_path:
        report_path.write_text(report_text, encoding="utf-8")
        log.info("Quality report written to: %s", report_path)
    else:
        print(report_text)

    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")

    parser = argparse.ArgumentParser(description="FitData Hub data quality checker")
    parser.add_argument(
        "--report",
        type=Path,
        default=None,
        help="Write markdown report to this file path (default: stdout)",
    )
    args = parser.parse_args()

    results = run_quality_checks(report_path=args.report)

    # Exit with error code if issues found
    total_issues = (
        len(results["completeness"]["missing_fields"])
        + len(results["completeness"]["missing_languages"])
        + len(results["uniqueness"]["duplicate_ids"])
        + len(results["consistency"]["invalid_body_parts"])
        + results["referential"]["missing_images_count"]
        + results["referential"]["missing_gifs_count"]
    )
    sys.exit(0 if total_issues == 0 else 1)
