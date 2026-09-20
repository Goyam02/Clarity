"""Onboarding: signals gather, calibration, focus/targets, platform pulls."""
import asyncio
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.errors import ClarityError
from app.core.logging import get_logger
from app.dependencies import get_current_user_id, get_db
from app.models import CalibrationRun, Company, Profile
from app.services import company_corpus
from app.workflows import calibration as cal
from app.workflows import onboarding as ob

log = get_logger(__name__)
router = APIRouter()


class SignalsIn(BaseModel):
    codeforces_handle: str = ""
    github_username: str = ""
    resume_blob_ref: str = ""
    leetcode_session: str = ""
    leetcode_csrf: str = ""
    leetcode_username: str = ""


@router.post("/signals")
async def signals(body: SignalsIn, user_id: str = Depends(get_current_user_id),
                  db: Session = Depends(get_db)):
    """Parallel extraction. LeetCode cookies (if given) are verified against
    the live API, persisted encrypted, and blended into the Mastery Model —
    see docs/plans/plan-leetcode-pulls.md."""
    leetcode_summary = None
    if body.leetcode_session and body.leetcode_csrf:
        from app.core.errors import ClarityError
        from app.services import platform_signals as ps
        try:
            leetcode_summary = await _connect_leetcode(
                db, user_id, body.leetcode_session, body.leetcode_csrf,
                body.leetcode_username)
        except ClarityError as e:
            ps.mark_leetcode_error(db, user_id, e.code)
            leetcode_summary = {"connected": False, "error": e.code,
                                "message": e.message}
    cf, gh, resume = await asyncio.gather(
        ob._cf(body.codeforces_handle), ob._gh(body.github_username),
        ob._resume(body.resume_blob_ref))
    # Persist codeforces signals into the Mastery Model + recent AC feed.
    from app.services import platform_signals as ps
    cf_summary = None
    if body.codeforces_handle and "error" not in (cf or {}):
        cf_summary = ps.ingest_codeforces(db, user_id, cf)
        # Also record recent AC problems so day-one activity shows up.
        from app.services import codeforces_service
        status = await codeforces_service.get_user_status(body.codeforces_handle, count=50)
        if "error" not in status:
            recent = [{"name": s.get("problem", ""),
                       "slug": s.get("problem", "").lower().replace(" ", "-"),
                       "timestamp": s.get("at", 0)}
                      for s in status.get("recent", []) if s.get("verdict") == "OK"]
            ps.record_recent_ac(db, user_id, "codeforces", recent,
                                handle=body.codeforces_handle)
    # Remember the codeforces handle for daily syncs even if pull failed.
    if body.codeforces_handle:
        prof = db.query(Profile).filter(Profile.user_id == user_id).first()
        if prof:
            prof.codeforces_handle = body.codeforces_handle
            db.commit()
    return {"codeforces": cf, "github": gh, "resume": resume,
            "leetcode": leetcode_summary, "codeforces_ingested": cf_summary}


async def _connect_leetcode(db: Session, user_id: str, session_cookie: str,
                            csrf_token: str, username: str = "") -> dict:
    """Verify tokens with a real pull, persist them encrypted, ingest signals.
    Shared by onboarding /signals and the settings connect route."""
    from app.services import leetcode_service as lc
    from app.services import platform_signals as ps
    from app.services.secret_box import get_secret_box

    profile = await lc.verify_tokens(session_cookie, csrf_token, username)
    box = get_secret_box()
    prof = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not prof:
        prof = Profile(user_id=user_id)
        db.add(prof)
        db.flush()
    prof.leetcode_session_encrypted = box.encrypt(session_cookie)
    prof.leetcode_csrf_encrypted = box.encrypt(csrf_token)
    prof.leetcode_username = profile.get("username", username)
    db.commit()
    summary = ps.persist_leetcode(db, user_id, profile,
                                  handle=profile.get("username", username))
    from app.services.leetcode_service import recent_activity_topics
    active = set(recent_activity_topics(profile.get("recent_ac", [])))
    blended = ps.ingest_topic_signals(db, user_id,
                                      profile.get("topic_solved", {}),
                                      active_topics=active)
    summary["blended"] = blended
    summary["connected"] = True
    return summary


@router.post("/initialize")
def initialize(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    count = ob.init_mastery(db, user_id)
    return {"initialized_nodes": count}


class FocusIn(BaseModel):
    current_focus: str = ""
    target_companies: list[str] = []
    placement_timeline: str = ""
    default_mood: str = "normal"
    codeforces_handle: str = ""
    github_username: str = ""


@router.post("/focus")
async def focus(body: FocusIn, user_id: str = Depends(get_current_user_id),
                db: Session = Depends(get_db)):
    prof = db.query(Profile).filter(Profile.user_id == user_id).first()
    if prof:
        prof.current_focus = body.current_focus
        prof.placement_timeline = body.placement_timeline
        prof.default_mood = body.default_mood
        prof.codeforces_handle = body.codeforces_handle
        prof.github_username = body.github_username
        prof.target_companies = body.target_companies[:5]
        prof.onboarding_complete = True
        db.commit()
        # Spec §5: node importance weighted by frequency in target companies' OAs.
        from app.models import MasteryNode
        nodes = db.query(MasteryNode).filter(MasteryNode.user_id == user_id).all()
        for n in nodes:
            n.importance_weight = company_corpus.boost_importance(
                n.importance_weight, prof.target_companies or [], n.topic_id)
        db.commit()
    # Preload company profiles in background (actually concurrent here).
    from app.workflows import code_red as cr
    preloaded = []
    for name in body.target_companies[:5]:
        try:
            _, profile, _ = await cr.get_or_build_company(db, user_id, name)
            preloaded.append({"company": name, "patterns": profile.oa_patterns})
        except Exception:
            pass
    return {"saved": True, "preloaded": preloaded}


@router.post("/calibration/start")
async def cal_start(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    run = cal.start_run(user_id)
    db.add(run)
    db.commit()
    db.refresh(run)
    return {"run_id": run.id, "question": await cal.next_question(run)}


class CalAnswer(BaseModel):
    run_id: str
    correct: bool
    solve_time: float = 600


@router.post("/calibration/answer")
async def cal_answer(body: CalAnswer, user_id: str = Depends(get_current_user_id),
               db: Session = Depends(get_db)):
    run = db.query(CalibrationRun).filter(
        CalibrationRun.id == body.run_id, CalibrationRun.user_id == user_id).first()
    if not run or run.status != "active":
        raise ClarityError("RUN_NOT_FOUND", "Calibration run not found or already completed", 404)
    step = cal.answer(run, body.correct, body.solve_time)
    db.commit()
    if step["done"]:
        # Persist calibration signals via MasteryEngine into nodes.
        from datetime import datetime, timezone
        from app.models import MasteryNode
        from app.services.mastery_engine import MasteryEngine
        from app.models import MasteryHistory
        summary = cal.summarize(run)
        for sig in summary["signals"]:
            node = db.query(MasteryNode).filter(
                MasteryNode.user_id == user_id, MasteryNode.topic_id == sig["pattern"]).first()
            if node:
                prev = node.mastery_score
                r = MasteryEngine.update(prev, 1.0 if sig["correct"] else 0.0,
                                         600, 600, 0, node.confidence)
                node.mastery_score = r.new_score
                node.last_seen = datetime.now(timezone.utc)
                db.add(MasteryHistory(user_id=user_id, mastery_node_id=node.id,
                                      previous_score=prev, new_score=r.new_score,
                                      delta=r.delta, source_type="CALIBRATION",
                                      source_id=run.id, reason="calibration"))
        db.commit()
        return {"done": True, "summary": cal.summarize(run)}
    db.commit()
    db.refresh(run)
    return {"done": False, "question": await cal.next_question(run)}
