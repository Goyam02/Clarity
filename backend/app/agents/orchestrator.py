"""Orchestrator: explicit handoffs planner -> question_generator -> evaluator.

Handoffs are recorded on the AgentRun rows (handoffs list) so the multi-agent
trace is observable. Every step is a real agent call.
"""
import time
import uuid

from sqlalchemy.orm import Session

from app.agents.planner import PlannerAgent
from app.agents.question_generator import QuestionGeneratorAgent
from app.core.logging import get_logger
from app.integrations.foundry.client import ChatBackend
from app.models import AgentRun

log = get_logger(__name__)


async def run_daily_pipeline(user_id: str, planner_input: dict, db: Session,
                             llm: ChatBackend | None = None) -> dict:
    """Planner -> (QuestionGen per problem task) with linked audit rows."""
    trace_id = uuid.uuid4().hex[:16]
    handoffs: list[dict] = []
    pres = await PlannerAgent(llm=llm).run(planner_input, user_id=user_id,
                                           workflow="daily", db=db)
    plan = pres["output"]
    questions = []
    qgen = QuestionGeneratorAgent(llm=llm)
    for t in plan.get("tasks", []):
        if t.get("task_type") in ("problem", "timed_challenge") and t.get("node_id"):
            q = await qgen.run({"pattern": t.get("node_id", "general"),
                                "topic_id": t.get("node_id", ""),
                                "difficulty": "medium"}, user_id=user_id,
                               workflow="daily", db=db)
            questions.append(q["output"])
            handoffs.append({"from": "planner", "to": "question_generator",
                             "reason": f"task {t.get('task_type')} for {t.get('node_id')}",
                             "trace_id": trace_id, "at": time.time()})
    try:
        run = db.query(AgentRun).filter(
            AgentRun.trace_id == pres["trace_id"]).first()
        if run:
            run.handoffs = handoffs
            db.commit()
    except Exception as e:
        log.info(f"handoff link failed: {e}")
        db.rollback()
    return {"plan": plan, "questions": questions, "trace_id": trace_id,
            "handoffs": handoffs}
