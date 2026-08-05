"""
EDA 02 — Muscle Co-occurrence & Network Analysis
=================================================
Phân tích cơ nào thường xuất hiện cùng nhau:
  - Co-occurrence matrix (heatmap)
  - Network graph of muscle relationships
  - Muscle pairing frequency table
  - Insight: which muscles are "best friends"?

Run:
    python da_notebooks/02_muscle_correlation.py
    python da_notebooks/02_muscle_correlation.py --save
"""

import argparse
import json
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
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
    "axes.titlesize": 13,
    "axes.titleweight": "bold",
    "axes.titlepad": 12,
})


# ---------------------------------------------------------------------------
# 1. Build muscle co-occurrence data
# ---------------------------------------------------------------------------

def build_cooccurrence(records: list[dict]) -> tuple[Counter, dict]:
    """
    For each exercise, collect all muscles (target + secondary).
    Count how often each pair appears in the same exercise.
    """
    pair_counter: Counter = Counter()
    muscle_freq: Counter = Counter()

    for rec in records:
        muscles = set()
        target = rec.get("target", "")
        if target:
            muscles.add(target.strip().lower())

        for sec in rec.get("secondary_muscles", []):
            muscles.add(sec.strip().lower())

        # Count individual muscle frequency
        for m in muscles:
            muscle_freq[m] += 1

        # Count all pairs
        for m1, m2 in combinations(sorted(muscles), 2):
            pair_counter[(m1, m2)] += 1

    return pair_counter, muscle_freq


# ---------------------------------------------------------------------------
# 2. Build co-occurrence matrix
# ---------------------------------------------------------------------------

def build_matrix(
    pair_counter: Counter,
    muscle_freq: Counter,
    top_n: int = 20,
) -> tuple[np.ndarray, list[str]]:
    """Build a square co-occurrence matrix for the top N muscles."""
    top_muscles = [m for m, _ in muscle_freq.most_common(top_n)]

    size = len(top_muscles)
    matrix = np.zeros((size, size), dtype=int)
    muscle_idx = {m: i for i, m in enumerate(top_muscles)}

    for (m1, m2), count in pair_counter.items():
        if m1 in muscle_idx and m2 in muscle_idx:
            i, j = muscle_idx[m1], muscle_idx[m2]
            matrix[i, j] = count
            matrix[j, i] = count  # symmetric

    # Diagonal = self-frequency
    for m, freq in muscle_freq.items():
        if m in muscle_idx:
            i = muscle_idx[m]
            matrix[i, i] = freq

    return matrix, top_muscles


# ---------------------------------------------------------------------------
# 3. Analysis output
# ---------------------------------------------------------------------------

def print_analysis(pair_counter: Counter, muscle_freq: Counter) -> None:
    print(f"\n{'=' * 60}")
    print("  FitData Hub — Muscle Co-occurrence Analysis (EDA 02)")
    print(f"{'=' * 60}")

    print(f"\n[MUSCLE FREQUENCY] Top 20 most targeted muscles:")
    print(f"  {'Rank':<6} {'Muscle':<30} {'Exercises':>10}  {'Pct':>7}")
    print("  " + "-" * 57)
    total_pairs = sum(muscle_freq.values())
    for rank, (muscle, count) in enumerate(muscle_freq.most_common(20), 1):
        bar = "█" * min(20, count // 5)
        print(f"  {rank:<6} {muscle:<30} {count:>10}  {bar}")

    print(f"\n[CO-OCCURRENCE] Top 20 most common muscle pairs:")
    print(f"  {'Rank':<6} {'Muscle A':<22} {'Muscle B':<22} {'Together':>10}")
    print("  " + "-" * 64)
    for rank, ((m1, m2), count) in enumerate(pair_counter.most_common(20), 1):
        print(f"  {rank:<6} {m1:<22} {m2:<22} {count:>10}")

    # Insight: which muscles are most "connected"?
    muscle_connections: Counter = Counter()
    for (m1, m2), count in pair_counter.items():
        muscle_connections[m1] += 1
        muscle_connections[m2] += 1

    print(f"\n[CONNECTIVITY] Muscles with most unique pairing partners (top 10):")
    for muscle, partners in muscle_connections.most_common(10):
        print(f"  {muscle:<30} → {partners:>3} unique partner muscles")

    print()


# ---------------------------------------------------------------------------
# 4. Visualisation
# ---------------------------------------------------------------------------

def plot_heatmap(matrix: np.ndarray, labels: list[str], save: bool = False) -> None:
    """Render muscle co-occurrence heatmap."""
    fig, ax = plt.subplots(figsize=(14, 12))
    fig.patch.set_facecolor(IRON_PLATE["bg"])
    ax.set_facecolor(IRON_PLATE["surface"])

    # Custom colormap: dark → red
    cmap = mcolors.LinearSegmentedColormap.from_list(
        "iron_plate",
        [IRON_PLATE["surface"], "#7B1FA2", IRON_PLATE["red"], IRON_PLATE["gold"]],
    )

    im = ax.imshow(matrix, cmap=cmap, aspect="auto")

    # Labels
    ax.set_xticks(range(len(labels)))
    ax.set_yticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=8.5,
                       color=IRON_PLATE["muted"])
    ax.set_yticklabels(labels, fontsize=8.5, color=IRON_PLATE["muted"])

    # Annotations for top values
    threshold = matrix.max() * 0.4
    for i in range(len(labels)):
        for j in range(len(labels)):
            if matrix[i, j] > threshold and i != j:
                ax.text(j, i, str(matrix[i, j]),
                        ha="center", va="center",
                        fontsize=7, color="white", fontweight="bold")

    # Colorbar
    cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.ax.yaxis.set_tick_params(color=IRON_PLATE["muted"])
    plt.setp(cbar.ax.yaxis.get_ticklabels(), color=IRON_PLATE["muted"])
    cbar.set_label("Co-occurrence Count", color=IRON_PLATE["muted"], labelpad=10)

    ax.set_title(
        "Muscle Co-occurrence Matrix — Top 20 Muscles\n"
        "(How often muscles appear together in the same exercise)",
        color=IRON_PLATE["text"], fontsize=13,
    )

    plt.tight_layout()

    if save:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = OUTPUT_DIR / "02_muscle_heatmap.png"
        fig.savefig(out_path, dpi=150, bbox_inches="tight",
                    facecolor=IRON_PLATE["bg"])
        print(f"[SAVED] {out_path}")
    else:
        plt.show()
    plt.close(fig)


def plot_top_pairs(pair_counter: Counter, save: bool = False) -> None:
    """Bar chart of top 20 muscle pairs."""
    top_pairs = pair_counter.most_common(20)
    labels = [f"{m1} + {m2}" for (m1, m2), _ in top_pairs]
    values = [count for _, count in top_pairs]

    # Color gradient: gold for top, red for bottom
    colors = plt.cm.YlOrRd(np.linspace(0.4, 0.9, len(values)))[::-1]

    fig, ax = plt.subplots(figsize=(12, 8))
    fig.patch.set_facecolor(IRON_PLATE["bg"])
    ax.set_facecolor(IRON_PLATE["surface"])

    bars = ax.barh(labels[::-1], values[::-1], color=colors, edgecolor="none")
    ax.set_title(
        "Top 20 Muscle Pairs — Most Common Co-occurrences\n"
        "(Which muscle combinations appear most frequently)",
        color=IRON_PLATE["text"],
    )
    ax.set_xlabel("Number of Exercises", color=IRON_PLATE["text"])
    ax.grid(axis="x", alpha=0.3)

    for bar, val in zip(bars, values[::-1]):
        ax.text(val + 0.5, bar.get_y() + bar.get_height() / 2,
                str(val), va="center", fontsize=9, color=IRON_PLATE["muted"])

    plt.tight_layout()

    if save:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = OUTPUT_DIR / "02_top_muscle_pairs.png"
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
    parser = argparse.ArgumentParser(description="EDA 02 — Muscle Co-occurrence")
    parser.add_argument("--save", action="store_true",
                        help="Save charts to docs/eda_outputs/")
    parser.add_argument("--top", type=int, default=20,
                        help="Number of top muscles for heatmap (default: 20)")
    args = parser.parse_args()

    with DATA_FILE.open(encoding="utf-8") as f:
        records = json.load(f)
    print(f"[LOAD] {len(records):,} records")

    pair_counter, muscle_freq = build_cooccurrence(records)
    print_analysis(pair_counter, muscle_freq)

    matrix, top_muscles = build_matrix(pair_counter, muscle_freq, top_n=args.top)
    plot_heatmap(matrix, top_muscles, save=args.save)
    plot_top_pairs(pair_counter, save=args.save)


if __name__ == "__main__":
    main()
