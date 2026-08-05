"""
EDA 01 — Dataset Exploration
=============================
Phân tích tổng quan bộ dữ liệu exercises.json:
  - Shape & column types
  - Distributions by body_part, equipment, target muscle
  - Missing value audit
  - Name uniqueness
  - Instruction language coverage

Run:
    python da_notebooks/01_dataset_exploration.py
    python da_notebooks/01_dataset_exploration.py --save
"""

import argparse
import json
from collections import Counter
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # non-interactive backend for headless runs
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = PROJECT_ROOT / "data" / "exercises.json"
OUTPUT_DIR = PROJECT_ROOT / "docs" / "eda_outputs"

SUPPORTED_LANGUAGES = ["en", "es", "it", "tr", "ru", "zh", "hi", "pl", "ko", "fr"]

IRON_PLATE = {
    "bg": "#111318",
    "surface": "#1e2028",
    "red": "#D32F2F",
    "gold": "#FFC107",
    "text": "#F5F5F5",
    "muted": "#B0B8C8",
    "grid": "#2a2d36",
}

plt.rcParams.update({
    "figure.facecolor": IRON_PLATE["bg"],
    "axes.facecolor": IRON_PLATE["surface"],
    "axes.edgecolor": IRON_PLATE["grid"],
    "axes.labelcolor": IRON_PLATE["text"],
    "xtick.color": IRON_PLATE["muted"],
    "ytick.color": IRON_PLATE["muted"],
    "text.color": IRON_PLATE["text"],
    "grid.color": IRON_PLATE["grid"],
    "grid.linewidth": 0.5,
    "font.family": "sans-serif",
    "axes.titlesize": 13,
    "axes.titleweight": "bold",
    "axes.titlepad": 12,
})


# ---------------------------------------------------------------------------
# 1. Load data
# ---------------------------------------------------------------------------

def load_data() -> list[dict]:
    print(f"\n{'=' * 60}")
    print("  FitData Hub — Dataset Exploration (EDA 01)")
    print(f"{'=' * 60}")
    with DATA_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    print(f"\n[LOAD] {len(data):,} records loaded from {DATA_FILE.name}")
    return data


# ---------------------------------------------------------------------------
# 2. Basic stats
# ---------------------------------------------------------------------------

def basic_stats(records: list[dict]) -> dict:
    fields = set()
    for rec in records:
        fields |= rec.keys()

    # Missing values per field
    missing = {}
    for field in sorted(fields):
        missing_count = sum(1 for r in records if field not in r or r[field] is None or r[field] == "")
        if missing_count:
            missing[field] = missing_count

    # Unique values
    unique_names = len({r["name"] for r in records})
    unique_ids = len({r["id"] for r in records})

    stats = {
        "total_records": len(records),
        "total_fields": len(fields),
        "unique_ids": unique_ids,
        "unique_names": unique_names,
        "duplicate_names": len(records) - unique_names,
        "missing_values": missing,
    }

    print("\n[BASIC STATS]")
    print(f"  Total records   : {stats['total_records']:,}")
    print(f"  Fields per record: {stats['total_fields']}")
    print(f"  Unique IDs      : {stats['unique_ids']:,}")
    print(f"  Unique names    : {stats['unique_names']:,}")
    print(f"  Duplicate names : {stats['duplicate_names']:,}")

    if missing:
        print("\n  Missing values by field:")
        for field, count in missing.items():
            pct = count / len(records) * 100
            print(f"    {field:<30} {count:>4} ({pct:.1f}%)")
    else:
        print("\n  No missing values found — dataset is complete!")

    return stats


# ---------------------------------------------------------------------------
# 3. Distributions
# ---------------------------------------------------------------------------

def distribution_analysis(records: list[dict]) -> dict:
    body_part_dist  = Counter(r.get("body_part", "unknown") for r in records)
    equipment_dist  = Counter(r.get("equipment", "unknown") for r in records)
    target_dist     = Counter(r.get("target", "unknown") for r in records)
    category_dist   = Counter(r.get("category", "unknown") for r in records)
    muscle_grp_dist = Counter(r.get("muscle_group", "unknown") for r in records)

    print("\n[DISTRIBUTIONS]")

    print(f"\n  Body Part ({len(body_part_dist)} unique):")
    for bp, count in body_part_dist.most_common():
        bar = "█" * (count // 10)
        print(f"    {bp:<20} {count:>4}  {bar}")

    print(f"\n  Category ({len(category_dist)} unique):")
    for cat, count in category_dist.most_common():
        pct = count / len(records) * 100
        print(f"    {cat:<20} {count:>4}  ({pct:.1f}%)")

    print(f"\n  Top 10 Equipment ({len(equipment_dist)} unique):")
    for eq, count in equipment_dist.most_common(10):
        pct = count / len(records) * 100
        print(f"    {eq:<25} {count:>4}  ({pct:.1f}%)")

    print(f"\n  Top 10 Target Muscles ({len(target_dist)} unique):")
    for m, count in target_dist.most_common(10):
        pct = count / len(records) * 100
        print(f"    {m:<25} {count:>4}  ({pct:.1f}%)")

    return {
        "body_part": dict(body_part_dist.most_common()),
        "equipment": dict(equipment_dist.most_common(20)),
        "target_muscle": dict(target_dist.most_common(20)),
        "category": dict(category_dist.most_common()),
        "muscle_group": dict(muscle_grp_dist.most_common()),
    }


# ---------------------------------------------------------------------------
# 4. Instruction language coverage
# ---------------------------------------------------------------------------

def language_coverage(records: list[dict]) -> dict:
    coverage = {}
    for lang in SUPPORTED_LANGUAGES:
        has_instr = sum(1 for r in records if lang in r.get("instructions", {}))
        has_steps = sum(1 for r in records if lang in r.get("instruction_steps", {}))
        coverage[lang] = {
            "instructions": has_instr,
            "instruction_steps": has_steps,
            "pct": has_instr / len(records) * 100,
        }

    print("\n[INSTRUCTION LANGUAGE COVERAGE]")
    print(f"  {'Lang':<6} {'Instructions':>14} {'Steps':>8} {'Coverage':>10}")
    print("  " + "-" * 42)
    for lang, data in coverage.items():
        bar = "▓" * int(data["pct"] / 5)
        print(f"  {lang:<6} {data['instructions']:>14,} {data['instruction_steps']:>8,}   {data['pct']:>6.1f}%  {bar}")

    return coverage


# ---------------------------------------------------------------------------
# 5. Secondary muscles analysis
# ---------------------------------------------------------------------------

def secondary_muscles_analysis(records: list[dict]) -> dict:
    sec_counts = [len(r.get("secondary_muscles", [])) for r in records]
    all_secondary = []
    for r in records:
        all_secondary.extend(r.get("secondary_muscles", []))

    sec_freq = Counter(all_secondary)

    print("\n[SECONDARY MUSCLES]")
    print(f"  Exercises with 0 secondary muscles : {sec_counts.count(0):,}")
    print(f"  Exercises with 1 secondary muscle  : {sec_counts.count(1):,}")
    print(f"  Exercises with 2+ secondary muscles: {sum(1 for c in sec_counts if c >= 2):,}")
    print(f"  Max secondary muscles in 1 exercise: {max(sec_counts)}")
    print(f"  Avg secondary muscles              : {sum(sec_counts) / len(sec_counts):.2f}")
    print(f"\n  Top 10 most common secondary muscles:")
    for muscle, count in sec_freq.most_common(10):
        pct = count / len(records) * 100
        print(f"    {muscle:<25} {count:>4} ({pct:.1f}%)")

    return {
        "counts": Counter(sec_counts),
        "most_common": dict(sec_freq.most_common(20)),
    }


# ---------------------------------------------------------------------------
# 6. Visualization
# ---------------------------------------------------------------------------

def plot_distributions(dists: dict, save: bool = False) -> None:
    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle(
        "FitData Hub — Exercise Dataset Distribution Analysis",
        fontsize=16, fontweight="bold", color=IRON_PLATE["text"], y=0.98,
    )
    fig.patch.set_facecolor(IRON_PLATE["bg"])

    # --- 1. Body Part ---
    ax = axes[0, 0]
    bp_data = dists["body_part"]
    labels, values = zip(*sorted(bp_data.items(), key=lambda x: x[1]))
    bars = ax.barh(labels, values, color=IRON_PLATE["red"], alpha=0.85, edgecolor="none")
    ax.set_title("Exercises by Body Part")
    ax.set_xlabel("Count")
    ax.xaxis.set_major_locator(mticker.MaxNLocator(integer=True))
    ax.grid(axis="x", alpha=0.4)
    for bar, val in zip(bars, values):
        ax.text(val + 1, bar.get_y() + bar.get_height() / 2, str(val),
                va="center", fontsize=9, color=IRON_PLATE["muted"])

    # --- 2. Top Equipment ---
    ax = axes[0, 1]
    eq_data = dict(list(dists["equipment"].items())[:12])
    labels, values = zip(*sorted(eq_data.items(), key=lambda x: x[1]))
    ax.barh(labels, values, color=IRON_PLATE["gold"], alpha=0.85, edgecolor="none")
    ax.set_title("Top Equipment Types")
    ax.set_xlabel("Count")
    ax.grid(axis="x", alpha=0.4)

    # --- 3. Top Target Muscles ---
    ax = axes[1, 0]
    muscle_data = dict(list(dists["target_muscle"].items())[:15])
    labels, values = zip(*sorted(muscle_data.items(), key=lambda x: x[1]))
    ax.barh(labels, values, color="#42A5F5", alpha=0.85, edgecolor="none")
    ax.set_title("Top 15 Target Muscles")
    ax.set_xlabel("Count")
    ax.grid(axis="x", alpha=0.4)

    # --- 4. Category Pie ---
    ax = axes[1, 1]
    cat_data = dists["category"]
    cat_colors = [IRON_PLATE["red"], IRON_PLATE["gold"], "#42A5F5", "#66BB6A", "#AB47BC"]
    wedges, texts, autotexts = ax.pie(
        cat_data.values(),
        labels=cat_data.keys(),
        colors=cat_colors[:len(cat_data)],
        autopct="%1.1f%%",
        startangle=90,
        textprops={"color": IRON_PLATE["text"]},
    )
    for at in autotexts:
        at.set_color(IRON_PLATE["bg"])
        at.set_fontweight("bold")
    ax.set_title("Exercise Categories")

    plt.tight_layout(rect=[0, 0, 1, 0.96])

    if save:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = OUTPUT_DIR / "01_distributions.png"
        fig.savefig(out_path, dpi=150, bbox_inches="tight",
                    facecolor=IRON_PLATE["bg"])
        print(f"\n[SAVED] {out_path}")
    else:
        plt.show()
    plt.close(fig)


# ---------------------------------------------------------------------------
# Summary report
# ---------------------------------------------------------------------------

def print_summary(stats: dict, dists: dict, lang_cov: dict) -> None:
    total = stats["total_records"]
    print(f"\n{'=' * 60}")
    print("  DATASET SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Records      : {total:,}")
    print(f"  Unique names : {stats['unique_names']:,} ({stats['unique_names']/total*100:.1f}% unique)")
    print(f"  Body parts   : {len(dists['body_part'])}")
    print(f"  Equipment    : {len(dists['equipment'])}")
    print(f"  Target muscles: {len(dists['target_muscle'])}")
    print(f"  Categories   : {len(dists['category'])}")

    fully_covered_langs = [
        lang for lang, cov in lang_cov.items() if cov["pct"] >= 99.0
    ]
    print(f"  Full language coverage ({len(fully_covered_langs)}/10): {', '.join(fully_covered_langs)}")

    largest_bp = max(dists["body_part"], key=dists["body_part"].get)
    smallest_bp = min(dists["body_part"], key=dists["body_part"].get)
    print(f"\n  Largest body part : {largest_bp} ({dists['body_part'][largest_bp]:,} exercises)")
    print(f"  Smallest body part: {smallest_bp} ({dists['body_part'][smallest_bp]:,} exercises)")
    print(f"  Imbalance ratio   : {dists['body_part'][largest_bp] / dists['body_part'][smallest_bp]:.1f}x")
    print(f"\n{'=' * 60}\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="EDA 01 — Dataset Exploration")
    parser.add_argument("--save", action="store_true",
                        help="Save charts to docs/eda_outputs/ instead of displaying")
    args = parser.parse_args()

    records = load_data()
    stats = basic_stats(records)
    dists = distribution_analysis(records)
    lang_cov = language_coverage(records)
    secondary_muscles_analysis(records)
    print_summary(stats, dists, lang_cov)
    plot_distributions(dists, save=args.save)


if __name__ == "__main__":
    main()
