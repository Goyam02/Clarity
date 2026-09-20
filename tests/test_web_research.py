"""Web research (Grounding with Bing Search) merged with the CSV corpus.

The data/company-corpus corpus stays authoritative; web findings are an augmentation layer.
Tests stub the web-research seam — no Azure credentials involved.
"""
import uuid

import pytest

from app.integrations.foundry import web_research


class StubWebResearch:
    def __init__(self):
        self.calls: list[dict] = []

    async def search_company(self, *, company: str, kind: str, limit: int) -> dict:
        self.calls.append({"company": company, "kind": kind, "limit": limit})
        if kind == "OA":
            # "LRU Cache" duplicates the ServiceNow CSV seed on purpose: merge
            # must dedupe it and keep the corpus copy.
            return {"problems": [
                {"title": "LRU Cache", "url": "https://leetcode.com/problems/lru-cache",
                 "difficulty": "Medium", "patterns": ["design"],
                 "source": "geeksforgeeks.org", "source_date": "2026-08"},
                {"title": "Rate Limiter Token Bucket",
                 "url": "https://example.com/rate-limiter", "difficulty": "Medium",
                 "patterns": ["design", "array-hash"],
                 "source": "reddit.com/r/cscareerquestions", "source_date": "2026-09"},
            ]}
        return {"questions": [
            {"question": "Walk me through designing incident routing for enterprise "
                         "customers.", "type": "system_design", "round": "Interview 2",
             "source": "glassdoor.com", "source_date": "2026-07"},
            {"question": "", "type": "concept", "round": "", "source": "x",
             "source_date": ""},  # empty -> must be dropped by normalization
        ]}


@pytest.fixture()
def web_stub():
    stub = StubWebResearch()
    web_research.set_web_research_backend(stub)
    yield stub
    web_research.set_web_research_backend(None)


# --- merge + normalization (companies lookup) ------------------------------


def test_companies_lookup_merges_csv_and_web(client, user, web_stub):
    r = client.get("/api/v1/companies/ServiceNow", headers=user["headers"])
    assert r.status_code == 200, r.text
    body = r.json()
    titles = [p["title"] for p in body["problems"]]
    assert titles.count("LRU Cache") == 1, "web duplicate of a CSV seed must be dropped"
    web_items = [p for p in body["problems"] if p["origin"] == "web"]
    assert any(p["title"] == "Rate Limiter Token Bucket" for p in web_items)
    assert all(p["origin"] in ("company_corpus", "web") for p in body["problems"])
    assert body["interview_questions"], "web interview questions must surface"
    q = body["interview_questions"][0]
    assert q["origin"] == "web" and q["type"] == "system_design"
    assert len(body["interview_questions"]) == 1, "empty questions are dropped"
    assert body["web_researched_at"]


def test_web_items_carry_citations(client, user, web_stub):
    body = client.get("/api/v1/companies/ServiceNow",
                      headers=user["headers"]).json()
    web_items = [p for p in body["problems"] if p["origin"] == "web"]
    assert all(p["source"] for p in web_items), "web items must cite where they came from"


# --- CODE RED wiring --------------------------------------------------------


def test_code_red_uses_web_problems_for_unknown_company(client, user, web_stub):
    h = user["headers"]
    r = client.post("/api/v1/code-red",
                    json={"company": "Zeta Corp", "job_description": "backend",
                          "time_available_minutes": 120, "round_type": "OA"},
                    headers=h)
    assert r.status_code == 200, r.text
    web_tasks = [t for t in r.json()["tasks"]
                 if t["detail"].get("source") == "web"]
    assert web_tasks, "web-researched [company] items must appear in the checklist"
    assert all(t["reason"] == "company" for t in web_tasks)
    assert all(t["title"] for t in r.json()["tasks"]), "tasks must persist titles"
    assert any("Rate Limiter" in t["title"] for t in web_tasks)
    assert all(t["detail"].get("citation") for t in web_tasks)


def test_code_red_interview_round_gets_web_questions(client, user, web_stub):
    h = user["headers"]
    r = client.post("/api/v1/code-red",
                    json={"company": "Zeta Corp", "job_description": "backend",
                          "time_available_minutes": 120, "round_type": "Interview"},
                    headers=h)
    assert r.status_code == 200, r.text
    tasks = r.json()["tasks"]
    explain = [t for t in tasks if t["type"] == "explain_back"
               and t["detail"].get("source") == "web"]
    assert explain, "Interview rounds must include web-sourced explain-back items"
    assert len(explain) <= 3
    assert any("incident routing" in t["title"] for t in explain)
    t0 = explain[0]
    assert t0["detail"]["question_type"] == "system_design"


def test_ttl_prevents_repeat_research(client, user, web_stub):
    h = user["headers"]
    company = f"TTL Corp {uuid.uuid4().hex[:6]}"  # unique -> deterministic first pass
    before = len(web_stub.calls)
    for _ in range(2):
        r = client.post("/api/v1/code-red",
                        json={"company": company, "job_description": "backend",
                              "time_available_minutes": 120, "round_type": "OA"},
                        headers=h)
        assert r.status_code == 200, r.text
    kinds = {c["kind"] for c in web_stub.calls[before:]}
    assert kinds == {"OA", "interview"}, "one research pass covers both kinds"
    assert len(web_stub.calls) - before == 2, \
        "second session within TTL must not re-research"


# --- unconfigured fallback (CSV-only, current behavior preserved) -----------


def test_unconfigured_falls_back_to_csv_only(client, user):
    # No web stub set and Foundry unconfigured in tests: CODE RED must still
    # build its checklist (CSV corpus + core + weak spots), with zero web items.
    # Unique company name -> pristine profile, immune to test-order coupling.
    company = f"Fallback Corp {uuid.uuid4().hex[:6]}"
    r = client.post("/api/v1/code-red",
                    json={"company": company, "job_description": "backend, SQL",
                          "time_available_minutes": 120, "round_type": "OA"},
                    headers=user["headers"])
    assert r.status_code == 200, r.text
    tasks = r.json()["tasks"]
    assert tasks, "CODE RED must still build a checklist without web research"
    assert not [t for t in tasks if t["detail"].get("source") == "web"]

    body = client.get(f"/api/v1/companies/{company.replace(' ', '%20')}",
                      headers=user["headers"]).json()
    assert body["problems"] == []
    assert body["interview_questions"] == []
    assert body["web_researched_at"] == ""
