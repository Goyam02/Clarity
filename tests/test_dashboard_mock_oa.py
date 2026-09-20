"""Dashboard read model + Mock OA assessment lifecycle (frontend-facing)."""
import time


def test_dashboard_empty_state(client, user):
    """Fresh account (seeded at 0.5 mastery by onboarding/initialize): the score
    reflects the seed, never a fabricated '78' — and shape is complete."""
    r = client.get("/api/v1/dashboard", headers=user["headers"])
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["name"]
    assert data["target"]["company"]
    assert isinstance(data["target"]["daysLeft"], int)
    assert 0 <= data["clearScore"]["value"] <= 100
    assert data["clearScore"]["value"] == 50  # seed mastery 0.5, honest math
    assert data["today"]["topics"], "seeded nodes produce today's topics"
    assert data["sandbox"]["launchUrl"] == "/mock-oa"


def test_dashboard_reflects_mastery(client, user):
    """After a failed mastery update the score drops and the topic is flagged."""
    r0 = client.get("/api/v1/dashboard", headers=user["headers"])
    before = r0.json()["clearScore"]["value"]
    client.post("/api/v1/mastery/update", headers=user["headers"],
                json={"topic_id": "sliding-window", "correctness": 0.0})
    r = client.get("/api/v1/dashboard", headers=user["headers"])
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["clearScore"]["value"] < before, "a failed rep must lower the score"
    topics = data["today"]["topics"]
    assert topics, "weak topic should appear on today's plan"
    top = topics[0]
    for key in ("id", "label", "subject", "band", "rating", "priority",
                "reasons", "whySelected", "estimatedMinutes"):
        assert key in top
    assert top["band"] in ("weak", "developing", "strong")
    assert data["sandbox"]["poolTitle"].endswith("Question Pool")


def test_mock_oa_start_and_assessment(client, user):
    """Standalone start -> assessment payload with real generated problems."""
    r = client.post("/api/v1/mock-oa/start", headers=user["headers"], json={})
    assert r.status_code == 200, r.text
    started = r.json()
    assert started["session_id"]
    assert started["problems"], "start should generate problems"

    r2 = client.get(f"/api/v1/mock-oa/assessments/{started['session_id']}",
                    headers=user["headers"])
    assert r2.status_code == 200, r2.text
    a = r2.json()
    assert a["id"] == started["session_id"]
    assert a["durationMinutes"] >= 5
    assert len(a["problems"]) == len(started["problems"])
    p = a["problems"][0]
    assert p["title"] and p["statement"]
    assert set(p["starter"].keys()) == {"python", "java", "cpp"}
    assert a["company"]  # Practice fallback or a linked company

    # Session is user-scoped: another account cannot read it
    r3 = client.post("/api/v1/auth/register",
                     json={"email": f"other-{time.time()}@x.com", "name": "O"})
    other_headers = {"X-User-Id": r3.json()["user_id"]}
    r4 = client.get(f"/api/v1/mock-oa/assessments/{started['session_id']}",
                    headers=other_headers)
    assert r4.status_code == 404


def test_mock_oa_end_session(client, user):
    """End closes the session and returns a scored summary."""
    started = client.post("/api/v1/mock-oa/start", headers=user["headers"],
                          json={}).json()
    sid = started["session_id"]
    client.post(f"/api/v1/mock-oa/{sid}/events", headers=user["headers"],
                json={"event_type": "TAB_SWITCH", "payload": {"at": 1}})
    r = client.post(f"/api/v1/mock-oa/{sid}/end", headers=user["headers"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["session_id"] == sid
    assert body["distraction_events"] == 1
    assert "correctness" in body and "tests_passed" in body
    # Double end is a 409
    r2 = client.post(f"/api/v1/mock-oa/{sid}/end", headers=user["headers"])
    assert r2.status_code == 409
