"""Daily workflow: mastery snapshot -> planner -> validate -> save plan."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.agents.planner import PlannerAgent
from app.integrations.foundry.client import ChatBackend
from app.models import DailyPlan, MasteryHistory, MasteryNode, Topic
from app.schemas import PlannerInput
from app.services.mastery_engine import MasteryEngine


def mastery_snapshot(db: Session, user_id: str) -> list[dict]:
    nodes = db.query(MasteryNode).filter(MasteryNode.user_id == user_id).all()
    topics = {t.id: t for t in db.query(Topic).all()}
    now = datetime.now(timezone.utc)
    snap = []
    for n in nodes:
        last = n.last_seen if n.last_seen and n.last_seen.tzinfo else (
            (n.last_seen or now).replace(tzinfo=timezone.utc))
        days = (now - last).total_seconds() / 86400
        eff = MasteryEngine.effective_mastery(n.mastery_score, days, n.decay_rate)
        t = topics.get(n.topic_id)
        snap.append({"id": n.pattern or n.topic_id, "node_db_id": n.id,
                     "name": (t.name if t else n.topic_id),
                     "category": (t.category if t else "DSA"),
                     "mastery": round(n.mastery_score, 4), "effective_mastery": eff,
                     "importance": round(n.importance_weight, 4),
                     "staleness": MasteryEngine.staleness(days, n.decay_rate)})
    return snap


async def build_daily_plan(db: Session, user_id: str, mood: str, time_available: int,
                           company: str | None = None,
                           llm: ChatBackend | None = None) -> dict:
    snap = mastery_snapshot(db, user_id)
    recent = [{"source_type": h.source_type, "delta": h.delta}
              for h in db.query(MasteryHistory).filter(
                  MasteryHistory.user_id == user_id).order_by(
                  MasteryHistory.created_at.desc()).limit(10).all()]
    inp = PlannerInput(mastery_snapshot=snap, mood=mood, time_available=time_available,
                       company=company or None, recent_activity=recent)
    res = await PlannerAgent(llm=llm).run(inp.model_dump(), user_id=user_id,
                                          workflow="daily", db=db)
    plan, trace_id = res["output"], res["trace_id"]
    # Validate: clamp durations so total <= budget; drop empty.
    budget = max(5, time_available)
    total = sum(t.get("duration_minutes", 0) for t in plan.get("tasks", []))
    if total > budget and plan.get("tasks"):
        factor = budget / total
        for t in plan["tasks"]:
            t["duration_minutes"] = max(5, int(t["duration_minutes"] * factor))
    record = DailyPlan(user_id=user_id, date=datetime.now(timezone.utc).date().isoformat(),
                       mood=mood, time_available=time_available, tasks=plan.get("tasks", []))
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"plan_id": record.id, "tasks": record.tasks, "trace_id": trace_id}
