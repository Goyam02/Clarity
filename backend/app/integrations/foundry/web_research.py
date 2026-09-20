"""Live web research for company-specific questions (Grounding with Bing Search).

The standalone Bing Search APIs were retired (Aug 2025); Microsoft's sanctioned
replacement is "Grounding with Bing Search" — a tool attached to a deployed
Foundry agent in the portal. The agent with the tool attached performs the live
web lookup ("recent ServiceNow OA problems") and this module pulls structured,
source-cited results out of its JSON reply via the standard chat path in
client.py (single Azure touchpoint preserved).

Layering with the local corpus (prb_csv/companies/*.csv): the CSV corpus stays
the authoritative, deterministic seed; web findings are an augmentation merged
in services/web_corpus.py. Degradation is explicit and safe — when Foundry or
the web-research agent is not configured, lookups return [] and CODE RED runs
on the CSV corpus alone. Nothing is ever fabricated.
"""
from typing import Protocol

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.integrations.foundry.client import FoundryError, get_backend

log = get_logger(__name__)

OA_SYSTEM = """You research a company's hiring online assessments using live web search.
Find coding problems actually asked in this company's recent online assessments / hiring
tests, as reported by candidates or the company itself.
Return ONLY JSON:
{"problems": [{"title": str, "url": str, "difficulty": "Easy|Medium|Hard",
               "patterns": [str], "source": str, "source_date": "YYYY-MM" or ""}]}
Rules:
- "url" points at the problem (e.g. the LeetCode problem page) when known, else "".
- "source" is where you found the report (site name or URL) — required for every item.
- "patterns" are short lowercase topic labels (e.g. "sliding window", "hash table").
- Only include items you actually found in search results. Never invent problems.
- Return {"problems": []} if nothing credible is found."""

INTERVIEW_SYSTEM = """You research a company's interview questions using live web search.
Find questions asked in this company's recent interviews: coding questions, concept
questions (DBMS / OS / networks / OOP), system-design prompts, and behavioral prompts.
Return ONLY JSON:
{"questions": [{"question": str, "type": "coding|concept|system_design|behavioral",
                "round": str, "source": str, "source_date": "YYYY-MM" or ""}]}
Rules:
- "source" is where you found the report (site name or URL) — required for every item.
- "round" is the interview stage the report mentions, else "".
- Only include items you actually found in search results. Never invent questions.
- Return {"questions": []} if nothing credible is found."""


class WebResearchBackend(Protocol):
    async def search_company(self, *, company: str, kind: str, limit: int) -> dict:
        """kind: "OA" -> {"problems": [...]} | "interview" -> {"questions": [...]}."""
        ...


class FoundryWebResearchBackend:
    """Real web research: routes to the deployed agent that has Grounding with
    Bing Search attached. Uses the shared chat path (per-agent routing) so all
    Azure calls stay inside integrations/foundry/client.py."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    async def search_company(self, *, company: str, kind: str, limit: int) -> dict:
        system = OA_SYSTEM if kind == "OA" else INTERVIEW_SYSTEM
        key = "problems" if kind == "OA" else "questions"
        user = (f"Company: {company}\n"
                f"Find up to {limit} recent items. Today is 2026; prefer the last 12 months.")
        payload = await get_backend().complete_json(
            agent=self.settings.WEB_RESEARCH_AGENT, system=system, user=user)
        return payload if isinstance(payload, dict) else {key: []}


_web_backend: WebResearchBackend | None = None


def get_web_research_backend() -> WebResearchBackend | None:
    """Test seam (mirrors set_vision_backend): None means use the real Foundry
    path when configured, or no-op when not."""
    return _web_backend


def set_web_research_backend(backend: WebResearchBackend | None) -> None:
    global _web_backend
    _web_backend = backend


def web_research_configured(settings: Settings | None = None) -> bool:
    s = settings or get_settings()
    return bool(s.AZURE_FOUNDRY_PROJECT_ENDPOINT and s.WEB_RESEARCH_AGENT)


async def _research(company: str, kind: str, limit: int) -> dict:
    stub = get_web_research_backend()
    if stub is not None:
        return await stub.search_company(company=company, kind=kind, limit=limit)
    if not web_research_configured():
        return {}
    try:
        return await FoundryWebResearchBackend().search_company(
            company=company, kind=kind, limit=limit)
    except FoundryError as e:
        # Web findings are an augmentation: CSV corpus remains authoritative, so
        # a failed research pass degrades to corpus-only instead of failing the
        # user's crunch session. Logged loudly for observability.
        log.warning(f"web research ({kind}) failed for {company}: {e.message}")
        return {}


async def research_company_oa_problems(company: str, limit: int = 8) -> dict:
    """Raw agent payload: {"problems": [...]} ({} when unconfigured)."""
    return await _research(company, "OA", limit)


async def research_company_interview_questions(company: str, limit: int = 8) -> dict:
    """Raw agent payload: {"questions": [...]} ({} when unconfigured)."""
    return await _research(company, "interview", limit)
