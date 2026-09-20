"""Phase 1: daily plan retrieval, task status, manual logs, Codeforces pulls,
concept-card grading."""
import pytest


def test_get_today_plan_null_then_present(client, user):
    h = user["headers"]
    empty = client.get("/api/v1/daily/plan", headers=h)
    assert empty.status_code == 200 and empty.json()["plan"] is None

    made = client.post("/api/v1/daily/plan",
                       json={"mood": "normal", "time_available": 40}, headers=h)
    assert made.status_code == 200, made.text

    got = client.get("/api/v1/daily/plan", headers=h)
    plan = got.json()["plan"]
    assert plan and plan["plan_id"] == made.json()["plan_id"]
    assert plan["tasks"]


def test_plan_task_status_update(client, user):
    h = user["headers"]
    made = client.post("/api/v1/daily/plan",
                       json={"mood": "normal", "time_available": 40}, headers=h)
    plan_id = made.json()["plan_id"]
    r = client.patch(f"/api/v1/daily/plan/{plan_id}/task",
                     json={"task_index": 0, "status": "done"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["tasks"][0]["status"] == "done"

    bad = client.patch(f"/api/v1/daily/plan/{plan_id}/task",
                       json={"task_index": 99, "status": "done"}, headers=h)
    assert bad.status_code == 404


def test_manual_log_updates_mastery(client, user):
    h = user["headers"]
    r = client.post("/api/v1/daily/logs",
                    json={"topic_id": "sliding-window", "title": "Two Sum variant",
                          "link": "https://example.com/x", "correctness": 1.0,
                          "minutes_spent": 25}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["pattern"] == "sliding-window" and body["delta"] > 0

    unknown = client.post("/api/v1/daily/logs",
                          json={"topic_id": "quantum-foo", "correctness": 0.5}, headers=h)
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "TOPIC_NOT_FOUND"


def test_codeforces_recent_no_handle(client, user):
    r = client.get("/api/v1/daily/codeforces/recent", headers=user["headers"])
    assert r.status_code == 200 and r.json() == {"handle": "", "submissions": []}


def test_codeforces_confirm_logs(client, user):
    r = client.post("/api/v1/daily/logs/codeforces",
                    json={"handle": "tourist", "submissions": [
                        {"id": 1, "problem": "Watermelon", "verdict": "OK",
                         "topic_id": "sliding-window"},
                        {"id": 2, "problem": "Way Too Long Words", "verdict": "OK",
                         "topic_id": "two-pointers"}]},
                    headers=user["headers"])
    assert r.status_code == 200, r.text
    assert len(r.json()["logged"]) == 2


def test_concept_card_grading(client, user):
    h = user["headers"]
    r = client.post("/api/v1/daily/concept-cards/grade",
                    json={"topic_id": "dbms-indexing",
                          "concept": "B+ tree indexing",
                          "explanation": "A B+ tree keeps data in leaves and "
                                         "speeds up range scans via linked leaves."},
                    headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    for key in ("node_id", "previous", "new", "delta", "explanation_quality", "feedback"):
        assert key in body, key
