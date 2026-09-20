"""CODE RED + mock OA + weekly mocks + companies + interviews + outcomes."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import ClarityError
from app.dependencies import get_current_user_id, get_db
from app.models import (CodeRedSession, Company, CompanyProfile, MockSession,
                        Problem)
from app.schemas import (CodeRedRequest, CodeRedTaskStatusIn, InterviewEventIn,
                         MockEventIn, MockOAStartIn, OutcomeIn,
                         WeeklyRescheduleIn)
from app.services.company_service import drift_status
from app.services import web_corpus
from app.workflows import code_red as cr
from app.workflows import mock_oa, weekly

router_codered = APIRouter()
router_companies = APIRouter()
router_interviews = APIRouter()
router_outcomes = APIRouter()
router_weekly = APIRouter()
router_mock_oa = APIRouter()


@router_codered.post("")
async def create_code_red(body: CodeRedRequest, user_id: str = Depends(get_current_user_id),
                          db: Session = Depends(get_db)):
    return await cr.create_session(db, user_id, body.company, body.job_description,
                                   body.time_available_minutes, body.round_type)


@router_codered.get("/{session_id}")
def get_code_red(session_id: str, user_id: str = Depends(get_current_user_id),
                 db: Session = Depends(get_db)):
    """Reload a CODE RED session (checklist + live CLEAR SCORE) after refresh."""
    state = cr.get_session_state(db, user_id, session_id)
    if state is None:
        raise ClarityError("SESSION_NOT_FOUND", "CODE RED session not found", 404)
    return state


@router_codered.patch("/{session_id}/tasks/{task_id}")
def patch_code_red_task(session_id: str, task_id: str, body: CodeRedTaskStatusIn,
                        user_id: str = Depends(get_current_user_id),
                        db: Session = Depends(get_db)):
    """Check off checklist items — CLEAR SCORE ticks upward (spec §6a)."""
    state = cr.set_task_status(db, user_id, session_id, task_id, body.status)
    if state is None:
        raise ClarityError("SESSION_NOT_FOUND", "CODE RED session or task not found", 404)
    return state


@router_codered.post("/{session_id}/mock-oa")
async def start_mock_oa(session_id: str, user_id: str = Depends(get_current_user_id),
                        db: Session = Depends(get_db)):
    """Spec §6a: Start Mock OA — locked environment sized to time remaining."""
    return await mock_oa.start_mock_oa(db, user_id, code_red_session_id=session_id)


@router_codered.get("/{session_id}/clear-score")
def clear_score(session_id: str, user_id: str = Depends(get_current_user_id),
                db: Session = Depends(get_db)):
    """Live CLEAR SCORE (recomputed from current task completion state)."""
    state = cr.get_session_state(db, user_id, session_id)
    if state is None:
        raise ClarityError("SESSION_NOT_FOUND", "CODE RED session not found", 404)
    return {"session_id": session_id, "company": state["company"],
            **state["clear_score"]}


@router_companies.get("/{name}")
async def company_lookup(name: str, user_id: str = Depends(get_current_user_id),
                         db: Session = Depends(get_db)):
    company, profile, drift = await cr.get_or_build_company(db, user_id, name)
    await web_corpus.ensure_web_research(db, profile, company.name)
    return {"company": company.name, "oa_patterns": profile.oa_patterns,
            "interview_patterns": profile.interview_patterns,
            "core_subjects": profile.core_subjects, "difficulty": profile.difficulty,
            "round_structure": profile.round_structure, "sources": profile.sources,
            "confidence": profile.confidence,
            "last_verified": profile.last_verified.isoformat() if profile.last_verified else "",
            "drift": drift,
            "problems": web_corpus.company_all_problems(profile, company.name, limit=8),
            "interview_questions": web_corpus.company_interview_questions(profile, limit=8),
            "web_researched_at": profile.web_researched_at.isoformat()
            if profile.web_researched_at else ""}


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
        tail = [{"type": e.event_type, "payload": e.payload}
                for e in db.query(InterviewEvent).filter(
                    InterviewEvent.session_id == session_id).order_by(
                    InterviewEvent.timestamp.desc()).limit(6).all()][::-1]
        interviewer_say = await mi.interviewer_turn(
            (body.payload.get("problem_title", "the problem")
             if isinstance(body.payload, dict) else "the problem"),
            "followup" if body.event_type == "CODE_CHANGED" else "respond",
            int(body.payload.get("seconds_since_activity", 0))
            if isinstance(body.payload, dict) else 0, hints,
            transcript_tail=tail)
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
    company = db.query(Company).filter(Company.name.ilike(body.company)).first() if body.company else None
    latest_score = None
    if body.clear_score_at_time is not None:
        latest_score = body.clear_score_at_time
    else:
        last_cr = db.query(CodeRedSession).filter(
            CodeRedSession.user_id == user_id).order_by(
            CodeRedSession.created_at.desc()).first()
        latest_score = last_cr.clear_score if last_cr else 0
    o = Outcome(user_id=user_id, company_id=company.id if company else "",
                role=body.role, round=body.round, result=body.result,
                clear_score_at_time=latest_score or 0,
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
                          "result": o.result,
                          "clear_score_at_time": o.clear_score_at_time} for o in rows]}


# --- Weekly rhythm (spec §7) ---------------------------------------------


@router_weekly.get("")
def get_week(user_id: str = Depends(get_current_user_id),
             db: Session = Depends(get_db)):
    return weekly.week_schedule(db, user_id)


@router_weekly.post("/{mock_id}/skip")
def skip_week(mock_id: str, user_id: str = Depends(get_current_user_id),
              db: Session = Depends(get_db)):
    return weekly.skip(db, user_id, mock_id)


@router_weekly.post("/{mock_id}/reschedule")
def reschedule_week(mock_id: str, body: WeeklyRescheduleIn,
                    user_id: str = Depends(get_current_user_id),
                    db: Session = Depends(get_db)):
    return weekly.reschedule(db, user_id, mock_id, body.scheduled_for)


@router_weekly.post("/{mock_id}/complete")
def complete_week(mock_id: str, body: MockEventIn,
                  user_id: str = Depends(get_current_user_id),
                  db: Session = Depends(get_db)):
    return weekly.mark_completed(db, user_id, mock_id,
                                 str(body.payload.get("session_id", "")))


# --- Mock OA: assessment create/fetch (frontend locked environment) ------


@router_mock_oa.post("/start")
async def start_standalone_mock_oa(body: MockOAStartIn,
                                   user_id: str = Depends(get_current_user_id),
                                   db: Session = Depends(get_db)):
    """Generate a fresh proctored assessment (Question Generator), stored as a
    MockSession. Sized to the CODE RED time budget when linked to one."""
    return await mock_oa.start_mock_oa(
        db, user_id,
        code_red_session_id=body.code_red_session_id or None,
        company=body.company or "")


@router_mock_oa.get("/assessments/{session_id}")
def get_mock_oa_assessment(session_id: str,
                           user_id: str = Depends(get_current_user_id),
                           db: Session = Depends(get_db)):
    """The full assessment payload for the locked environment: problems with
    statements, examples, and starter templates — user-scoped."""
    session = db.query(MockSession).filter(
        MockSession.id == session_id, MockSession.user_id == user_id).first()
    if not session:
        raise ClarityError("SESSION_NOT_FOUND", "Mock OA session not found", 404)
    problems = []
    for pid in session.problem_ids or []:
        p = db.query(Problem).filter(Problem.id == pid).first()
        if not p:
            continue
        statement = p.statement or ""
        input_format = output_format = ""
        if "Input format:" in statement:
            head, rest = statement.split("Input format:", 1)
            if "Output format:" in rest:
                fmt_part, tail = rest.split("Output format:", 1)
                input_format = fmt_part.strip()
                output_format = tail.split("\n\n")[0].strip()
            else:
                input_format = rest.strip()
        problems.append({
            "id": p.id,
            "title": p.title,
            "difficulty": (p.difficulty or "medium").capitalize(),
            "topicIds": [p.pattern or p.topic_id or "algorithms"],
            "statement": statement,
            "inputFormat": input_format,
            "outputFormat": output_format,
            "constraints": p.constraints or [],
            "examples": p.examples or [],
            "starter": {
                "python": f"import sys\n\ndef solve():\n    data = sys.stdin.read().split()\n    # TODO: solve '{p.title}' ({p.difficulty})\n    pass\n\nif __name__ == '__main__':\n    solve()\n",
                "java": f"import java.util.Scanner;\n\npublic class Main {{\n    public static void main(String[] args) {{\n        Scanner sc = new Scanner(System.in);\n        // TODO: solve '{p.title}' ({p.difficulty})\n    }}\n}}\n",
                "cpp": f"#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {{\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // TODO: solve '{p.title}' ({p.difficulty})\n    return 0;\n}}\n",
            },
            "sampleStdin": ((p.examples or [{}])[0].get("input", "") or ""),
        })
    company = ""
    if session.company_id:
        comp = db.query(Company).filter(Company.id == session.company_id).first()
        company = comp.name if comp else ""
    minutes = 45
    if session.started_at:
        started = session.started_at if session.started_at.tzinfo else session.started_at.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        minutes = max(5, round(45 - elapsed / 60)) if session.status == "locked_active" else 45
    return {"id": session.id, "company": company or "Practice",
            "year": datetime.now(timezone.utc).year,
            "durationMinutes": minutes,
            "status": session.status, "problems": problems}


# --- Mock OA locked environment (spec §8) --------------------------------


@router_mock_oa.post("/{session_id}/events")
def mock_oa_event(session_id: str, body: MockEventIn,
                  user_id: str = Depends(get_current_user_id),
                  db: Session = Depends(get_db)):
    """Distraction-blocking events: TAB_SWITCH, COPY_PASTE, FULLSCREEN_EXIT."""
    result = mock_oa.record_event(db, user_id, session_id, body.event_type, body.payload)
    if result is None:
        raise ClarityError("SESSION_NOT_FOUND", "Mock OA session not found", 404)
    return result


@router_mock_oa.post("/{session_id}/link-attempt")
def mock_oa_link(session_id: str, body: MockEventIn,
                 user_id: str = Depends(get_current_user_id),
                 db: Session = Depends(get_db)):
    attempt_id = str(body.payload.get("attempt_id", ""))
    if not attempt_id:
        raise ClarityError("VALIDATION_ERROR", "attempt_id required", 400)
    if not mock_oa.record_attempt_link(db, user_id, session_id, attempt_id):
        raise ClarityError("SESSION_NOT_FOUND", "Mock OA session not found", 404)
    return {"linked": True}


@router_mock_oa.post("/{session_id}/end")
def mock_oa_end(session_id: str, user_id: str = Depends(get_current_user_id),
                db: Session = Depends(get_db)):
    return mock_oa.end_mock_oa(db, user_id, session_id)
