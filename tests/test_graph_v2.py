"""Phase 1: knowledge graph correlation edges, node detail, revise-now."""
import pytest


def _update(h, topic, correctness):
    return h, topic, correctness


def test_correlation_edges_appear_after_comovement(client, user):
    h = user["headers"]
    # Two nodes moving on the same day, twice each -> >= 2 co-occurrences.
    for topic in ("sliding-window", "two-pointers"):
        for _ in range(2):
            r = client.post("/api/v1/mastery/update",
                            json={"topic_id": topic, "correctness": 0.0},
                            headers=h)
            assert r.status_code == 200, r.text

    g = client.get("/api/v1/mastery/graph", headers=h)
    assert g.status_code == 200, g.text
    corr = [e for e in g.json()["edges"] if e["type"] == "CORRELATION"]
    assert corr, "expected at least one correlation edge"
    pair = {(e["from"], e["to"]) for e in corr}
    assert any({"sliding-window", "two-pointers"} == {a, b} for a, b in pair)
    assert all("co_occurrences" in e and e["co_occurrences"] >= 2 for e in corr)


def test_node_detail_panel(client, user):
    h = user["headers"]
    r = client.post("/api/v1/mastery/update",
                    json={"topic_id": "sliding-window", "correctness": 1.0}, headers=h)
    node_id = r.json()["node_id"]
    d = client.get(f"/api/v1/mastery/nodes/{node_id}", headers=h)
    assert d.status_code == 200, d.text
    body = d.json()
    for key in ("name", "category", "mastery", "effective_mastery", "last_seen",
                "times_attempted", "importance", "problems"):
        assert key in body, key
    assert body["name"] == "Sliding Window"

    missing = client.get("/api/v1/mastery/nodes/nope", headers=h)
    assert missing.status_code == 404


def test_revise_now_adds_task_to_today(client, user):
    h = user["headers"]
    r = client.post("/api/v1/mastery/update",
                    json={"topic_id": "dsu", "correctness": 0.0}, headers=h)
    node_id = r.json()["node_id"]

    rv = client.post("/api/v1/mastery/revise-now",
                     json={"node_db_id": node_id}, headers=h)
    assert rv.status_code == 200, rv.text
    tasks = rv.json()["tasks"]
    assert any(t["title"].startswith("Revise:") for t in tasks)

    plan = client.get("/api/v1/daily/plan", headers=h).json()["plan"]
    assert plan and any(t["title"].startswith("Revise:") for t in plan["tasks"])

    missing = client.post("/api/v1/mastery/revise-now",
                          json={"node_db_id": "nope"}, headers=h)
    assert missing.status_code == 404
