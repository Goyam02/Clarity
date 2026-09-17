"""CODE RED + companies + interviews + outcomes endpoints."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import ClarityError
from app.dependencies import get_current_user_id, get_db
from app.models import CodeRedSession, CodeRedTask, Company, CompanyProfile, MockSession
from app.schemas import CodeRedRequest, InterviewEventIn, OutcomeIn
from app.services.company_service import drift_status
from app.workflows import code_red as cr

router_codered = APIRouter()
router_companies = APIRouter()
router_interviews = APIRouter()
router_outcomes = APIRouter()


@router_codered.post("")
async def create_code_red(body: CodeRedRequest, user_id: str = Depends(get_current_user_id),
                          db: Session = Depends(get_db)):
    return await cr.create_session(db, user_id, body.company, body.job_description,
                                   body.time_available_minutes, body.round_type)


@router_codered.get("/{session_id}/clear-score")
def clear_score(session_id: str, user_id: str = Depends(get_current_user_id),
                db: Session = Depends(get_db)):
    session = db.query(CodeRedSession).filter(
        CodeRedSession.id == session_id, CodeRedSession.user_id == user_id).first()
    if not session:
        raise ClarityError("SESSION_NOT_FOUND", "CODE RED session not found", 404)
    company = db.query(Company).filter(Company.id == session.company_id).first()
    profile = db.query(CompanyProfile).filter(
        CompanyProfile.company_id == session.company_id).first()
    from app.workflows.daily import mastery_snapshot
    snap = mastery_snapshot(db, user_id)
    tasks = [{"reason": t.reason} for t in db.query(CodeRedTask).filter(
        CodeRedTask.session_id == session_id).all()]
    s = cr.score_for(snap, tasks, profile) if profile else {"score": session.clear_score,
                                                            "components": {}}
    session.clear_score = s["score"]
    db.commit()
    return {"session_id": session_id, "company": company.name if company else "",
            **s}


@router_companies.get("/{name}")
async def company_lookup(name: str, user_id: str = Depends(get_current_user_id),
                         db: Session = Depends(get_db)):
    company, profile, drift = await cr.get_or_build_company(db, user_id, name)
    return {"company": company.name, "oa_patterns": profile.oa_patterns,
            "interview_patterns": profile.interview_patterns,
            "core_subjects": profile.core_subjects, "difficulty": profile.difficulty,
            "round_structure": profile.round_structure, "sources": profile.sources,
            "confidence": profile.confidence,
            "last_verified": profile.last_verified.isoformat() if profile.last_verified else "",
            "drift": drift}


@router_companies.get("/{name}/drift")
def company_drift(name: str, user_id: str = Depends(get_current_user_id),
                  db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.name.ilike(name)).first()
    profile = db.query(CompanyProfile).filter(
        CompanyProfile.company_id == company.id).first() if company else None
    return drift_status(profile.last_verified if profile else None)


@router_interviews.post("")
def create_interview(user_id: str = Depends(get_current_user_id),
                     db: Session = Depends(get_db)):
    from pydantic import BaseModel

    class _In(BaseModel):
        company: str = ""
        round_type: str = "Interview"
        problem_id: str = ""

    # Accept empty body too; read leniently via defaults.
    session = MockSession(user_id=user_id, round_type="Interview", status="active")
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": session.id, "status": session.status}


@router_interviews.post("/{session_id}/events")
async def post_event(session_id: str, body: InterviewEventIn,
                     user_id: str = Depends(get_current_user_id),
                     db: Session = Depends(get_db)):
    from app.models import InterviewEvent
    session = db.query(MockSession).filter(
        MockSession.id == session_id, MockSession.user_id == user_id).first()
    if not session:
        raise ClarityError("SESSION_NOT_FOUND", "Interview session not found", 404)
    db.add(InterviewEvent(session_id=session_id, event_type=body.event_type,
                          payload=body.payload))
    db.commit()
    interviewer_say = None
    if body.event_type in ("CANDIDATE_SPEECH", "HINT_REQUESTED", "CODE_CHANGED"):
        from app.workflows import mock_interview as mi
        hints = db.query(InterviewEvent).filter(
            InterviewEvent.session_id == session_id,
            InterviewEvent.event_type == "HINT_GIVEN").count()
        interviewer_say = await mi.interviewer_turn(
            (body.payload.get("problem_title", "the problem")
             if isinstance(body.payload, dict) else "the problem"),
            "followup" if body.event_type == "CODE_CHANGED" else "respond",
            int(body.payload.get("seconds_since_activity", 0))
            if isinstance(body.payload, dict) else 0, hints)
        if interviewer_say.get("hint_given"):
            db.add(InterviewEvent(session_id=session_id, event_type="HINT_GIVEN",
                                  payload={"text": interviewer_say["utterance"]}))
            db.commit()
    return {"recorded": True, "interviewer": interviewer_say}


@router_interviews.get("/{session_id}/transcript")
def get_transcript(session_id: str, user_id: str = Depends(get_current_user_id),
                   db: Session = Depends(get_db)):
    from app.workflows import mock_interview as mi
    s = db.query(MockSession).filter(
        MockSession.id == session_id, MockSession.user_id == user_id).first()
    if not s:
        raise ClarityError("SESSION_NOT_FOUND", "Interview session not found", 404)
    return {"session_id": session_id, "transcript": mi.transcript(db, session_id)}


@router_interviews.get("/{session_id}/debrief")
async def get_debrief(session_id: str, user_id: str = Depends(get_current_user_id),
                      db: Session = Depends(get_db)):
    from app.workflows import mock_interview as mi
    return await mi.debrief(db, session_id, user_id)


@router_outcomes.post("")
def log_outcome(body: OutcomeIn, user_id: str = Depends(get_current_user_id),
                db: Session = Depends(get_db)):
    from app.models import Outcome
    from app.workflows.daily import mastery_snapshot
    company = db.query(Company).filter(Company.name.ilike(body.company)).first()
    o = Outcome(user_id=user_id, company_id=company.id if company else "",
                role=body.role, round=body.round, result=body.result,
                mastery_snapshot={"nodes": mastery_snapshot(db, user_id)[:20]},
                notes=body.notes)
    db.add(o)
    db.commit()
    db.refresh(o)
    return {"outcome_id": o.id}


@router_outcomes.get("")
def list_outcomes(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    from app.models import Outcome
    rows = db.query(Outcome).filter(Outcome.user_id == user_id).order_by(
        Outcome.created_at.desc()).limit(50).all()
    return {"outcomes": [{"id": o.id, "role": o.role, "round": o.round,
                          "result": o.result} for o in rows]}
