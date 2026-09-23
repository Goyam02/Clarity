"""Calibration persists generated questions and can recover from Foundry errors."""
from unittest.mock import AsyncMock

from app.db.session import SessionLocal
from app.integrations.foundry.client import FoundryError
from app.models import CalibrationRun
from app.workflows.calibration import MAX_QUESTIONS, TOPICS


def test_calibration_failure_can_retry_without_skipping(client, user, stub, monkeypatch):
    started = client.post("/api/v1/onboarding/calibration/start", headers=user["headers"])
    assert started.status_code == 200, started.text
    run_id = started.json()["run_id"]
    with SessionLocal() as db:
        run = db.get(CalibrationRun, run_id)
        assert run.questions == [started.json()["question"]]

    body = {"run_id": run_id, "correct": True, "solve_time": 120}
    with monkeypatch.context() as m:
        m.setattr(stub, "complete_json", AsyncMock(side_effect=FoundryError(
            "Invalid JSON after repair", code="FOUNDRY_BAD_OUTPUT")))
        failed = client.post("/api/v1/onboarding/calibration/answer",
                             headers=user["headers"], json=body)
    assert failed.status_code == 502
    with SessionLocal() as db:
        run = db.get(CalibrationRun, run_id)
        assert run.current_index == 0
        assert run.current_difficulty == 2
        assert run.answers == []
        assert len(run.questions) == 1

    for index in range(MAX_QUESTIONS):
        answer = client.post("/api/v1/onboarding/calibration/answer",
                             headers=user["headers"], json=body)
        assert answer.status_code == 200, answer.text
        if index < MAX_QUESTIONS - 1:
            assert answer.json()["done"] is False
            assert answer.json()["question"]["index"] == index + 1
        else:
            assert answer.json()["done"] is True
            assert answer.json()["summary"]["total"] == MAX_QUESTIONS
            assert [s["pattern"] for s in answer.json()["summary"]["signals"]] == TOPICS
    with SessionLocal() as db:
        run = db.get(CalibrationRun, run_id)
        assert run.status == "completed"
        assert len(run.answers) == len(run.questions) == MAX_QUESTIONS


def test_failed_calibration_start_does_not_persist_run(client, user, stub, monkeypatch):
    monkeypatch.setattr(stub, "complete_json", AsyncMock(side_effect=FoundryError(
        "Invalid JSON after repair", code="FOUNDRY_BAD_OUTPUT")))
    failed = client.post("/api/v1/onboarding/calibration/start", headers=user["headers"])
    assert failed.status_code == 502
    with SessionLocal() as db:
        assert db.query(CalibrationRun).filter_by(user_id=user["id"]).count() == 0
