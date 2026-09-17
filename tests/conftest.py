"""Test harness: file-backed sqlite + stub LLM backend (dependency injection).

Production code always calls the backend interface; tests inject StubBackend
so no Azure credentials are needed. This is test seam design, not mock-mode
branching in the product.
"""
import json
import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_clarity.db")
os.environ.setdefault("DEV_AUTH_ALLOW_HEADER", "True")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest
from fastapi.testclient import TestClient

if os.path.exists("./test_clarity.db"):
    os.remove("./test_clarity.db")

from app.main import app  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.integrations.foundry.client import set_backend  # noqa: E402

Base.metadata.create_all(bind=engine)


class StubBackend:
    """Deterministic ChatBackend for tests, keyed by Foundry agent name."""

    def __init__(self):
        self.calls: list[dict] = []

    async def complete_json(self, *, agent: str, system: str, user: str) -> dict:
        self.calls.append({"agent": agent})
        if agent == "planner":
            return {"tasks": [
                {"task_type": "revision", "node_id": "sliding-window",
                 "duration_minutes": 8, "reason": "weak_spot",
                 "title": "Revise Sliding Window"},
                {"task_type": "problem", "node_id": "two-pointers",
                 "duration_minutes": 12, "reason": "company",
                 "title": "Stretch problem"}]}
        if agent == "question-generator":
            return {"title": "Double It (test variant)",
                    "statement": "Read an integer from stdin and print twice its value.",
                    "constraints": ["-10^9 <= n <= 10^9"],
                    "examples": [{"input": "21", "output": "42"}],
                    "test_cases": [{"input": "21", "output": "42"},
                                   {"input": "0", "output": "0"}],
                    "difficulty": "easy",
                    "topic_id": "sliding-window", "pattern": "sliding-window",
                    "expected_complexity": {"time": "O(1)", "space": "O(1)"}}
        if agent == "evaluator":
            try:
                payload = json.loads(user)
                jr = payload.get("judge_result", {})
                total, passed = jr.get("total", 0), jr.get("passed", 0)
                correctness = round(passed / total, 3) if total else 0.0
            except Exception:
                correctness = 1.0
            return {"correctness": correctness,
                    "error_type": "" if correctness >= 1.0 else "edge_case",
                    "approach_signature": "test",
                    "complexity_time": "O(1)", "complexity_space": "O(1)",
                    "explanation_quality": None, "communication_quality": None,
                    "feedback": "Test feedback.",
                    "mastery_signals": [{"pattern": "sliding-window",
                                         "correctness": correctness,
                                         "hints_used": 0, "solve_time_seconds": 60,
                                         "expected_time_seconds": 600,
                                         "confidence": 0.85,
                                         "explanation_quality": None}]}
        if agent == "interviewer":
            return {"utterance": "Walk me through your approach first.",
                    "hint_given": False}
        if agent == "company-intel":
            return {"company": "TestCo", "role": "",
                    "oa_patterns": ["array+hash", "two-pointers"],
                    "interview_patterns": ["explain-approach-aloud"],
                    "core_subjects": ["DBMS"], "difficulty": "medium",
                    "round_structure": ["OA", "interview"],
                    "sources": ["test-stub"], "last_verified": "2026-01-01",
                    "confidence": 0.6, "stale": False}
        raise AssertionError(f"unexpected agent: {agent}")


@pytest.fixture()
def stub():
    backend = StubBackend()
    set_backend(backend)
    yield backend
    set_backend(None)


@pytest.fixture()
def client(stub):
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def user(client):
    import uuid
    email = f"t-{uuid.uuid4().hex[:8]}@x.com"
    r = client.post("/api/v1/auth/register", json={"email": email, "name": "T"})
    assert r.status_code == 200, r.text
    uid = r.json()["user_id"]
    client.post("/api/v1/onboarding/initialize", headers={"X-User-Id": uid})
    return {"id": uid, "headers": {"X-User-Id": uid}}
