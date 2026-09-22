"""Spoken interview evidence -> evaluator -> one persisted debrief."""
import asyncio
from datetime import datetime, timezone
from weakref import WeakValueDictionary

from sqlalchemy.orm import Session

from app.agents.evaluator import EvaluatorAgent
from app.agents.interviewer import InterviewerAgent
from app.core.errors import ClarityError
from app.models import InterviewEvent, MasteryHistory, MasteryNode, MockSession
from app.services.mastery_engine import MasteryEngine

_debrief_locks: WeakValueDictionary = WeakValueDictionary()


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
             "at": e.timestamp.isoformat() if e.timestamp else ""} for e in events
            if e.event_type != "DEBRIEF_COMPLETED"]


async def debrief(db: Session, session_id: str, user_id: str) -> dict:
    # Serialize duplicate requests in this worker; row lock covers other
    # PostgreSQL workers. No intermediate commits while grading.
    key = (session_id, user_id)
    lock = _debrief_locks.setdefault(key, asyncio.Lock())
    async with lock:
        session = db.query(MockSession).filter(
            MockSession.id == session_id, MockSession.user_id == user_id,
            MockSession.round_type == "Interview").with_for_update().first()
        if not session:
            raise ClarityError("SESSION_NOT_FOUND", "Interview session not found", 404)
        saved = db.query(InterviewEvent).filter(
            InterviewEvent.session_id == session_id,
            InterviewEvent.event_type == "DEBRIEF_COMPLETED").first()
        if saved:
            return saved.payload
        events = transcript(db, session_id)
        answers = [e for e in events if e["type"] == "CANDIDATE_SPEECH"
                   and str(e["payload"].get("text", "")).strip()]
        context = next((e["payload"] for e in events if e["type"] == "SESSION_STARTED"), {})
        patterns = {e["payload"].get("pattern") for e in events
                    if e["type"] in {"SESSION_STARTED", "QUESTION_ASKED"}}
        patterns.discard(None)
        patterns.discard("")
        deltas = []
        if answers:
            eres = await EvaluatorAgent().run(
                {"mode": "spoken_approach", "pattern": context.get("pattern", "interview"),
                 "covered_patterns": sorted(patterns), "context": context,
                 "transcript": events, "judge_result": None,
                 "explanation": "\n".join(e["payload"]["text"] for e in answers),
                 "hints_used": sum(e["type"] == "HINT_GIVEN" for e in events)},
                user_id=user_id, workflow="mock_interview")
            ev = eres["output"]
            seen = set()
            for sig in ev.get("mastery_signals", []):
                pattern = sig.get("pattern", "")
                if pattern not in patterns or pattern in seen:
                    continue
                seen.add(pattern)
                node = db.query(MasteryNode).filter(
                    MasteryNode.user_id == user_id, MasteryNode.pattern == pattern).first()
                if not node:
                    continue
                correctness = sig.get("correctness", ev["correctness"])
                r = MasteryEngine.update(node.mastery_score, correctness, 600, 600,
                                         sum(e["type"] == "HINT_GIVEN" for e in events),
                                         node.confidence, ev.get("explanation_quality"))
                prev = node.mastery_score
                node.mastery_score = r.new_score
                node.times_attempted += 1
                node.times_correct += int(correctness >= 0.5)
                node.last_seen = datetime.now(timezone.utc)
                db.add(MasteryHistory(user_id=user_id, mastery_node_id=node.id,
                                      previous_score=prev, new_score=r.new_score, delta=r.delta,
                                      source_type="MOCK_INTERVIEW", source_id=session_id,
                                      reason="Spoken approach review"))
                deltas.append({"node": node.pattern, "delta": r.delta})
            result = {"correctness": ev["correctness"],
                      "communication_quality": ev.get("communication_quality"),
                      "feedback": ev.get("feedback", ""), "mastery_deltas": deltas,
                      "events": len(events), "answers": len(answers)}
        else:
            result = {"correctness": None, "communication_quality": None,
                      "feedback": "No approach was recorded. Start another interview and explain your reasoning to receive feedback.",
                      "mastery_deltas": [], "events": len(events), "answers": 0}
        result.update(session_id=session_id, mode=context.get("mode", "practice"),
                      company=context.get("company", ""), topic=context.get("pattern", ""))
        session.status = "completed"
        session.ended_at = datetime.now(timezone.utc)
        db.add(InterviewEvent(session_id=session_id, event_type="DEBRIEF_COMPLETED", payload=result))
        db.commit()
        return result
