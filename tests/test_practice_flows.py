"""Revision links, editable profiles, and approach-only interview lifecycle."""
import json
from datetime import datetime, timedelta, timezone

import pytest

from app.services.revision import CURATED


@pytest.mark.parametrize("topic", list(CURATED))
def test_revision_has_real_topic_links(client, user, topic):
    r = client.get(f"/api/v1/daily/revision/{topic}", headers=user["headers"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["topic_id"] == topic
    assert body["problems"]
    urls = [p["url"] for p in body["problems"]]
    assert len(urls) == len(set(urls))
    assert all(u.startswith("https://leetcode.com/problems/") for u in urls)


def test_revision_uses_target_company_and_unknown_topics_fail(client, user):
    h = user["headers"]
    client.post("/api/v1/users/me/companies", headers=h, json={"name": "ServiceNow"})
    r = client.get("/api/v1/daily/revision/sliding-window", headers=h)
    assert r.json()["company"] == "ServiceNow"
    assert r.json()["problems"][0]["source"] == "company_corpus"
    assert client.get("/api/v1/daily/revision/not-a-topic", headers=h).status_code == 404
    dashboard = client.get("/api/v1/dashboard", headers=h).json()
    assert dashboard["today"]["adaptiveSet"]
    assert all(p["url"] for p in dashboard["today"]["adaptiveSet"])


def test_profile_save_and_overview(client, user):
    h = user["headers"]
    target_date = (datetime.now(timezone.utc) + timedelta(days=18)).date().isoformat()
    r = client.patch("/api/v1/users/me/settings", headers=h, json={
        "name": "Practice Student", "skills": [" Python ", "Python", "", "SQL"],
        "projects": ["Interview coach"], "placement_timeline": target_date})
    assert r.status_code == 200, r.text
    overview = client.get("/api/v1/users/me/overview", headers=h).json()
    assert overview["profile"]["skills"] == ["Python", "SQL"]
    assert overview["profile"]["projects"] == ["Interview coach"]
    assert overview["stats"]["topics"] >= 10
    assert overview["stats"]["interviews"] == 0
    assert overview["recent_interviews"] == []
    assert client.get("/api/v1/dashboard", headers=h).json()["target"]["daysLeft"] == 18
    assert client.patch("/api/v1/users/me/settings", headers=h,
                        json={"skills": ["x"] * 41}).status_code == 422


def test_voice_events_do_not_trigger_second_interviewer(client, user, stub):
    h = user["headers"]
    sid = client.post("/api/v1/interviews", headers=h).json()["session_id"]
    body = {"event_type": "CANDIDATE_SPEECH", "response_mode": "record_only",
            "payload": {"text": "I would use a sliding window.", "client_event_id": "turn-1"}}
    for _ in range(2):
        r = client.post(f"/api/v1/interviews/{sid}/events", headers=h, json=body)
        assert r.status_code == 200, r.text
        assert r.json()["interviewer"] is None
    assert not any(c["agent"] == "interviewer" for c in stub.calls)
    transcript = client.get(f"/api/v1/interviews/{sid}/transcript", headers=h).json()["transcript"]
    assert len(transcript) == 1
    assert client.post(f"/api/v1/interviews/{sid}/events", headers=h,
                       json={"event_type": "DEBRIEF_COMPLETED"}).status_code == 400


def test_debrief_uses_conversation_and_is_saved_once(client, user, stub, monkeypatch):
    complete = stub.complete_json
    prompts = []

    async def capture(**kwargs):
        if kwargs["agent"] == "evaluator":
            prompts.append(json.loads(kwargs["user"]))
        return await complete(**kwargs)

    monkeypatch.setattr(stub, "complete_json", capture)
    h = user["headers"]
    sid = client.post("/api/v1/interviews", headers=h).json()["session_id"]
    for kind, payload in [
        ("SESSION_STARTED", {"mode": "practice", "pattern": "sliding-window"}),
        ("QUESTION_ASKED", {"question": "Find the longest unique substring.", "pattern": "sliding-window"}),
        ("CANDIDATE_SPEECH", {"text": "Move the left boundary past duplicates using a set, in linear time."}),
    ]:
        r = client.post(f"/api/v1/interviews/{sid}/events", headers=h,
                        json={"event_type": kind, "payload": payload, "response_mode": "record_only"})
        assert r.status_code == 200, r.text
    first = client.get(f"/api/v1/interviews/{sid}/debrief", headers=h)
    assert first.status_code == 200, first.text
    again = client.get(f"/api/v1/interviews/{sid}/debrief", headers=h)
    assert first.json() == again.json()
    assert len(prompts) == 1
    assert prompts[0]["judge_result"] is None
    assert prompts[0]["mode"] == "spoken_approach"
    assert len(prompts[0]["transcript"]) == 3
    assert "linear time" in prompts[0]["explanation"]
    overview = client.get("/api/v1/users/me/overview", headers=h).json()
    assert overview["stats"]["interviews"] == 1
    assert overview["stats"]["practice_updates"] == 1
    assert overview["recent_interviews"][0]["session_id"] == sid
    other = client.post("/api/v1/auth/register", json={"email": f"other-{sid}@x.com", "name": "Other"}).json()
    other_h = {"X-User-Id": other["user_id"]}
    assert client.get(f"/api/v1/interviews/{sid}/debrief", headers=other_h).status_code == 404
    assert client.get("/api/v1/users/me/overview", headers=other_h).json()["recent_interviews"] == []


def test_empty_interview_is_unscored(client, user, stub):
    h = user["headers"]
    sid = client.post("/api/v1/interviews", headers=h).json()["session_id"]
    r = client.get(f"/api/v1/interviews/{sid}/debrief", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["correctness"] is None
    assert r.json()["mastery_deltas"] == []
    assert not any(c["agent"] == "evaluator" for c in stub.calls)
