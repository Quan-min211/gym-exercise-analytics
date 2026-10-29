# FitData Hub — dbt Project (TiDB Cloud)

This dbt project manages analytical data modeling and transformation for **FitData Hub** on **TiDB Cloud Serverless**.

---

## 🏗️ Architecture

```
Raw TiDB Tables (via Python ETL)
├── exercises
├── body_parts
├── equipment_types
├── muscles
└── exercise_muscles
       │
       ▼
Staging Views (`stg_*`)
├── stg_exercises
├── stg_body_parts
├── stg_equipment
└── stg_muscles
       │
       ▼
Intermediate View (`int_*`)
└── int_exercise_muscles
       │
       ▼
Analytical Marts Tables (`dim_*`, `fct_*`, `mart_*`)
├── dim_exercises           (Enriched exercise catalog)
├── mart_muscle_cooccurrence (Co-occurrence matrix for heatmap)
├── fct_muscle_analytics    (Aggregated muscle stats)
└── fct_equipment_coverage  (Equipment coverage analysis)
```

---

## 🚀 Setup & Execution

### 1. Install dependencies

```bash
pip install -r dbt/requirements.txt
```

### 2. Configure Credentials

Create `~/.dbt/profiles.yml` (or copy from `dbt/profiles.yml.example`):

```yaml
fitdata_tidb:
  target: dev
  outputs:
    dev:
      type: tidb
      server: "<your-tidb-host>.tidbcloud.com"
      port: 4000
      schema: "fitdata"
      username: "<user>.root"
      password: "<password>"
```

Alternatively, use environment variables:
```bash
export TIDB_HOST="<your-tidb-host>.tidbcloud.com"
export TIDB_PORT="4000"
export TIDB_DATABASE="fitdata"
export TIDB_USER="<user>.root"
export TIDB_PASSWORD="<password>"
```

### 3. Run dbt Commands

From inside the `dbt/` folder:

```bash
cd dbt

# Verify connection
dbt debug

# Run transformations
dbt run

# Run data quality tests
dbt test

# Generate documentation
dbt docs generate
dbt docs serve
```

