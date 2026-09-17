"""Mock interview workflow: session events -> transcript -> evaluator -> mastery."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.agents.evaluator import EvaluatorAgent
from app.agents.interviewer import InterviewerAgent
from app.models import InterviewEvent, MasteryHistory, MasteryNode, MockSession
from app.services.mastery_engine import MasteryEngine


async def interviewer_turn(problem_title: str, phase: str, seconds_since_activity: int,
                           hints_given: int, transcript_tail: list | None = None) -> dict:
    res = await InterviewerAgent().run({"problem_title": problem_title, "phase": phase,
                                        "seconds_since_activity": seconds_since_activity,
                                        "hints_given": hints_given,
                                        "transcript_tail": transcript_tail or []})
    return res["output"]


def transcript(db: Session, session_id: str) -> list[dict]:
    events = db.query(InterviewEvent).filter(
        InterviewEvent.session_id == session_id).order_by(InterviewEvent.timestamp).all()
    return [{"type": e.event_type, "payload": e.payload,
             "at": e.timestamp.isoformat() if e.timestamp else ""} for e in events]


async def debrief(db: Session, session_id: str, user_id: str) -> dict:
    """Evaluate session -> update mastery nodes -> return debrief."""
    session = db.query(MockSession).filter(
        MockSession.id == session_id, MockSession.user_id == user_id).first()
    if not session:
        return {"error": "session_not_found"}
    events = transcript(db, session_id)
    codes = [e for e in events if e["type"] == "CODE_CHANGED"]
    subs = [e for e in events if e["type"] == "SUBMISSION"]
    correctness = 0.7 if subs else (0.5 if codes else 0.3)
    comm = sum(1 for e in events if e["type"] == "CANDIDATE_SPEECH")
    communication = round(min(1.0, 0.4 + 0.1 * comm), 3)
    eres = await EvaluatorAgent().run(
        {"judge_result": {"passed": int(correctness * 4), "total": 4},
         "pattern": "interview", "explanation": f"{comm} speech turns"},
        user_id=user_id, workflow="mock_interview", db=db)
    ev = eres["output"]
    deltas = []
    for sig in ev.get("mastery_signals", []):
        node = db.query(MasteryNode).filter(
            MasteryNode.user_id == user_id,
            MasteryNode.pattern == sig.get("pattern", "")).first()
        if not node:
            continue
        r = MasteryEngine.update(node.mastery_score, sig.get("correctness", correctness),
                                 600, 600, 0, node.confidence)
        prev = node.mastery_score
        node.mastery_score = r.new_score
        node.times_attempted += 1
        node.times_correct += 1 if correctness >= 0.5 else 0
        node.last_seen = datetime.now(timezone.utc)
        db.add(MasteryHistory(user_id=user_id, mastery_node_id=node.id,
                              previous_score=prev, new_score=r.new_score, delta=r.delta,
                              source_type="MOCK_INTERVIEW", source_id=session_id,
                              reason="interview debrief"))
        deltas.append({"node": node.pattern, "delta": r.delta})
    session.status = "completed"
    session.ended_at = datetime.now(timezone.utc)
    db.commit()
    return {"correctness": correctness, "communication_quality": communication,
            "feedback": ev.get("feedback", ""), "mastery_deltas": deltas,
            "events": len(events)}
