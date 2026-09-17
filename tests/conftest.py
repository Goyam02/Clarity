"""Test harness: file-backed sqlite, fresh per session, TestClient."""
import os
import sys

os.environ.setdefault("CLARITY_AI_MODE", "mock")
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

Base.metadata.create_all(bind=engine)


@pytest.fixture()
def client():
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
