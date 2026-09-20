"""Phase 1: CODE RED v2 (session get, task tick-up, mock OA) + weekly rhythm."""
import pytest


@pytest.fixture()
def cr_session(client, user):
    r = client.post("/api/v1/code-red",
                    json={"company": "ServiceNow", "job_description": "backend, SQL, APIs",
                          "time_available_minutes": 120, "round_type": "OA"},
                    headers=user["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def test_get_session_reload(client, user, cr_session):
    g = client.get(f"/api/v1/code-red/{cr_session['session_id']}", headers=user["headers"])
    assert g.status_code == 200, g.text
    body = g.json()
    assert body["company"] == "ServiceNow"
    assert body["tasks"] and body["clear_score"]["score"] in range(0, 101)

    missing = client.get("/api/v1/code-red/nope", headers=user["headers"])
    assert missing.status_code == 404


def test_clear_score_ticks_up_on_completion(client, user, cr_session):
    h = user["headers"]
    sid = cr_session["session_id"]
    before = cr_session["clear_score"]["score"]

    task = cr_session["tasks"][0]
    r = client.patch(f"/api/v1/code-red/{sid}/tasks/{task['id']}",
                     json={"status": "done"}, headers=h)
    assert r.status_code == 200, r.text
    after = r.json()["clear_score"]["score"]
    assert after >= before, "CLEAR SCORE must tick upward as items complete"

    # remaining time shrinks as budget is spent
    assert r.json()["remaining_time"] < cr_session["remaining_time"]


def test_mock_oa_flow(client, user, cr_session):
    h = user["headers"]
    sid = cr_session["session_id"]
    start = client.post(f"/api/v1/code-red/{sid}/mock-oa", headers=h)
    assert start.status_code == 200, start.text
    body = start.json()
    assert body["problems"] and body["duration_minutes"] >= 10

    mid = body["session_id"]
    ev = client.post(f"/api/v1/mock-oa/{mid}/events",
                     json={"event_type": "TAB_SWITCH", "payload": {"away_seconds": 4}},
                     headers=h)
    assert ev.status_code == 200 and ev.json()["recorded"] is True

    link = client.post(f"/api/v1/mock-oa/{mid}/link-attempt",
                       json={"event_type": "SUBMISSION_LINKED",
                             "payload": {"attempt_id": "fake"}}, headers=h)
    assert link.status_code == 200

    end = client.post(f"/api/v1/mock-oa/{mid}/end", headers=h)
    assert end.status_code == 200, end.text
    assert end.json()["distraction_events"] == 1

    again = client.post(f"/api/v1/mock-oa/{mid}/end", headers=h)
    assert again.status_code == 409


def test_weekly_schedule_skip_reschedule(client, user):
    h = user["headers"]
    week = client.get("/api/v1/weekly", headers=h)
    assert week.status_code == 200, week.text
    mocks = week.json()["mocks"]
    assert {m["kind"] for m in mocks} == {"OA", "Interview"}

    oa = next(m for m in mocks if m["kind"] == "OA")
    skip = client.post(f"/api/v1/weekly/{oa['id']}/skip", headers=h)
    assert skip.status_code == 200 and skip.json()["status"] == "skipped"

    interview = next(m for m in mocks if m["kind"] == "Interview")
    bad = client.post(f"/api/v1/weekly/{interview['id']}/reschedule",
                      json={"scheduled_for": "not-a-date"}, headers=h)
    assert bad.status_code == 400

    good = client.post(f"/api/v1/weekly/{interview['id']}/reschedule",
                       json={"scheduled_for": "2026-09-25T18:00:00+00:00"}, headers=h)
    assert good.status_code == 200 and good.json()["scheduled_for"].startswith("2026-09-25")

    missing = client.post("/api/v1/weekly/nope/skip", headers=h)
    assert missing.status_code == 404
