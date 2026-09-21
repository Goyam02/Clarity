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


def get_today_plan(db: Session, user_id: str) -> dict | None:
    """Most recent plan for today (frontend loads Home with this; null = none yet)."""
    today = datetime.now(timezone.utc).date().isoformat()
    record = db.query(DailyPlan).filter(
        DailyPlan.user_id == user_id, DailyPlan.date == today).order_by(
        DailyPlan.created_at.desc()).first()
    if not record:
        return None
    return {"plan_id": record.id, "date": record.date, "mood": record.mood,
            "time_available": record.time_available, "tasks": record.tasks}


def set_task_status(db: Session, user_id: str, plan_id: str, task_index: int,
                    status: str) -> dict | None:
    record = db.query(DailyPlan).filter(
        DailyPlan.id == plan_id, DailyPlan.user_id == user_id).first()
    if not record or not isinstance(record.tasks, list):
        return None
    if task_index < 0 or task_index >= len(record.tasks):
        return None
    tasks = list(record.tasks)
    tasks[task_index] = {**tasks[task_index], "status": status}
    record.tasks = tasks
    db.commit()
    return {"plan_id": record.id, "tasks": tasks}


def log_manual(db: Session, user_id: str, topic_id: str, title: str, link: str,
               notes: str, correctness: float, minutes_spent: int) -> dict:
    """Spec §4 log intake: every log write updates the Mastery Model immediately."""
    node = db.query(MasteryNode).filter(
        MasteryNode.user_id == user_id, MasteryNode.topic_id == topic_id).first()
    if not node:
        from app.workflows.onboarding import ensure_seed_topics
        ensure_seed_topics(db)
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic:
            raise ValueError(f"unknown topic {topic_id}")
        node = MasteryNode(user_id=user_id, topic_id=topic_id, pattern=topic_id,
                           mastery_score=0.5, confidence=0.4,
                           importance_weight=topic.importance)
        db.add(node)
        db.commit()
        db.refresh(node)
    prev = node.mastery_score
    r = MasteryEngine.update(node.mastery_score, correctness,
                             minutes_spent * 60, 1200, 0, node.confidence)
    node.mastery_score = r.new_score
    node.times_attempted += 1
    node.times_correct += 1 if correctness >= 0.5 else 0
    node.last_seen = datetime.now(timezone.utc)
    db.add(MasteryHistory(user_id=user_id, mastery_node_id=node.id,
                          previous_score=prev, new_score=r.new_score, delta=r.delta,
                          source_type="MANUAL_LOG",
                          reason=(title or link or notes or "manual log")[:500],
                          extra={"link": link, "minutes": minutes_spent}))
    db.commit()
    return {"node_id": node.id, "pattern": node.pattern, "previous": prev,
            "new": r.new_score, "delta": r.delta}


async def grade_concept_card(db: Session, user_id: str, topic_id: str, concept: str,
                             explanation: str) -> dict:
    """Explain-it-back concept cards (spec §4 content type 2): the Evaluator
    grades explanation quality (verbal-leaning), MasteryEngine converts to a
    score delta — never keyword matching."""
    from app.agents.evaluator import EvaluatorAgent
    from app.schemas import EvaluationResult

    node = db.query(MasteryNode).filter(
        MasteryNode.user_id == user_id, MasteryNode.topic_id == topic_id).first()
    if not node:
        raise ValueError(f"unknown topic {topic_id}")
    res = await EvaluatorAgent().run(
        {"judge_result": {}, "pattern": topic_id,
         "explanation": f"Concept: {concept}\n\nStudent explanation: {explanation}"},
        user_id=user_id, workflow="concept_card", db=db)
    ev = EvaluationResult(**res["output"])
    quality = ev.explanation_quality if ev.explanation_quality is not None else ev.correctness
    prev = node.mastery_score
    r = MasteryEngine.update(node.mastery_score, ev.correctness, 300, 600, 0,
                             node.confidence, quality)
    node.mastery_score = r.new_score
    node.times_attempted += 1
    node.times_correct += 1 if ev.correctness >= 0.5 else 0
    node.last_seen = datetime.now(timezone.utc)
    db.add(MasteryHistory(user_id=user_id, mastery_node_id=node.id,
                          previous_score=prev, new_score=r.new_score, delta=r.delta,
                          source_type="CONCEPT_CARD",
                          reason=(ev.feedback or "concept card")[:500]))
    db.commit()
    return {"node_id": node.id, "pattern": node.pattern,
            "previous": prev, "new": r.new_score, "delta": r.delta,
            "explanation_quality": quality, "feedback": ev.feedback,
            "trace_id": res["trace_id"]}


def revise_now(db: Session, user_id: str, node_db_id: str) -> dict | None:
    """Spec §5: 'Revise this now' drops the node straight into today's Home queue."""
    node = db.query(MasteryNode).filter(
        MasteryNode.id == node_db_id, MasteryNode.user_id == user_id).first()
    if not node:
        return None
    from app.models import Topic
    topic = db.query(Topic).filter(Topic.id == node.topic_id).first()
    name = topic.name if topic else node.topic_id
    task = {"task_type": "revision", "node_id": node.pattern or node.topic_id,
            "duration_minutes": 8, "reason": "weak_spot",
            "title": f"Revise: {name}", "status": "pending"}
    today = datetime.now(timezone.utc).date().isoformat()
    record = db.query(DailyPlan).filter(
        DailyPlan.user_id == user_id, DailyPlan.date == today).order_by(
        DailyPlan.created_at.desc()).first()
    if record:
        tasks = list(record.tasks or [])
        tasks.append(task)
        record.tasks = tasks
    else:
        record = DailyPlan(user_id=user_id, date=today, mood="normal",
                           time_available=40, tasks=[task])
        db.add(record)
    db.commit()
    db.refresh(record)
    return {"plan_id": record.id, "tasks": record.tasks}


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
