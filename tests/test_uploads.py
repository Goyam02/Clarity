"""Phase 1: uploads (vision seam stubbed) + company corpus loader."""
import pytest

from app.integrations.foundry import vision
from app.services import company_corpus


class StubVision:
    def __init__(self):
        self.image_calls = 0
        self.text_calls = 0

    async def extract_image(self, image_data_uri: str, system: str) -> dict:
        assert image_data_uri.startswith("data:image/png;base64,")
        self.image_calls += 1
        return {"solved_counts": {"easy": 120, "medium": 240, "hard": 30, "total": 390},
                "topic_breakdown": [{"topic": "DP", "solved": 80}],
                "handle": "screenshot_user", "notes": ""}

    async def extract_text(self, text: str, system: str) -> dict:
        self.text_calls += 1
        return {"skills": ["Python", "SQL"], "projects": ["Clarity"],
                "summary": "2y python"}


@pytest.fixture()
def vision_stub():
    stub = StubVision()
    vision.set_vision_backend(stub)
    yield stub
    vision.set_vision_backend(None)


def test_screenshot_upload_extraction(client, user, vision_stub):
    h = user["headers"]
    r = client.post("/api/v1/uploads/screenshot",
                    files={"file": ("profile.png", b"\x89PNG fake bytes", "image/png")},
                    headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["solved_counts"]["total"] == 390
    assert body["blob_ref"].startswith("local://")
    assert vision_stub.image_calls == 1


def test_resume_upload_rejects_bad_pdf(client, user, vision_stub):
    h = user["headers"]
    r = client.post("/api/v1/uploads/resume",
                    files={"file": ("resume.pdf", b"not a real pdf", "application/pdf")},
                    headers=h)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "RESUME_UNREADABLE"


def test_upload_type_validation(client, user):
    r = client.post("/api/v1/uploads/screenshot",
                    files={"file": ("x.txt", b"hello", "text/plain")},
                    headers=user["headers"])
    assert r.status_code == 400


def test_unconfigured_vision_returns_actionable_error(client, user):
    r = client.post("/api/v1/uploads/screenshot",
                    files={"file": ("profile.png", b"\x89PNG", "image/png")},
                    headers=user["headers"])
    assert r.status_code == 500
    assert r.json()["error"]["code"] == "FOUNDRY_NOT_CONFIGURED"


# --- company corpus loader -------------------------------------------------


def test_corpus_known_company():
    assert company_corpus.known_company("ServiceNow")
    pats = company_corpus.company_anchor_patterns("ServiceNow")
    assert pats and "sliding-window" in pats
    probs = company_corpus.company_anchor_problems("ServiceNow", limit=5)
    assert probs and all(p["url"].startswith("https://leetcode.com") for p in probs)
    assert probs == sorted(probs, key=lambda p: -p["frequency"])


def test_corpus_unknown_company():
    assert not company_corpus.known_company("Not A Real Company XYZ")
    assert company_corpus.company_anchor_patterns("Not A Real Company XYZ") == []
    assert company_corpus.company_anchor_problems("Not A Real Company XYZ") == []
    assert company_corpus.company_importance("Not A Real Company XYZ") == {}


def test_corpus_name_variants():
    assert company_corpus.known_company("j.p. morgan") or company_corpus.known_company(
        "jpmorgan")


def test_corpus_importance_boost():
    boost = company_corpus.boost_importance(0.5, ["ServiceNow"], "sliding-window")
    assert boost > 0.5
    none = company_corpus.boost_importance(0.5, ["Not Real Co"], "sliding-window")
    assert none == 0.5


def test_jd_core_subjects():
    assert company_corpus.core_subjects_from_jd("Must know SQL and OS basics") == ["DBMS", "OS"]
    assert company_corpus.core_subjects_from_jd("frontend designer") == []
