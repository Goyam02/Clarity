"""Mastery engine + history + decay."""
from app.services.mastery_engine import MasteryEngine


def test_correct_increases():
    r = MasteryEngine.update(0.58, 1.0, 480, 600, 0, 0.85)
    assert r.new_score > 0.58 and r.delta > 0


def test_incorrect_decreases():
    r = MasteryEngine.update(0.58, 0.0, 600, 600, 0, 0.85)
    assert r.new_score < 0.58 and r.delta < 0


def test_hints_reduce_gain():
    a = MasteryEngine.update(0.5, 1.0, 500, 600, 0, 0.85)
    b = MasteryEngine.update(0.5, 1.0, 500, 600, 3, 0.85)
    assert a.new_score > b.new_score


def test_decay_and_staleness():
    assert MasteryEngine.effective_mastery(0.8, 0) == 0.8
    assert MasteryEngine.effective_mastery(0.8, 30) < 0.8
    assert MasteryEngine.staleness(30) > MasteryEngine.staleness(1)


def test_history_recorded(client, user):
    r = client.post("/api/v1/mastery/update",
                    json={"topic_id": "sliding-window", "correctness": 1.0},
                    headers=user["headers"])
    assert r.status_code == 200, r.text
    node_id = r.json()["node_id"]
    h = client.get(f"/api/v1/mastery/history/{node_id}", headers=user["headers"])
    assert h.status_code == 200 and len(h.json()["history"]) >= 1
