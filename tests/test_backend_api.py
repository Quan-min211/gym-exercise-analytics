"""
Unit tests for FastAPI REST API endpoints.
"""

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "FitData Hub API"


def test_list_exercises(client):
    response = client.get("/api/exercises")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["total"] == 3
    assert len(data["items"]) == 3


def test_get_exercise_by_id(client):
    response = client.get("/api/exercises/ex_1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "ex_1"
    assert data["name"] == "Push Up"
    assert data["body_part"] == "chest"


def test_get_exercise_not_found(client):
    response = client.get("/api/exercises/non_existent")
    assert response.status_code == 404


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
    assert data["total_exercises"] == 3
    assert data["total_body_parts"] >= 1
