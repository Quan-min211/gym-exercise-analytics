"""
EDA 03 — Recommendation Engine Coverage Analysis
=================================================
Phân tích chất lượng của recommendation engine:
  - Coverage: bao nhiêu % exercises được recommend theo goal?
  - Muscle balance: mỗi goal cover bao nhiêu nhóm cơ?
  - Equipment gap: nếu user chỉ có body weight, bỏ qua bao nhiêu?
  - Diversity score: kế hoạch 3 ngày có đa dạng không?
  - Gap analysis: body parts nào bị under-represented?

Run:
    python da_notebooks/03_recommendation_analysis.py
    python da_notebooks/03_recommendation_analysis.py --save
"""

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = PROJECT_ROOT / "data" / "exercises.json"
OUTPUT_DIR = PROJECT_ROOT / "docs" / "eda_outputs"

IRON_PLATE = {
    "bg": "#111318",
    "surface": "#1e2028",
    "red": "#D32F2F",
    "gold": "#FFC107",
    "text": "#F5F5F5",
    "muted": "#B0B8C8",
    "grid": "#2a2d36",
    "blue": "#42A5F5",
    "green": "#66BB6A",
    "purple": "#AB47BC",
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
    "font.family": "sans-serif",
    "axes.titlesize": 12,
    "axes.titleweight": "bold",
    "axes.titlepad": 10,
})

GOALS = ["build_muscle", "lose_weight", "improve_endurance", "flexibility", "general_fitness"]

GOAL_BODY_PART_PRIORITY = {
    "build_muscle":       ["chest", "back", "upper legs", "shoulders", "upper arms", "waist"],
    "lose_weight":        ["cardio", "waist", "upper legs", "chest", "back"],
    "improve_endurance":  ["cardio", "upper legs", "waist", "back"],
    "flexibility":        ["waist", "lower legs", "upper arms", "shoulders", "lower arms"],
    "general_fitness":    ["back", "chest", "upper legs", "waist", "shoulders", "cardio"],
}

EQUIPMENT_TIERS = {
    "minimal":    ["body weight"],
    "home_gym":   ["body weight", "dumbbell", "resistance band"],
    "commercial": ["body weight", "dumbbell", "barbell", "cable", "machine"],
}

ALL_BODY_PARTS = [
    "back", "cardio", "chest", "lower arms", "lower legs",
    "neck", "shoulders", "upper arms", "upper legs", "waist",
]


# ---------------------------------------------------------------------------
# 1. Exercise pool analysis
# ---------------------------------------------------------------------------

def analyze_coverage(records: list[dict]) -> dict:
    """For each goal × equipment combo, how many exercises are available?"""
    results = {}

    for goal, priority_bps in GOAL_BODY_PART_PRIORITY.items():
        goal_results = {}
        for tier, equipment_list in EQUIPMENT_TIERS.items():
            # Exercises matching equipment AND priority body parts
            matched = [
                r for r in records
                if r.get("equipment", "").lower() in equipment_list
                and r.get("body_part", "").lower() in priority_bps
            ]
            # Coverage = % of total exercises in those body parts
            available_for_goal = [
                r for r in records
                if r.get("body_part", "").lower() in priority_bps
            ]
            coverage_pct = len(matched) / len(available_for_goal) * 100 if available_for_goal else 0

            goal_results[tier] = {
                "count": len(matched),
                "available_for_goal": len(available_for_goal),
                "coverage_pct": coverage_pct,
                "muscle_groups": len({r.get("muscle_group") for r in matched}),
                "unique_equipment": len({r.get("equipment") for r in matched}),
            }
        results[goal] = goal_results

    return results


# ---------------------------------------------------------------------------
# 2. Body part gap analysis
# ---------------------------------------------------------------------------

def gap_analysis(records: list[dict]) -> dict:
    """Find under-represented body parts by equipment tier."""
    gaps = {}
    total = len(records)

    print("\n[GAP ANALYSIS] Body part availability by equipment tier:")
    print(f"  {'Body Part':<22} {'Total':>6} {'Body Weight':>12} {'Home Gym':>10} {'Commercial':>12}")
    print("  " + "-" * 66)

    for bp in sorted(ALL_BODY_PARTS):
        bp_records = [r for r in records if r.get("body_part", "").lower() == bp]
        tier_counts = {}

        for tier, equip_list in EQUIPMENT_TIERS.items():
            matched = [r for r in bp_records if r.get("equipment", "").lower() in equip_list]
            tier_counts[tier] = len(matched)

        gaps[bp] = {
            "total": len(bp_records),
            "tiers": tier_counts,
            "body_weight_pct": tier_counts.get("minimal", 0) / len(bp_records) * 100 if bp_records else 0,
        }

        print(
            f"  {bp:<22} {len(bp_records):>6} "
            f"{tier_counts.get('minimal', 0):>12} "
            f"{tier_counts.get('home_gym', 0):>10} "
            f"{tier_counts.get('commercial', 0):>12}"
        )

    return gaps


# ---------------------------------------------------------------------------
# 3. Muscle balance by goal
# ---------------------------------------------------------------------------

def muscle_balance(records: list[dict]) -> dict:
    """
    For each goal, compute how evenly distributed exercises are
    across the priority body parts.
    """
    balance_results = {}

    for goal, priority_bps in GOAL_BODY_PART_PRIORITY.items():
        matched = [
            r for r in records
            if r.get("body_part", "").lower() in priority_bps
        ]
        bp_dist = Counter(r.get("body_part", "").lower() for r in matched)

        counts = [bp_dist.get(bp, 0) for bp in priority_bps]
        total_count = sum(counts)
        ideal = total_count / len(priority_bps) if priority_bps else 0

        # Gini coefficient: 0 = perfectly equal, 1 = totally unequal
        sorted_counts = sorted(counts)
        n = len(sorted_counts)
        gini = 0.0
        if n > 1 and total_count > 0:
            cumulative = np.cumsum(sorted_counts)
            gini = 1 - 2 * np.sum(cumulative) / (n * total_count) + 1 / n

        balance_results[goal] = {
            "priority_bps": priority_bps,
            "distribution": dict(zip(priority_bps, counts)),
            "total_exercises": total_count,
            "gini_coefficient": round(gini, 3),
            "most_represented": max(priority_bps, key=lambda bp: bp_dist.get(bp, 0)),
            "least_represented": min(priority_bps, key=lambda bp: bp_dist.get(bp, 0)),
        }

    return balance_results


# ---------------------------------------------------------------------------
# 4. Print analysis
# ---------------------------------------------------------------------------

def print_coverage(coverage: dict, balance: dict) -> None:
    print(f"\n{'=' * 60}")
    print("  FitData Hub — Recommendation Engine Analysis (EDA 03)")
    print(f"{'=' * 60}")

    print("\n[COVERAGE] Exercises available per Goal × Equipment Tier:")
    print(f"  {'Goal':<22} {'Tier':<12} {'Exercises':>10} {'Muscle Grps':>12} {'Coverage%':>10}")
    print("  " + "-" * 70)

    for goal, tier_data in coverage.items():
        for tier, data in tier_data.items():
            print(
                f"  {goal:<22} {tier:<12} {data['count']:>10} "
                f"{data['muscle_groups']:>12} {data['coverage_pct']:>9.1f}%"
            )
        print()

    print("\n[MUSCLE BALANCE] Gini coefficient per goal (0=balanced, 1=unequal):")
    print(f"  {'Goal':<25} {'Gini':>6}  {'Most':<20} {'Least':<20}")
    print("  " + "-" * 75)
    for goal, data in balance.items():
        flag = " ✓" if data["gini_coefficient"] < 0.3 else " ⚠" if data["gini_coefficient"] < 0.5 else " ✗"
        print(
            f"  {goal:<25} {data['gini_coefficient']:>6.3f}{flag}  "
            f"{data['most_represented']:<20} {data['least_represented']:<20}"
        )

    print("\n[INSIGHTS]")
    most_unbalanced = max(balance, key=lambda g: balance[g]["gini_coefficient"])
    most_balanced = min(balance, key=lambda g: balance[g]["gini_coefficient"])
    print(f"  → Most balanced goal   : {most_balanced} (Gini={balance[most_balanced]['gini_coefficient']:.3f})")
    print(f"  → Most unbalanced goal : {most_unbalanced} (Gini={balance[most_unbalanced]['gini_coefficient']:.3f})")
    print(f"    Recommendation: add more '{balance[most_unbalanced]['least_represented']}' exercises")


# ---------------------------------------------------------------------------
# 5. Visualisation
# ---------------------------------------------------------------------------

def plot_coverage_radar(coverage: dict, save: bool = False) -> None:
    """Radar chart: exercise availability per goal × equipment tier."""
    tiers = list(EQUIPMENT_TIERS.keys())
    goals = list(coverage.keys())

    fig, axes = plt.subplots(1, 3, figsize=(15, 5), subplot_kw={"polar": True})
    fig.patch.set_facecolor(IRON_PLATE["bg"])
    fig.suptitle(
        "Recommendation Engine — Exercise Pool Coverage by Goal",
        fontsize=14, color=IRON_PLATE["text"], y=1.02,
    )

    goal_colors = [
        IRON_PLATE["red"], IRON_PLATE["gold"], IRON_PLATE["blue"],
        IRON_PLATE["green"], IRON_PLATE["purple"],
    ]

    angles = np.linspace(0, 2 * np.pi, len(goals), endpoint=False).tolist()
    angles += angles[:1]

    for ax, tier in zip(axes, tiers):
        ax.set_facecolor(IRON_PLATE["surface"])
        values = [coverage[g][tier]["coverage_pct"] for g in goals]
        values += values[:1]

        ax.plot(angles, values, color=IRON_PLATE["red"], linewidth=2)
        ax.fill(angles, values, color=IRON_PLATE["red"], alpha=0.25)
        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(
            [g.replace("_", "\n") for g in goals],
            fontsize=7.5, color=IRON_PLATE["muted"],
        )
        ax.set_ylim(0, 100)
        ax.set_yticks([25, 50, 75, 100])
        ax.set_yticklabels(["25%", "50%", "75%", "100%"], fontsize=7, color=IRON_PLATE["muted"])
        ax.grid(color=IRON_PLATE["grid"], linewidth=0.5)
        ax.spines["polar"].set_color(IRON_PLATE["grid"])
        ax.set_title(tier.replace("_", " ").title(), color=IRON_PLATE["text"], pad=15)

    plt.tight_layout()

    if save:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = OUTPUT_DIR / "03_coverage_radar.png"
        fig.savefig(out_path, dpi=150, bbox_inches="tight",
                    facecolor=IRON_PLATE["bg"])
        print(f"[SAVED] {out_path}")
    else:
        plt.show()
    plt.close(fig)


def plot_body_weight_gaps(gaps: dict, save: bool = False) -> None:
    """Bar chart: how many exercises are accessible with body weight only."""
    bps = sorted(gaps.keys())
    total = [gaps[bp]["total"] for bp in bps]
    bw_only = [gaps[bp]["tiers"]["minimal"] for bp in bps]

    x = np.arange(len(bps))
    width = 0.35

    fig, ax = plt.subplots(figsize=(12, 6))
    fig.patch.set_facecolor(IRON_PLATE["bg"])
    ax.set_facecolor(IRON_PLATE["surface"])

    bars1 = ax.bar(x - width / 2, total, width, label="All Equipment",
                   color=IRON_PLATE["muted"], alpha=0.6, edgecolor="none")
    bars2 = ax.bar(x + width / 2, bw_only, width, label="Body Weight Only",
                   color=IRON_PLATE["red"], alpha=0.9, edgecolor="none")

    ax.set_xticks(x)
    ax.set_xticklabels(bps, rotation=35, ha="right", fontsize=9)
    ax.set_ylabel("Number of Exercises")
    ax.set_title(
        "Body Weight Accessibility Gap by Body Part\n"
        "(How many exercises require equipment vs. no equipment needed)",
    )
    ax.legend(facecolor=IRON_PLATE["surface"], edgecolor=IRON_PLATE["grid"],
              labelcolor=IRON_PLATE["text"])
    ax.grid(axis="y", alpha=0.3)

    plt.tight_layout()

    if save:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = OUTPUT_DIR / "03_body_weight_gap.png"
        fig.savefig(out_path, dpi=150, bbox_inches="tight",
                    facecolor=IRON_PLATE["bg"])
        print(f"[SAVED] {out_path}")
    else:
        plt.show()
    plt.close(fig)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="EDA 03 — Recommendation Engine Analysis")
    parser.add_argument("--save", action="store_true",
                        help="Save charts to docs/eda_outputs/")
    args = parser.parse_args()

    with DATA_FILE.open(encoding="utf-8") as f:
        records = json.load(f)
    print(f"[LOAD] {len(records):,} records")

    coverage = analyze_coverage(records)
    balance = muscle_balance(records)
    gaps = gap_analysis(records)
    print_coverage(coverage, balance)
    plot_coverage_radar(coverage, save=args.save)
    plot_body_weight_gaps(gaps, save=args.save)


if __name__ == "__main__":
    main()
