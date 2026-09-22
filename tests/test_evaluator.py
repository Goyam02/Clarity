"""Evaluator output validation and interview debrief regressions."""
import pytest
from pydantic import ValidationError

from app.schemas import EvaluationMasterySignal


@pytest.mark.parametrize("timing", [
    {},
    {"solve_time_seconds": None},
    {"expected_time_seconds": None},
    {"solve_time_seconds": None, "expected_time_seconds": None},
])
def test_unknown_evaluation_timing_uses_existing_defaults(timing):
    signal = EvaluationMasterySignal(**timing)
    assert signal.solve_time_seconds == 600
    assert signal.expected_time_seconds == 600
    assert EvaluationMasterySignal(**signal.model_dump()) == signal


def test_explicit_timing_is_preserved():
    signal = EvaluationMasterySignal(solve_time_seconds=0, expected_time_seconds=900.5)
    assert signal.solve_time_seconds == 0
    assert signal.expected_time_seconds == 900.5


@pytest.mark.parametrize("field", ["solve_time_seconds", "expected_time_seconds"])
def test_malformed_timing_still_fails_validation(field):
    with pytest.raises(ValidationError):
        EvaluationMasterySignal(**{field: "not a duration"})


def test_debrief_accepts_null_model_timing_without_retry(client, user, stub, monkeypatch):
    complete_json = stub.complete_json

    async def null_timing_output(**kwargs):
        output = await complete_json(**kwargs)
        if kwargs["agent"] == "evaluator":
            output["mastery_signals"][0].update(
                solve_time_seconds=None, expected_time_seconds=None)
        return output

    monkeypatch.setattr(stub, "complete_json", null_timing_output)
    h = user["headers"]
    session = client.post("/api/v1/interviews", headers=h)
    assert session.status_code == 200, session.text
    sid = session.json()["session_id"]
    client.post(f"/api/v1/interviews/{sid}/events", headers=h,
                json={"event_type": "SESSION_STARTED", "payload": {"pattern": "sliding-window"}})
    event = client.post(f"/api/v1/interviews/{sid}/events", headers=h,
                        json={"event_type": "CANDIDATE_SPEECH",
                              "payload": {"text": "I would use a sliding window."}})
    assert event.status_code == 200, event.text
    response = client.get(f"/api/v1/interviews/{sid}/debrief", headers=h)
    assert response.status_code == 200, response.text
    assert response.json()["feedback"] == "Test feedback."
    assert response.json()["mastery_deltas"]
    assert sum(c["agent"] == "evaluator" for c in stub.calls) == 1
