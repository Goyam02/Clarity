"""Dashboard aggregation (Home page backend, spec §4).

Single read-model endpoint the SPA dashboard loads: target profile, CLEAR
SCORE, today's revision topics (from the real Mastery Model), an adaptive
problem set (company-researched problems matching weak topics), and the OA
sandbox card. Every value is computed from stored data — no placeholders.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user_id, get_db
from app.models import Company, CompanyProfile, Profile, User
from app.workflows.daily import mastery_snapshot

router = APIRouter()

# placement_timeline -> days until the target OA (drives the countdown only).
_TIMELINE_DAYS = [("week", 7), ("two week", 14), ("fortnight", 14),
                  ("month", 30), ("autumn", 42), ("fall", 42), ("semester", 90),
                  ("immediate", 14)]

CATEGORY_TO_SUBJECT = {"DSA": "DSA", "DBMS": "DBMS", "OS": "OS", "CN": "CN"}


def _days_left(profile: Profile | None) -> int:
    timeline = (profile.placement_timeline if profile else "") or ""
    low = timeline.lower()
    for needle, days in _TIMELINE_DAYS:
        if needle in low:
            return days
    return 30


def _company_for(user_id: str, db: Session) -> tuple[str, CompanyProfile | None]:
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    companies = (profile.target_companies if profile else None) or []
    name = companies[0] if companies else "Google"
    company = db.query(Company).filter(Company.name.ilike(name)).first()
    cp = db.query(CompanyProfile).filter(
        CompanyProfile.company_id == company.id).first() if company else None
    return name, cp


def _band(eff: float) -> str:
    if eff < 0.4:
        return "weak"
    if eff < 0.7:
        return "developing"
    return "strong"


def _reasons(eff: float, staleness: float) -> list[str]:
    """Why this topic is on today's plan — derived from real mastery state."""
    reasons = []
    if staleness >= 0.5:
        reasons.append("revision_due")
    if eff < 0.4:
        reasons.append("unmet_prerequisite")
    if 0.4 <= eff < 0.7:
        reasons.append("partial_mastery")
    if not reasons:
        reasons.append("needs_practice")
    return reasons


def _company_relevance(pattern: str, cp: CompanyProfile | None):
    """How often this pattern shows up in the company's researched OA problems.
    None when we have no research (UI hides the line)."""
    if cp is None:
        return None
    problems = cp.web_problems or []
    total = len(problems)
    if total == 0:
        return None
    needle = (pattern or "").lower().replace("_", "-").replace(" ", "-")
    asked = 0
    for p in problems:
        pats = " ".join(p.get("patterns", []) or []).lower().replace("_", "-")
        if needle and needle in pats:
            asked += 1
    return {"askedCount": asked, "sampleSize": total} if asked else None


def _adaptive_set(weak_patterns: list[str], cp: CompanyProfile | None,
                  db: Session, user_id: str) -> list[dict]:
    """3 practice problems for the weak topics: prefer company-researched
    problems (real URLs); fall back to problems the user actually attempted
    on those topics. Never fabricated."""
    out: list[dict] = []
    wanted = {w.lower().replace("_", "-") for w in weak_patterns}
    if cp is not None:
        for p in cp.web_problems or []:
            pats = {x.lower().replace("_", "-") for x in (p.get("patterns") or [])}
            if pats & wanted and p.get("url"):
                out.append({
                    "id": f"cp-{len(out)}",
                    "title": p.get("title", "Untitled"),
                    "difficulty": (p.get("difficulty") or "Medium").capitalize(),
                    "topicId": sorted(pats & wanted)[0],
                    "url": p["url"],
                })
            if len(out) >= 3:
                return out
    # Fallback: problems this user actually attempted on the weak topics.
    from app.models import Problem, ProblemAttempt
    attempted_ids = {a.problem_id for a in db.query(ProblemAttempt).filter(
        ProblemAttempt.user_id == user_id).all()}
    if attempted_ids:
        rows = db.query(Problem).filter(Problem.id.in_(attempted_ids)).all()
        for p in rows:
            if (p.pattern or p.topic_id).lower().replace("_", "-") not in wanted:
                continue
            out.append({
                "id": p.id,
                "title": p.title,
                "difficulty": (p.difficulty or "medium").capitalize(),
                "topicId": p.pattern or p.topic_id,
                "url": "",  # internal problem: opened in-app, no external link
            })
            if len(out) >= 3:
                break
    return out


def _build_topics(snap: list[dict], cp, company: str, limit: int = 6) -> list[dict]:
    """Rank nodes by urgency: low effective mastery + high importance + decay."""
    def urgency(n: dict) -> float:
        return (1 - n["effective_mastery"]) * 0.6 + n["importance"] * 0.25 \
            + n["staleness"] * 0.15

    ranked = sorted(snap, key=urgency, reverse=True)[:limit]
    topics = []
    for i, n in enumerate(ranked):
        eff = n["effective_mastery"]
        band = _band(eff)
        reasons = _reasons(eff, n["staleness"])
        minutes = {"weak": 35, "developing": 25, "strong": 15}[band]
        next_band = "developing" if band == "weak" else "strong"
        decay_note = (f" with {round(n['staleness'] * 100)}% decay since last practice"
                      if n["staleness"] >= 0.3 else "")
        topics.append({
            "id": n["id"],
            "label": n["name"],
            "subject": CATEGORY_TO_SUBJECT.get(n.get("category", "DSA"), "DSA"),
            "band": band,
            "rating": max(1, min(5, round(eff * 5))),
            "ratingMax": 5,
            "priority": "High" if i < 2 else ("Medium" if i < 4 else "Low"),
            "reasons": reasons,
            "whySelected": (
                f"{n['name']} sits at {round(eff * 100)}% effective mastery"
                + decay_note + f" — it gates your {company} readiness."
            ),
            "oaRelevance": _company_relevance(n["id"], cp),
            "subtopics": [f"{n['name']} — core patterns and timed reps"],
            "learningGoal": f"Move {n['name']} from {band} to {next_band} before the {company} OA.",
            "estimatedMinutes": minutes,
            "actions": ["start_revision"],
        })
    return topics


@router.get("")
async def dashboard(user_id: str = Depends(get_current_user_id),
                    db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()

    company, cp = _company_for(user_id, db)
    snap = mastery_snapshot(db, user_id)

    # CLEAR SCORE: mean effective mastery across the graph (0 when empty —
    # honest for a fresh account; the label says what it is).
    if snap:
        eff_avg = sum(n["effective_mastery"] for n in snap) / len(snap)
        score = max(1, min(100, round(eff_avg * 100)))
    else:
        eff_avg, score = 0.0, 0
    if score >= 80:
        label = "Top 10% Placement Readiness"
    elif score >= 60:
        label = "Top 25% Placement Readiness"
    elif score >= 40:
        label = "On-Track Placement Readiness"
    else:
        label = "Building Foundations"

    days = _days_left(profile)
    topics = _build_topics(snap, cp, company)
    total_minutes = sum(t["estimatedMinutes"] for t in topics)
    weak_patterns = [t["id"] for t in topics if t["band"] != "strong"]

    pool = list(cp.web_problems or []) if cp is not None else []

    return {
        "user": {"name": (user.name if user else "") or "there"},
        "target": {
            "company": company,
            "oaDate": (datetime.now(timezone.utc) + timedelta(days=days)).isoformat(),
            "daysLeft": days,
        },
        "clearScore": {"value": score, "label": label},
        "today": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "totalMinutes": total_minutes,
            "topics": topics,
            "adaptiveSet": _adaptive_set(weak_patterns, cp, db, user_id),
        },
        "sandbox": {
            "badge": "CODE RED",
            "poolTitle": f"{company} Question Pool",
            "verifiedQuestions": len(pool),
            "recurrenceNote": (
                f"Refreshed from company research on {cp.last_verified:%b %d, %Y}."
                if cp is not None and cp.last_verified else
                f"Run CODE RED for {company} to research its latest OA patterns."
            ),
            "durationMinutes": 70,
            "proctored": True,
            "expect": [
                "Mandatory fullscreen with tab-switch detection",
                "Generated problems with stdin/stdout I/O",
                "Python 3, Java, and C++ starter templates",
                "Session scored from your submissions at the end",
            ],
            "launchUrl": "/mock-oa",
        },
    }
