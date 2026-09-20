"""CSV corpus + live web research merge layer.

prb_csv/companies/*.csv stays the authoritative seed (deterministic, offline,
zero dependencies). Azure web research (Grounding with Bing Search, see
integrations/foundry/web_research.py) augments it with fresh, source-cited
findings.

Merge rules:
- CSV problems first (frequency order), then web problems not already present
  (dedupe on normalized title) — web items can never displace curated seed data.
- Every item carries `origin`: "company_corpus" | "web", so the frontend can
  label provenance.

Cost control: research runs at most once per WEB_RESEARCH_TTL_DAYS per company
(stamped on CompanyProfile.web_researched_at), mirroring the company-intel
drift policy. When web research is unconfigured, nothing is stamped — so the
very first configuration takes effect immediately.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.integrations.foundry import web_research
from app.models import CompanyProfile
from app.services import company_corpus

log = get_logger(__name__)

DEFAULT_WEB_LIMIT = 8
MAX_INTERVIEW_QUESTIONS = 3

VALID_QUESTION_TYPES = {"coding", "concept", "system_design", "behavioral"}


def _norm_title(title: str) -> str:
    return " ".join((title or "").lower().split())


def web_research_fresh(profile: CompanyProfile | None, ttl_days: int | None = None) -> bool:
    """True when the stored web findings are younger than the TTL."""
    if profile is None or profile.web_researched_at is None:
        return False
    ttl = ttl_days if ttl_days is not None else get_settings().WEB_RESEARCH_TTL_DAYS
    stamp = profile.web_researched_at
    if stamp.tzinfo is None:  # SQLite returns naive datetimes
        stamp = stamp.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - stamp
    return age < timedelta(days=ttl)


def normalize_web_problems(payload: dict, limit: int = DEFAULT_WEB_LIMIT) -> list[dict]:
    """Agent JSON -> normalized problem dicts. Drops malformed/empty items;
    never invents content."""
    out: list[dict] = []
    for p in (payload or {}).get("problems") or []:
        if not isinstance(p, dict):
            continue
        title = str(p.get("title") or "").strip()
        if not title:
            continue
        patterns = [str(x).strip().lower() for x in (p.get("patterns") or [])
                    if str(x).strip()]
        out.append({
            "title": title[:255],
            "url": str(p.get("url") or "").strip(),
            "difficulty": str(p.get("difficulty") or "").strip().lower(),
            "frequency": 0.0,
            "patterns": patterns or ["array-hash"],
            "origin": "web",
            "source": str(p.get("source") or "").strip(),
            "source_date": str(p.get("source_date") or "").strip(),
        })
        if len(out) >= limit:
            break
    return out


def normalize_web_questions(payload: dict, limit: int = DEFAULT_WEB_LIMIT) -> list[dict]:
    out: list[dict] = []
    for q in (payload or {}).get("questions") or []:
        if not isinstance(q, dict):
            continue
        text = str(q.get("question") or "").strip()
        if not text:
            continue
        qtype = str(q.get("type") or "").strip().lower()
        out.append({
            "question": text[:500],
            "type": qtype if qtype in VALID_QUESTION_TYPES else "concept",
            "round": str(q.get("round") or "").strip()[:64],
            "url": str(q.get("source") or "").strip(),
            "origin": "web",
            "source_date": str(q.get("source_date") or "").strip(),
        })
        if len(out) >= limit:
            break
    return out


async def ensure_web_research(db: Session, profile: CompanyProfile | None,
                              company_name: str) -> None:
    """Run web research for this company when stale; persist findings.

    Best-effort by design: never raises, and CODE RED works on the CSV corpus
    alone whenever research is unconfigured or fails.
    """
    if profile is None or web_research_fresh(profile):
        return
    if not web_research.web_research_configured() and \
            web_research.get_web_research_backend() is None:
        # Unconfigured and no test stub: CSV-only mode. Deliberately NOT stamped,
        # so enabling web research later takes effect immediately.
        return
    settings = get_settings()
    limit = DEFAULT_WEB_LIMIT
    try:
        problems = normalize_web_problems(
            await web_research.research_company_oa_problems(company_name, limit), limit)
        questions = normalize_web_questions(
            await web_research.research_company_interview_questions(company_name, limit),
            limit)
    except Exception as e:  # defensive: augmentation must never break CODE RED
        log.warning(f"web research failed for {company_name}: {e}")
        return
    profile.web_problems = problems
    profile.web_interview_questions = questions
    profile.web_researched_at = datetime.now(timezone.utc)
    db.commit()
    log.info(f"web research refreshed for {company_name}: "
             f"{len(problems)} problems, {len(questions)} interview questions")


def merge_problems(csv_problems: list[dict], web_problems: list[dict]) -> list[dict]:
    """CSV first (frequency order), then unseen web items; dedupe on title."""
    seen: set[str] = set()
    out: list[dict] = []
    for p in list(csv_problems) + list(web_problems):
        key = _norm_title(str(p.get("title") or ""))
        if not key or key in seen:
            continue
        seen.add(key)
        item = dict(p)
        item.setdefault("origin", "company_corpus")
        out.append(item)
    return out


def company_all_problems(profile: CompanyProfile | None, company_name: str,
                         limit: int = 10) -> list[dict]:
    """Merged company problem list (CSV seed + web findings), best first."""
    csv_problems = company_corpus.company_anchor_problems(company_name, limit=limit)
    web_problems = (profile.web_problems or []) if profile else []
    return merge_problems(csv_problems, web_problems)[:limit]


def company_interview_questions(profile: CompanyProfile | None,
                                limit: int = MAX_INTERVIEW_QUESTIONS) -> list[dict]:
    """Web-researched interview questions (empty until research runs)."""
    return list((profile.web_interview_questions or []) if profile else [])[:limit]
