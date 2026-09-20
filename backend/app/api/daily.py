"""Daily plan + log intake + concept cards (Home page backend, spec §4)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import ClarityError
from app.dependencies import get_current_user_id, get_db
from app.schemas import (CodeforcesConfirmIn, ConceptGradeIn, DailyLogIn,
                         DailyPlanRequest, PlanTaskStatusIn)
from app.services import codeforces_service
from app.workflows import daily as daily_wf

router = APIRouter()


@router.post("/plan")
async def create_plan(body: DailyPlanRequest, user_id: str = Depends(get_current_user_id),
                      db: Session = Depends(get_db)):
    return await daily_wf.build_daily_plan(db, user_id, body.mood, body.time_available)


@router.get("/plan")
def today_plan(user_id: str = Depends(get_current_user_id),
               db: Session = Depends(get_db)):
    """Today's plan (null when none generated yet — Home offers 'generate')."""
    return {"plan": daily_wf.get_today_plan(db, user_id)}


@router.patch("/plan/{plan_id}/task")
def patch_task(plan_id: str, body: PlanTaskStatusIn,
               user_id: str = Depends(get_current_user_id),
               db: Session = Depends(get_db)):
    result = daily_wf.set_task_status(db, user_id, plan_id, body.task_index, body.status)
    if result is None:
        raise ClarityError("PLAN_NOT_FOUND", "Plan or task not found", 404)
    return result


@router.post("/logs")
def manual_log(body: DailyLogIn, user_id: str = Depends(get_current_user_id),
               db: Session = Depends(get_db)):
    """'log what I studied outside this' — writes the Mastery Model immediately."""
    try:
        return daily_wf.log_manual(db, user_id, body.topic_id, body.title, body.link,
                                   body.notes, body.correctness, body.minutes_spent)
    except ValueError as e:
        raise ClarityError("TOPIC_NOT_FOUND", str(e), 404) from e


@router.get("/codeforces/recent")
async def codeforces_recent(user_id: str = Depends(get_current_user_id),
                            db: Session = Depends(get_db)):
    from app.models import Profile
    prof = db.query(Profile).filter(Profile.user_id == user_id).first()
    handle = prof.codeforces_handle if prof else ""
    if not handle:
        return {"handle": "", "submissions": []}
    status = await codeforces_service.get_user_status(handle, count=15)
    if "error" in status:
        return {"handle": handle, "submissions": [], "error": status["error"]}
    subs = status.get("recent", []) or []
    return {"handle": handle,
            "submissions": [{"id": s.get("id"), "problem": s.get("problem"),
                             "tags": s.get("tags", []), "verdict": s.get("verdict"),
                             "at": s.get("at")} for s in subs],
            "solved": status.get("solved", 0)}


@router.post("/logs/codeforces")
async def confirm_codeforces(body: CodeforcesConfirmIn,
                             user_id: str = Depends(get_current_user_id),
                             db: Session = Depends(get_db)):
    """Confirmed auto-pulled Codeforces submissions -> mastery updates."""
    results = []
    for s in body.submissions[:10]:
        topic = s.get("topic_id") or "sliding-window"
        try:
            r = daily_wf.log_manual(db, user_id, topic, str(s.get("problem", "")),
                                    "", f"Codeforces submission {s.get('id', '')}",
                                    1.0 if s.get("verdict") == "OK" else 0.3, 20)
            results.append(r)
        except ValueError:
            continue
    return {"logged": results}


@router.post("/concept-cards/grade")
async def grade_concept_card(body: ConceptGradeIn,
                             user_id: str = Depends(get_current_user_id),
                             db: Session = Depends(get_db)):
    """Explain-it-back grading (spec §4 content type 2) — agent-graded quality."""
    try:
        return await daily_wf.grade_concept_card(db, user_id, body.topic_id,
                                                 body.concept, body.explanation)
    except ValueError as e:
        raise ClarityError("TOPIC_NOT_FOUND", str(e), 404) from e
