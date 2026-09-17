"""CODE RED: company intel + mastery diff -> checklist + CLEAR SCORE."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.agents.interviewer import CompanyIntelAgent
from app.models import CodeRedSession, CodeRedTask, Company, CompanyProfile, MasteryNode
from app.services import clear_score as cs
from app.services.company_service import drift_status
from app.workflows.daily import mastery_snapshot


async def get_or_build_company(db: Session, user_id: str, name: str) -> tuple[Company, CompanyProfile, dict]:
    company = db.query(Company).filter(Company.name.ilike(name)).first()
    if not company:
        company = Company(name=name)
        db.add(company)
        db.commit()
        db.refresh(company)
    profile = db.query(CompanyProfile).filter(CompanyProfile.company_id == company.id).first()
    drift = drift_status(profile.last_verified if profile else None)
    if profile is None or drift["stale"]:
        # Refresh via agent (mock deterministic; azure calls Foundry). Cost control:
        # only when stale/missing or explicitly requested — never per request otherwise.
        res = await CompanyIntelAgent().run({"company": name}, user_id=user_id,
                                            workflow="code_red", db=db)
        out = res["output"]
        if profile is None:
            profile = CompanyProfile(company_id=company.id)
            db.add(profile)
        profile.role = out.get("role", "")
        profile.oa_patterns = out.get("oa_patterns", [])
        profile.interview_patterns = out.get("interview_patterns", [])
        profile.core_subjects = out.get("core_subjects", [])
        profile.difficulty = out.get("difficulty", "medium")
        profile.round_structure = out.get("round_structure", [])
        profile.sources = out.get("sources", ["agent"])
        profile.last_verified = datetime.now(timezone.utc)
        profile.confidence = out.get("confidence", 0.5)
        db.commit()
        db.refresh(profile)
        drift = drift_status(profile.last_verified)
    return company, profile, drift


def build_checklist(snap: list[dict], profile: CompanyProfile, budget: int,
                    round_type: str) -> list[dict]:
    weak = sorted(snap, key=lambda n: n["effective_mastery"])[:4]
    patterns = list(profile.oa_patterns or []) if round_type == "OA" else list(
        profile.interview_patterns or [])
    tasks: list[dict] = []
    used, pri = 0, 0
    per = max(10, budget // 6) if budget else 15
    for n in weak:
        if used + per > budget:
            break
        tasks.append({"type": "problem" if round_type == "OA" else "explain_back",
                      "node_id": n["id"], "duration_minutes": per,
                      "reason": "WEAK_SPOT", "priority": pri,
                      "title": f"Fix weak spot: {n['name']}"})
        used += per
        pri += 1
    for p in patterns[:3]:
        if used + per > budget:
            break
        tasks.append({"type": "problem", "node_id": p, "duration_minutes": per,
                      "reason": "COMPANY", "priority": pri,
                      "title": f"Company pattern: {p}"})
        used += per
        pri += 1
    for core in (profile.core_subjects or [])[:2]:
        if used + 10 > budget:
            break
        tasks.append({"type": "revision", "node_id": core, "duration_minutes": 10,
                      "reason": "CORE", "priority": pri, "title": f"Core: {core}"})
        used += 10
        pri += 1
    return tasks


def score_for(snap: list[dict], tasks: list[dict], profile: CompanyProfile) -> dict:
    if not snap:
        return cs.compute_clear_score().model_dump() if hasattr(
            cs.compute_clear_score(), "model_dump") else vars(cs.compute_clear_score())
    eff = [n["effective_mastery"] for n in snap]
    target = sum(eff) / len(eff)
    weak_hit = sum(1 for t in tasks if t["reason"] == "WEAK_SPOT")
    recent = min(1.0, 0.5 + 0.1 * weak_hit)
    company_hit = sum(1 for t in tasks if t["reason"] == "COMPANY")
    align = min(1.0, 0.45 + 0.12 * company_hit + 0.1 * (profile.confidence or 0.5))
    timed = 0.6
    core_cats = {"DBMS", "OS", "CN", "OOP"}
    core_vals = [n["effective_mastery"] for n in snap if n.get("category") in core_cats]
    core = sum(core_vals) / len(core_vals) if core_vals else 0.5
    r = cs.compute_clear_score(target, recent, align, timed, core)
    return {"score": r.score, "components": r.components}


async def create_session(db: Session, user_id: str, company_name: str, jd: str,
                         budget: int, round_type: str) -> dict:
    company, profile, drift = await get_or_build_company(db, user_id, company_name)
    snap = mastery_snapshot(db, user_id)
    tasks = build_checklist(snap, profile, budget, round_type)
    s = score_for(snap, tasks, profile)
    session = CodeRedSession(user_id=user_id, company_id=company.id, round_type=round_type,
                             job_description=jd, time_budget=budget, remaining_time=budget,
                             status="active", clear_score=s["score"])
    db.add(session)
    db.commit()
    db.refresh(session)
    for t in tasks:
        db.add(CodeRedTask(session_id=session.id, type=t["type"], node_id=t["node_id"],
                           duration_minutes=t["duration_minutes"], reason=t["reason"],
                           priority=t["priority"], status="pending"))
    db.commit()
    return {"session_id": session.id, "company": company.name, "tasks": tasks,
            "clear_score": s, "drift": drift}
