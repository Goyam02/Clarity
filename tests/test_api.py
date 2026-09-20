"""API surface: health, graph, daily plan, code-red, companies."""
import pytest


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/api/v1/health").json() == {"status": "ok"}


def test_graph_shape(client, user):
    g = client.get("/api/v1/mastery/graph", headers=user["headers"])
    assert g.status_code == 200, g.text
    body = g.json()
    assert isinstance(body["nodes"], list) and len(body["nodes"]) >= 5
    n = body["nodes"][0]
    for k in ("id", "name", "category", "mastery", "effective_mastery",
              "importance", "staleness"):
        assert k in n, k


def test_daily_plan_modes(client, user):
    for mood in ("light", "normal", "push"):
        r = client.post("/api/v1/daily/plan",
                        json={"mood": mood, "time_available": 40},
                        headers=user["headers"])
        assert r.status_code == 200, r.text
        assert r.json()["tasks"]


def test_full_loop_plan_question_submit(client, user):
    h = user["headers"]
    gen = client.post("/api/v1/problems/generate",
                      json={"pattern": "sliding-window", "topic_id": "sliding-window"},
                      headers=h)
    assert gen.status_code == 200, gen.text
    pid = gen.json()["problem_id"]
    att = client.post("/api/v1/submissions/attempts", json={"problem_id": pid},
                      headers=h).json()
    sub = client.post("/api/v1/submissions",
                      json={"attempt_id": att["attempt_id"], "language": "python",
                            "source_code": "import sys\nprint(sys.stdin.read().strip())"},
                      headers=h)
    assert sub.status_code == 200, sub.text
    assert "judge" in sub.json() and "evaluation" in sub.json()


def test_code_red_and_clear_score(client, user):
    h = user["headers"]
    r = client.post("/api/v1/code-red",
                    json={"company": "ServiceNow", "job_description": "backend",
                          "time_available_minutes": 120, "round_type": "OA"},
                    headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["tasks"] and body["clear_score"]["score"] in range(0, 101)
    reasons = {t["reason"] for t in body["tasks"]}
    assert reasons <= {"weak_spot", "company", "core"}
    # [company] items come from the curated corpus with real problem URLs.
    company_items = [t for t in body["tasks"] if t["reason"] == "company"]
    assert company_items and all(t["detail"].get("url") for t in company_items)
    cs = client.get(f"/api/v1/code-red/{body['session_id']}/clear-score", headers=h)
    assert cs.status_code == 200 and "components" in cs.json()


def test_company_lookup_and_drift(client, user):
    r = client.get("/api/v1/companies/ServiceNow", headers=user["headers"])
    assert r.status_code == 200 and r.json()["oa_patterns"]
    d = client.get("/api/v1/companies/ServiceNow/drift", headers=user["headers"])
    assert d.status_code == 200 and "stale" in d.json()


def test_interview_flow(client, user):
    h = user["headers"]
    s = client.post("/api/v1/interviews", headers=h)
    assert s.status_code == 200, s.text
    sid = s.json()["session_id"]
    e = client.post(f"/api/v1/interviews/{sid}/events",
                    json={"event_type": "CANDIDATE_SPEECH",
                          "payload": {"text": "I'll use two pointers"}},
                    headers=h)
    assert e.status_code == 200
    t = client.get(f"/api/v1/interviews/{sid}/transcript", headers=h)
    assert t.status_code == 200 and len(t.json()["transcript"]) >= 1
    d = client.get(f"/api/v1/interviews/{sid}/debrief", headers=h)
    assert d.status_code == 200 and "correctness" in d.json()


def test_outcome_loop(client, user):
    r = client.post("/api/v1/outcomes",
                    json={"company": "ServiceNow", "result": "rejected",
                          "round": "OA"}, headers=user["headers"])
    assert r.status_code == 200, r.text
