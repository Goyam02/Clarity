"""Mastery: nodes, history, knowledge graph (read-only for frontend)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.errors import ClarityError
from app.dependencies import get_current_user_id, get_db
from app.models import MasteryHistory, MasteryNode, Topic
from app.services.mastery_engine import MasteryEngine
from app.workflows.daily import mastery_snapshot

router = APIRouter()

PREREQ_EDGES = [("two-pointers", "sliding-window"), ("graphs-bfs", "dsu"),
                ("oop", "dsu"), ("dbms-indexing", "sql-joins")]


class MasteryUpdateIn(BaseModel):
    topic_id: str
    pattern: str = ""
    correctness: float
    solve_time_seconds: float = 600
    expected_time_seconds: float = 600
    hints_used: int = 0
    source_type: str = "MANUAL_LOG"
    explanation_quality: float | None = None


@router.get("/nodes")
def list_nodes(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    return {"nodes": mastery_snapshot(db, user_id)}


@router.get("/graph")
def graph(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    snap = mastery_snapshot(db, user_id)
    edges = [{"from": a, "to": b, "type": "PREREQUISITE"} for a, b in PREREQ_EDGES
             if any(n["id"] == a for n in snap) and any(n["id"] == b for n in snap)]
    # Correlation edges: co-attempted weak nodes (dashed, from history).
    return {"nodes": snap, "edges": edges}


@router.post("/update")
def update_mastery(body: MasteryUpdateIn, user_id: str = Depends(get_current_user_id),
                   db: Session = Depends(get_db)):
    node = db.query(MasteryNode).filter(
        MasteryNode.user_id == user_id, MasteryNode.topic_id == body.topic_id).first()
    if not node:
        topic = db.query(Topic).filter(Topic.id == body.topic_id).first()
        if not topic:
            raise ClarityError("TOPIC_NOT_FOUND", f"Unknown topic {body.topic_id}", 404)
        node = MasteryNode(user_id=user_id, topic_id=body.topic_id,
                           pattern=body.pattern or body.topic_id)
        db.add(node)
        db.commit()
        db.refresh(node)
    # Apply decay first (read-time effective becomes the base), then update.
    now = datetime.now(timezone.utc)
    last = node.last_seen if node.last_seen and node.last_seen.tzinfo else now
    days = (now - last).total_seconds() / 86400
    base = MasteryEngine.effective_mastery(node.mastery_score, days, node.decay_rate)
    r = MasteryEngine.update(base, body.correctness, body.solve_time_seconds,
                             body.expected_time_seconds, body.hints_used,
                             node.confidence, body.explanation_quality)
    prev = node.mastery_score
    node.mastery_score = r.new_score
    node.times_attempted += 1
    node.times_correct += 1 if body.correctness >= 0.5 else 0
    node.hint_count += body.hints_used
    node.last_seen = now
    db.add(MasteryHistory(user_id=user_id, mastery_node_id=node.id, previous_score=prev,
                          new_score=r.new_score, delta=r.delta, source_type=body.source_type,
                          reason="api update"))
    db.commit()
    return {"node_id": node.id, "previous": prev, "new": r.new_score, "delta": r.delta}


@router.get("/history/{node_id}")
def history(node_id: str, user_id: str = Depends(get_current_user_id),
            db: Session = Depends(get_db)):
    rows = db.query(MasteryHistory).filter(
        MasteryHistory.user_id == user_id, MasteryHistory.mastery_node_id == node_id).order_by(
        MasteryHistory.created_at.desc()).limit(50).all()
    return {"history": [{"previous": h.previous_score, "new": h.new_score, "delta": h.delta,
                         "source": h.source_type, "at": h.created_at.isoformat()
                         if h.created_at else ""} for h in rows]}
