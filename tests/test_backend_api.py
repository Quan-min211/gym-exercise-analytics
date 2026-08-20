"""
Unit tests for FastAPI REST API endpoints.
"""

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "FitData Hub API"
    assert "version" in data
    assert "uptime_seconds" in data
    assert "timestamp" in data


def test_list_exercises(client):
    response = client.get("/api/exercises")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["total"] == 5
    assert len(data["items"]) == 5


def test_get_exercise_by_id(client):
    response = client.get("/api/exercises/0001")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "0001"
    assert data["name"] == "Push Up"
    assert data["body_part"] == "chest"


def test_get_exercise_not_found(client):
    response = client.get("/api/exercises/non_existent")
    assert response.status_code == 404


def test_get_daily_exercise(client):
    response = client.get("/api/exercises/daily")
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert "name" in data
    assert "target" in data
    assert "equipment" in data
    assert "gif_url" in data

    # Verify deterministic behavior for a fixed date
    res1 = client.get("/api/exercises/daily?date=2026-08-20")
    res2 = client.get("/api/exercises/daily?date=2026-08-20")
    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json()["id"] == res2.json()["id"]


def test_exercise_filters(client):
    response = client.get("/api/exercises/filters")
    assert response.status_code == 200
    data = response.json()
    assert "body_parts" in data
    assert "equipment_types" in data
    assert "chest" in data["body_parts"]


def test_search_exercises(client):
    response = client.get("/api/exercises/search?q=Push")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert data["items"][0]["name"] == "Push Up"


def test_recommendation_endpoint(client):
    payload = {
        "goal": "build_muscle",
        "fitness_level": "intermediate",
        "available_equipment": ["body weight", "dumbbell"],
        "days_per_week": 3,
        "session_duration": 45
    }
    response = client.post("/api/recommend/weekly", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["goal"] == "build_muscle"
    assert len(data["days"]) == 3
    assert data["total_exercises"] > 0


def test_analytics_overview(client):
    response = client.get("/api/analytics/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["total_exercises"] == 5
    assert data["total_body_parts"] >= 1


def test_schedule_crud(client):
    payload = {
        "name": "My Test Plan",
        "schedule_type": "weekly",
        "days": [
            {
                "day_index": 0,
                "label": "Monday",
                "is_rest_day": False,
                "exercises": [
                    {
                        "exercise_id": "0001",
                        "sets": 3,
                        "reps": "10-12",
                        "rest_seconds": 60
                    }
                ]
            }
        ]
    }
    # Create schedule
    create_res = client.post("/api/schedules", json=payload)
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["name"] == "My Test Plan"
    schedule_id = created_data["id"]

    # Get schedule
    get_res = client.get(f"/api/schedules/{schedule_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == schedule_id

    # Get non-existent schedule
    get_404_res = client.get("/api/schedules/non_existent_id")
    assert get_404_res.status_code == 404


# ---------------------------------------------------------------------------
# Alternatives endpoint
# ---------------------------------------------------------------------------

def test_alternatives_returns_results(client):
    """Push Up (0001, pectorals, body weight) should have alternatives."""
    response = client.get("/api/exercises/0001/alternatives")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    # Should not include the source exercise itself
    ids = [ex["id"] for ex in data]
    assert "0001" not in ids


def test_alternatives_excludes_self(client):
    """Alternatives list must never include the source exercise."""
    response = client.get("/api/exercises/0001/alternatives")
    data = response.json()
    for ex in data:
        assert ex["id"] != "0001"


def test_alternatives_prioritises_different_equipment(client):
    """
    Dumbbell Fly (0004, dumbbell) should appear before Chest Dip (0005, body weight)
    when querying alternatives for Push Up (0001, body weight),
    because different equipment is ranked higher.
    """
    response = client.get("/api/exercises/0001/alternatives")
    data = response.json()
    names = [ex["name"] for ex in data]
    if "Dumbbell Fly" in names and "Chest Dip" in names:
        assert names.index("Dumbbell Fly") < names.index("Chest Dip")


def test_alternatives_404_for_nonexistent(client):
    """Should return 404 for a nonexistent exercise."""
    response = client.get("/api/exercises/9999/alternatives")
    assert response.status_code == 404


def test_alternatives_with_limit(client):
    """Limiting to 1 should return at most 1 result."""
    response = client.get("/api/exercises/0001/alternatives?limit=1")
    assert response.status_code == 200
    data = response.json()
    assert len(data) <= 1


def test_alternatives_no_results(client):
    """Squat (0003) targets quads — no other exercise targets quads, so empty list."""
    response = client.get("/api/exercises/0003/alternatives")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


# ---------------------------------------------------------------------------
# ETL History endpoint
# ---------------------------------------------------------------------------

def test_etl_history_returns_list(client):
    """ETL history endpoint should return a list (even if empty)."""
    response = client.get("/api/analytics/etl-history")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


# ---------------------------------------------------------------------------
# Muscle co-occurrence
# ---------------------------------------------------------------------------

def test_muscle_cooccurrence(client):
    """Muscle co-occurrence should return a list of pairs."""
    response = client.get("/api/analytics/muscle-cooccurrence?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


# ---------------------------------------------------------------------------
# Search edge cases
# ---------------------------------------------------------------------------

def test_search_no_results(client):
    """Searching for a non-existent term returns empty items."""
    response = client.get("/api/exercises/search?q=ZZZZZ_nonexistent")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert len(data["items"]) == 0


def test_search_case_insensitive(client):
    """Search should be case-insensitive."""
    response = client.get("/api/exercises/search?q=push")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any("Push" in ex["name"] for ex in data["items"])


def test_list_with_body_part_filter(client):
    """Filter exercises by body_part=chest should return only chest exercises."""
    response = client.get("/api/exercises?body_part=chest")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0
    for ex in data["items"]:
        # ExerciseSummary uses Field(alias="body_part_name")
        assert ex.get("body_part") == "chest" or ex.get("body_part_name") == "chest"
