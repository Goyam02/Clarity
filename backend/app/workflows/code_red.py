"""CODE RED: JD parse + company intel + mastery diff -> Planner checklist.

Spec §6: JD gets parsed for role-specific signal; Company-Intel pulls/refreshes
the target profile; the Planner diffs the company's known patterns against the
Mastery Model; every checklist item is tagged WHY (weak_spot / company / core).
CLEAR SCORE ticks upward as checklist items are completed.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.agents.planner import PlannerAgent
from app.agents.interviewer import CompanyIntelAgent
from app.integrations.foundry.shims import iq_retrieve
from app.models import (CodeRedSession, CodeRedTask, Company, CompanyProfile,
                        Problem, Profile)
from app.services import clear_score as cs
from app.services import company_corpus
from app.services import web_corpus
from app.services.company_service import drift_status
from app.workflows.daily import mastery_snapshot

REASON_CODES = {"weak_spot", "company", "core"}


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
        # Refresh via the Company Intel agent (retrieval anchors included when
        # the search index is configured). Cost control: only when
        # stale/missing — never re-researched on every request.
        anchors = await iq_retrieve(f"{name} online assessment interview process")
        res = await CompanyIntelAgent().run(
            {"company": name, "anchors": anchors[:3]}, user_id=user_id,
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


def parse_jd(jd: str) -> dict:
    """Cheap deterministic JD signal extraction (spec §6 step 1)."""
    text = (jd or "").lower()
    signals = {
        "backend_heavy": any(k in text for k in ("backend", "api", "server", "microservice")),
        "sql_heavy": any(k in text for k in ("sql", "database", "dbms", "query")),
        "system_design": any(k in text for k in ("system design", "scalab", "architecture",
                                                 "distributed")),
        "core_cs": any(k in text for k in ("operating system", "network", "oop",
                                           "dbms", "concurrency")),
        "dsa_emphasis": any(k in text for k in ("data structure", "algorithm", "dsa",
                                                "problem solving", "coding")),
    }
    return {"signals": signals, "core_subjects": company_corpus.core_subjects_from_jd(jd)}


def score_for(db: Session, session_id: str, snap: list[dict],
              profile: CompanyProfile) -> dict:
    """CLEAR SCORE over live task completion state — ticks up as items complete."""
    tasks = db.query(CodeRedTask).filter(CodeRedTask.session_id == session_id).all()
    total = len(tasks) or 1
    done = sum(1 for t in tasks if t.status == "done")
    progress = done / total

    eff = [n["effective_mastery"] for n in snap] or [0.5]
    target = sum(eff) / len(eff)
    weak_hit = sum(1 for t in tasks if t.reason == "weak_spot" and t.status == "done")
    recent = min(1.0, 0.5 + 0.1 * weak_hit + 0.05 * progress)
    company_hit = sum(1 for t in tasks if t.reason == "company" and t.status == "done")
    align = min(1.0, 0.45 + 0.12 * company_hit + 0.1 * (profile.confidence or 0.5)
                + 0.05 * progress)
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
    jd_parse = parse_jd(jd)
    prof = db.query(Profile).filter(Profile.user_id == user_id).first()
    target_companies = (prof.target_companies or []) if prof else []

    per = max(10, budget // 6) if budget else 15
    tasks: list[dict] = []
    used = 0

    # [company] items: real problems for this company — curated CSV corpus first
    # (data/company-corpus, frequency order), then web-researched findings (Grounding with
    # Bing Search) not already covered. Spec's "known standard question for this
    # company"; every item carries its provenance.
    await web_corpus.ensure_web_research(db, profile, company.name)
    merged_problems = web_corpus.company_all_problems(profile, company.name, limit=8)
    for cp in merged_problems:
        company_count = sum(1 for t in tasks if t["reason"] == "company")
        # Interview rounds skew verbal (spec §6b): fewer raw problems, more
        # explain-back items from the interview-question block below.
        company_cap = 2 if round_type == "Interview" else 3
        if used + per > budget or company_count >= company_cap:
            break
        problem = db.query(Problem).filter(Problem.title == cp["title"]).first()
        detail = {"url": cp.get("url", ""), "difficulty": cp.get("difficulty", ""),
                  "frequency": cp.get("frequency", 0.0),
                  "source": cp.get("origin", "company_corpus"),
                  "citation": cp.get("source", "") if cp.get("origin") == "web" else ""}
        if cp.get("source_date"):
            detail["source_date"] = cp["source_date"]
        tasks.append({
            "type": "problem", "node_id": cp["patterns"][0] if cp["patterns"] else "",
            "duration_minutes": per, "reason": "company",
            "title": f"{cp['title']} — {company.name}-style",
            "problem_id": problem.id if problem else "",
            "detail": detail,
        })
        used += per

    # [core] items: JD-detected + profile core subjects (spec §6 step 1).
    core_subjects = list(profile.core_subjects or []) + jd_parse["core_subjects"]
    seen: set[str] = set()
    for core in core_subjects:
        key = str(core).lower()
        core_count = sum(1 for t in tasks if t["reason"] == "core")
        if key in seen or used + 10 > budget or core_count >= 2:
            continue
        seen.add(key)
        tasks.append({"type": "revision", "node_id": core, "duration_minutes": 10,
                      "reason": "core", "title": f"Core: {core}",
                      "problem_id": "", "detail": {"source": "jd_profile"}})
        used += 10

    # [company] interview questions: web-researched, source-cited. Interview
    # rounds skew verbal (spec §6b) — concept/design prompts instead of raw DSA.
    if round_type == "Interview":
        for q in web_corpus.company_interview_questions(profile, limit=3):
            if used + 10 > budget:
                break
            tasks.append({
                "type": "explain_back",
                "node_id": (profile.interview_patterns or [""])[0]
                if profile.interview_patterns else "",
                "duration_minutes": 10, "reason": "company",
                "title": q["question"], "problem_id": "",
                "detail": {"source": "web", "citation": q.get("url", ""),
                           "question_type": q.get("type", ""),
                           "round": q.get("round", ""),
                           "source_date": q.get("source_date", "")},
            })
            used += 10

    # [weak_spot] items: the Planner diffs mastery vs company patterns for the
    # remaining budget (spec §6 step 3).
    remaining = max(5, budget - used)
    weak = sorted(snap, key=lambda n: n["effective_mastery"])[:4]
    planner_used = 0
    try:
        from app.schemas import PlannerInput
        inp = PlannerInput(
            mastery_snapshot=snap, mood="push", time_available=remaining,
            company=company.name, job_description=jd, recent_activity=[])
        res = await PlannerAgent().run(inp.model_dump(), user_id=user_id,
                                       workflow="code_red", db=db)
        for t in res["output"].get("tasks", []):
            if planner_used + t.duration_minutes > remaining:
                break
            reason = t.reason if t.reason in REASON_CODES else "weak_spot"
            tasks.append({"type": t.task_type, "node_id": t.node_id,
                          "duration_minutes": t.duration_minutes, "reason": reason,
                          "title": t.title, "problem_id": t.problem_id,
                          "detail": {"source": "planner"}})
            planner_used += t.duration_minutes
    except Exception:
        # Planner unavailable (e.g. Foundry unconfigured): deterministic weak-spot
        # fallback so CODE RED still works — same tagging, same budget rules.
        for n in weak:
            if planner_used + per > remaining:
                break
            tasks.append({"type": "problem" if round_type == "OA" else "explain_back",
                          "node_id": n["id"], "duration_minutes": per,
                          "reason": "weak_spot",
                          "title": f"Fix weak spot: {n['name']}",
                          "problem_id": "", "detail": {"source": "mastery_diff"}})
            planner_used += per

    session = CodeRedSession(user_id=user_id, company_id=company.id, round_type=round_type,
                             job_description=jd, time_budget=budget, remaining_time=budget,
                             status="active", clear_score=0)
    db.add(session)
    db.commit()
    db.refresh(session)

    for i, t in enumerate(tasks):
        db.add(CodeRedTask(session_id=session.id, type=t["type"], node_id=t["node_id"],
                           problem_id=t.get("problem_id", ""),
                           title=t.get("title", "")[:500],
                           duration_minutes=t["duration_minutes"], reason=t["reason"],
                           priority=i, status="pending", detail=t.get("detail", {})))
    db.commit()

    s = score_for(db, session.id, snap, profile)
    session.clear_score = s["score"]
    db.commit()
    return {"session_id": session.id, "company": company.name, "round_type": round_type,
            "status": session.status, "time_budget": session.time_budget,
            "remaining_time": session.remaining_time,
            "tasks": session_tasks(db, session.id), "clear_score": s, "drift": drift,
            "jd_signals": jd_parse["signals"]}


def session_tasks(db: Session, session_id: str) -> list[dict]:
    rows = db.query(CodeRedTask).filter(CodeRedTask.session_id == session_id).order_by(
        CodeRedTask.priority).all()
    return [{"id": t.id, "type": t.type, "node_id": t.node_id, "problem_id": t.problem_id,
             "title": t.title, "duration_minutes": t.duration_minutes, "reason": t.reason,
             "priority": t.priority, "status": t.status, "detail": t.detail or {}}
            for t in rows]


def get_session_state(db: Session, user_id: str, session_id: str) -> dict | None:
    session = db.query(CodeRedSession).filter(
        CodeRedSession.id == session_id, CodeRedSession.user_id == user_id).first()
    if not session:
        return None
    company = db.query(Company).filter(Company.id == session.company_id).first()
    profile = db.query(CompanyProfile).filter(
        CompanyProfile.company_id == session.company_id).first()
    snap = mastery_snapshot(db, user_id)
    s = score_for(db, session.id, snap, profile) if profile else {
        "score": session.clear_score, "components": {}}
    session.clear_score = s["score"]
    db.commit()
    return {"session_id": session.id, "company": company.name if company else "",
            "round_type": session.round_type, "status": session.status,
            "time_budget": session.time_budget,
            "remaining_time": session.remaining_time,
            "tasks": session_tasks(db, session.id), "clear_score": s}


def set_task_status(db: Session, user_id: str, session_id: str, task_id: str,
                    status: str) -> dict | None:
    session = db.query(CodeRedSession).filter(
        CodeRedSession.id == session_id, CodeRedSession.user_id == user_id).first()
    if not session:
        return None
    task = db.query(CodeRedTask).filter(
        CodeRedTask.id == task_id, CodeRedTask.session_id == session_id).first()
    if not task:
        return None
    task.status = status
    if status == "done":
        spent = task.duration_minutes
        session.remaining_time = max(0, (session.remaining_time or 0) - spent)
    db.commit()
    return get_session_state(db, user_id, session_id)
