# DA Notebooks — Data Analysis Scripts

Standalone Python analysis scripts for exploring the FitData Hub exercise dataset.
Each script prints insights to console and optionally saves charts to `docs/eda_outputs/`.

> **Note**: These are written as runnable Python scripts (not `.ipynb`) for CI-friendliness
> and easy version control diffing, while producing the same outputs as Jupyter notebooks.

## Setup

```bash
pip install matplotlib numpy
# Already included in de_pipeline/requirements.txt
```

## Scripts

### 01 — Dataset Exploration
```bash
python da_notebooks/01_dataset_exploration.py          # print only
python da_notebooks/01_dataset_exploration.py --save   # save charts
```

**Covers:**
- Total records, unique exercises, missing values audit
- Distribution by body part, equipment, target muscle, category
- Instruction language coverage (10 languages)
- Secondary muscle frequency analysis
- Imbalance ratio between largest / smallest body part

**Key Insight**: The dataset has a ~4x imbalance between the most and least represented
body parts, which directly informs recommendation engine scoring weights.

---

### 02 — Muscle Co-occurrence Analysis
```bash
python da_notebooks/02_muscle_correlation.py           # print only
python da_notebooks/02_muscle_correlation.py --save    # save charts
python da_notebooks/02_muscle_correlation.py --top 25  # larger heatmap
```

**Covers:**
- Muscle co-occurrence matrix heatmap (top N muscles)
- Top 20 most common muscle pairs
- Connectivity analysis: which muscles have the most pairing partners?

**Key Insight**: Identifies which muscles are "training partners" — pairs that consistently
appear together. This data backs the recommendation engine's muscle group clustering decisions.

---

### 03 — Recommendation Engine Coverage Analysis
```bash
python da_notebooks/03_recommendation_analysis.py          # print only
python da_notebooks/03_recommendation_analysis.py --save   # save charts
```

**Covers:**
- Exercise pool coverage per goal × equipment tier (minimal/home_gym/commercial)
- Gini coefficient to measure muscle balance per goal (0 = perfect, 1 = unequal)
- Body weight accessibility gap by body part
- Recommendations for data collection priorities

**Key Insight**: Some goals (e.g., `flexibility`) have significantly fewer body-weight
exercises available, creating coverage gaps for users without equipment.

---

## Output Charts

When run with `--save`, charts are saved to `docs/eda_outputs/`:

| File | Description |
|---|---|
| `01_distributions.png` | 4-panel distribution overview |
| `02_muscle_heatmap.png` | Co-occurrence heatmap |
| `02_top_muscle_pairs.png` | Top 20 muscle pairs bar chart |
| `03_coverage_radar.png` | Coverage radar by equipment tier |
| `03_body_weight_gap.png` | Body weight accessibility gap |

## Run All + Save

```bash
python da_notebooks/01_dataset_exploration.py --save
python da_notebooks/02_muscle_correlation.py --save
python da_notebooks/03_recommendation_analysis.py --save
```
