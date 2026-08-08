"""
Tests for schedule CRUD endpoints — PUT (update) and DELETE,
plus edge cases missing from test_backend_api.py.
"""
import pytest


_SCHEDULE_PAYLOAD = {
    "name": "Full Body Plan",
    "schedule_type": "weekly",
    "days": [
        {
            "day_index": 0,
            "label": "Monday",
            "is_rest_day": False,
            "exercises": [
                {"exercise_id": "0001", "sets": 3, "reps": "10-12", "rest_seconds": 60}
            ],
        },
        {
            "day_index": 1,
            "label": "Tuesday",
            "is_rest_day": True,
            "exercises": [],
        },
    ],
}


def _create(client):
    """Helper: create a schedule and return the response JSON."""
    res = client.post("/api/schedules", json=_SCHEDULE_PAYLOAD)
    assert res.status_code == 201
    return res.json()


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------

def test_create_schedule_returns_correct_fields(client):
    data = _create(client)
    assert data["name"] == "Full Body Plan"
    assert data["schedule_type"] == "weekly"
    assert len(data["days"]) == 2
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_schedule_with_rest_day(client):
    data = _create(client)
    rest_days = [d for d in data["days"] if d["is_rest_day"]]
    assert len(rest_days) == 1
    assert rest_days[0]["label"] == "Tuesday"


def test_create_schedule_generates_unique_ids(client):
    id1 = _create(client)["id"]
    id2 = _create(client)["id"]
    assert id1 != id2


# ---------------------------------------------------------------------------
# READ
# ---------------------------------------------------------------------------

def test_get_schedule_returns_same_data(client):
    created = _create(client)
    fetched = client.get(f"/api/schedules/{created['id']}").json()
    assert fetched["id"] == created["id"]
    assert fetched["name"] == created["name"]
    assert len(fetched["days"]) == len(created["days"])


def test_get_schedule_404(client):
    res = client.get("/api/schedules/does-not-exist-abc123")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


# ---------------------------------------------------------------------------
# UPDATE (PUT)
# ---------------------------------------------------------------------------

def test_update_schedule_changes_name(client):
    created = _create(client)
    sid = created["id"]

    updated_payload = {
        **_SCHEDULE_PAYLOAD,
        "name": "Updated Power Plan",
    }
    res = client.put(f"/api/schedules/{sid}", json=updated_payload)
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Power Plan"


def test_update_schedule_changes_days(client):
    created = _create(client)
    sid = created["id"]

    new_payload = {
        "name": "Revised Plan",
        "schedule_type": "weekly",
        "days": [
            {
                "day_index": 0,
                "label": "Wednesday",
                "is_rest_day": False,
                "exercises": [
                    {"exercise_id": "0002", "sets": 4, "reps": "8-10", "rest_seconds": 90}
                ],
            }
        ],
    }
    res = client.put(f"/api/schedules/{sid}", json=new_payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["days"]) == 1
    assert data["days"][0]["label"] == "Wednesday"


def test_update_schedule_404(client):
    res = client.put("/api/schedules/nonexistent-xyz", json=_SCHEDULE_PAYLOAD)
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------

def test_delete_schedule_returns_204(client):
    created = _create(client)
    res = client.delete(f"/api/schedules/{created['id']}")
    assert res.status_code == 204


def test_delete_schedule_makes_it_unreachable(client):
    created = _create(client)
    sid = created["id"]
    client.delete(f"/api/schedules/{sid}")
    res = client.get(f"/api/schedules/{sid}")
    assert res.status_code == 404


def test_delete_schedule_404(client):
    res = client.delete("/api/schedules/never-existed-id")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def test_create_schedule_empty_name_rejected(client):
    bad_payload = {**_SCHEDULE_PAYLOAD, "name": ""}
    res = client.post("/api/schedules", json=bad_payload)
    assert res.status_code == 422  # Pydantic validation error


def test_create_schedule_invalid_type_rejected(client):
    bad_payload = {**_SCHEDULE_PAYLOAD, "schedule_type": "biweekly"}
    res = client.post("/api/schedules", json=bad_payload)
    assert res.status_code == 422
