"""Mock OA workflow: locked-environment sessions sized to remaining CODE RED time.

Spec §8: fullscreen lock, tab-switch / copy-paste detection, session timer
matched to the round duration — framed as distraction-blocking. The frontend
enforces fullscreen/timer; the backend ingests the lock events and scores the
attempt at session end (same Question Generator / Evaluator pipeline).
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.agents.question_generator import QuestionGeneratorAgent
from app.core.errors import ClarityError
from app.models import InterviewEvent, MockSession, Problem


async def start_mock_oa(db: Session, user_id: str, code_red_session_id: str | None = None,
                        company: str = "", duration_minutes: int | None = None) -> dict:
    """Create a MockSession with fresh problems sized to the available time."""
    remaining = duration_minutes
    if code_red_session_id:
        from app.models import CodeRedSession
        cr = db.query(CodeRedSession).filter(
            CodeRedSession.id == code_red_session_id,
            CodeRedSession.user_id == user_id).first()
        if not cr:
            raise ClarityError("SESSION_NOT_FOUND", "CODE RED session not found", 404)
        remaining = cr.remaining_time or max(15, cr.time_budget // 3)
    remaining = max(10, min(remaining or 45, 180))

    # ~1 problem per 20 minutes, 2-3 problems, sized to the timer.
    count = max(1, min(3, remaining // 20))
    problems = []
    pattern = "sliding-window"
    if company:
        from app.services import company_corpus
        anchors = company_corpus.company_anchor_problems(company, limit=1)
        if anchors:
            pattern = anchors[0]["patterns"][0] if anchors[0]["patterns"] else pattern
    for i in range(count):
        res = await QuestionGeneratorAgent().run(
            {"pattern": pattern, "topic_id": pattern, "difficulty": "medium",
             "company": company}, user_id=user_id, workflow="mock_oa", db=db)
        out = res["output"]
        problem = Problem(title=out["title"], statement=out["statement"],
                          difficulty=out.get("difficulty", "medium"), topic_id=pattern,
                          pattern=pattern, company_id="", source_type="mock_oa",
                          constraints=out.get("constraints", []),
                          examples=out.get("examples", []),
                          test_cases=out.get("test_cases", []),
                          expected_complexity=out.get("expected_complexity", {}),
                          validation_status="valid")
        db.add(problem)
        db.commit()
        db.refresh(problem)
        problems.append({"problem_id": problem.id, "title": problem.title,
                         "difficulty": problem.difficulty,
                         "minutes": max(10, remaining // count)})
    session = MockSession(user_id=user_id, round_type="OA", status="locked_active",
                          problem_ids=[p["problem_id"] for p in problems])
    db.add(session)
    db.commit()
    db.refresh(session)
    if code_red_session_id:
        db.add(InterviewEvent(session_id=session.id, event_type="MOCK_OA_STARTED",
                              payload={"code_red_session_id": code_red_session_id,
                                       "duration_minutes": remaining}))
        db.commit()
    return {"session_id": session.id, "duration_minutes": remaining,
            "problems": problems, "round_type": "OA"}


def record_event(db: Session, user_id: str, session_id: str, event_type: str,
                 payload: dict) -> dict | None:
    """Ingest distraction-blocking events (TAB_SWITCH, COPY_PASTE, FULLSCREEN_EXIT...)."""
    session = db.query(MockSession).filter(
        MockSession.id == session_id, MockSession.user_id == user_id).first()
    if not session:
        return None
    db.add(InterviewEvent(session_id=session_id, event_type=event_type, payload=payload))
    db.commit()
    return {"recorded": True}


def end_mock_oa(db: Session, user_id: str, session_id: str) -> dict:
    """Close the session and return a scored debrief from submissions + events."""
    session = db.query(MockSession).filter(
        MockSession.id == session_id, MockSession.user_id == user_id).first()
    if not session:
        raise ClarityError("SESSION_NOT_FOUND", "Mock OA session not found", 404)
    if session.status in ("completed", "scored"):
        raise ClarityError("SESSION_ALREADY_ENDED", "Session already ended", 409)
    events = db.query(InterviewEvent).filter(
        InterviewEvent.session_id == session_id).order_by(InterviewEvent.timestamp).all()
    distractions = sum(1 for e in events if e.event_type in
                       ("TAB_SWITCH", "COPY_PASTE", "FULLSCREEN_EXIT"))
    # Score from submissions tied to this session's problems.
    from app.models import ProblemAttempt, Submission
    passed = total = 0
    for pid in session.problem_ids or []:
        attempts = db.query(ProblemAttempt).filter(
            ProblemAttempt.user_id == user_id, ProblemAttempt.problem_id == pid,
            ProblemAttempt.status == "submitted").all()
        for a in attempts:
            sub = db.query(Submission).filter(Submission.attempt_id == a.id).first()
            if sub and isinstance(sub.test_results, list):
                total += len(sub.test_results)
                passed += sum(1 for r in sub.test_results if r.get("passed"))
    correctness = round(passed / total, 3) if total else 0.0
    session.status = "completed"
    session.ended_at = datetime.now(timezone.utc)
    db.commit()
    return {"session_id": session_id, "correctness": correctness,
            "tests_passed": passed, "tests_total": total,
            "distraction_events": distractions,
            "problems": session.problem_ids or []}


def record_attempt_link(db: Session, user_id: str, session_id: str, attempt_id: str) -> bool:
    """Tie a /submissions attempt to this mock session (for end-of-session scoring)."""
    session = db.query(MockSession).filter(
        MockSession.id == session_id, MockSession.user_id == user_id).first()
    if not session:
        return False
    db.add(InterviewEvent(session_id=session_id, event_type="SUBMISSION_LINKED",
                          payload={"attempt_id": attempt_id}))
    db.commit()
    return True
