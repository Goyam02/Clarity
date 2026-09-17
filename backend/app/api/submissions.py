"""Submissions: attempt -> judge -> evaluator -> mastery update."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agents.evaluator import EvaluatorAgent
from app.core.errors import ClarityError
from app.dependencies import get_current_user_id, get_db
from app.models import MasteryHistory, MasteryNode, Problem, ProblemAttempt, Submission
from app.schemas import EvaluationResult
from app.services.judge import get_judge
from app.services.mastery_engine import MasteryEngine

router = APIRouter()


class AttemptIn(BaseModel):
    problem_id: str


class SubmitIn(BaseModel):
    attempt_id: str
    language: str = "python"
    source_code: str
    explanation: str = ""


@router.post("/attempts")
def start_attempt(body: AttemptIn, user_id: str = Depends(get_current_user_id),
                  db: Session = Depends(get_db)):
    attempt = ProblemAttempt(user_id=user_id, problem_id=body.problem_id, status="started")
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return {"attempt_id": attempt.id}


@router.post("")
async def submit(body: SubmitIn, user_id: str = Depends(get_current_user_id),
                 db: Session = Depends(get_db)):
    attempt = db.query(ProblemAttempt).filter(
        ProblemAttempt.id == body.attempt_id, ProblemAttempt.user_id == user_id).first()
    if not attempt:
        raise ClarityError("ATTEMPT_NOT_FOUND", "Attempt not found", 404)
    problem = db.query(Problem).filter(Problem.id == attempt.problem_id).first()
    test_cases = problem.test_cases if problem else []
    judge = get_judge()
    result = await judge.execute(body.language, body.source_code, test_cases)
    sub = Submission(attempt_id=attempt.id, language=body.language,
                     source_code=body.source_code, compile_status=result.compile_status,
                     test_results=result.test_results, runtime_ms=result.runtime_ms)
    db.add(sub)
    attempt.status = "submitted"
    attempt.submitted_at = datetime.now(timezone.utc)
    attempt.runtime_ms = result.runtime_ms
    db.commit()
    # Evaluator -> MasteryEngine -> MasteryHistory (deterministic score write).
    eres = await EvaluatorAgent().run(
        {"judge_result": {"passed": result.passed, "total": result.total,
                          "runtime_ms": result.runtime_ms},
         "hints_used": attempt.hints_used, "pattern": problem.pattern if problem else "",
         "explanation": body.explanation},
        user_id=user_id, workflow="submission", db=db)
    ev = EvaluationResult(**eres["output"])
    mastery_delta = None
    if problem:
        node = db.query(MasteryNode).filter(
            MasteryNode.user_id == user_id,
            MasteryNode.topic_id == (problem.topic_id or problem.pattern)).first()
        if node:
            sig = ev.mastery_signals[0] if ev.mastery_signals else None
            r = MasteryEngine.update(
                node.mastery_score, ev.correctness,
                (sig.solve_time_seconds if sig else 600),
                (sig.expected_time_seconds if sig else 600),
                attempt.hints_used, node.confidence,
                ev.explanation_quality)
            prev = node.mastery_score
            node.mastery_score = r.new_score
            node.times_attempted += 1
            node.times_correct += 1 if ev.correctness >= 0.5 else 0
            node.last_seen = datetime.now(timezone.utc)
            db.add(MasteryHistory(user_id=user_id, mastery_node_id=node.id,
                                  previous_score=prev, new_score=r.new_score, delta=r.delta,
                                  source_type="DAILY_PRACTICE", source_id=sub.id,
                                  reason=ev.feedback[:500]))
            db.commit()
            mastery_delta = {"node": node.pattern, "previous": prev,
                             "new": r.new_score, "delta": r.delta}
    return {"submission_id": sub.id, "judge": {"status": result.compile_status,
            "passed": result.passed, "total": result.total,
            "test_results": result.test_results},
            "evaluation": ev.model_dump(), "mastery": mastery_delta,
            "trace_id": eres["trace_id"]}
