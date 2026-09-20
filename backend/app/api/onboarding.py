"""Onboarding: signals gather, calibration, focus/targets."""
import asyncio
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.errors import ClarityError
from app.dependencies import get_current_user_id, get_db
from app.models import CalibrationRun, Company, Profile
from app.services import company_corpus
from app.workflows import calibration as cal
from app.workflows import onboarding as ob

router = APIRouter()


class SignalsIn(BaseModel):
    codeforces_handle: str = ""
    github_username: str = ""
    resume_blob_ref: str = ""


@router.post("/signals")
async def signals(body: SignalsIn, user_id: str = Depends(get_current_user_id)):
    # Parallel extraction (asyncio.gather inside).
    return await ob.gather_signals(body.codeforces_handle, body.github_username,
                                   body.resume_blob_ref)


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
