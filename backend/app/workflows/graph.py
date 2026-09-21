"""Knowledge-graph correlation edges (spec §5): dynamic, computed from the
student's own logged history — dashed visual style in the frontend.

Nodes whose mastery moved on the same day repeatedly (co-movement, especially
drops) are correlated. Prerequisite edges stay static/curated (api/mastery.py).
"""
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import MasteryHistory, MasteryNode

MIN_CO_OCCURRENCES = 2  # same-day co-movement needed before an edge appears


def _topic_id_for_node(db: Session, node_db_id: str) -> str:
    node = db.query(MasteryNode).filter(MasteryNode.id == node_db_id).first()
    return (node.pattern or node.topic_id) if node else node_db_id


def correlation_edges(db: Session, user_id: str, id_by_topic: dict[str, str]) -> list[dict]:
    """Edges between graph node ids whose mastery co-moved on the same days.

    Weight = co-occurrence count (capped). Both drop-drop and mixed movement
    count; drop-drop pairs rank first so "these topics fall together" surfaces.
    """
    rows = db.query(MasteryHistory).filter(
        MasteryHistory.user_id == user_id).order_by(MasteryHistory.created_at).all()
    by_day: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for h in rows:
        if not h.created_at:
            continue
        day = h.created_at.date().isoformat() if h.created_at.tzinfo else (
            h.created_at.replace(tzinfo=timezone.utc).date().isoformat())
        # Graph node id for this history row's node.
        node = db.query(MasteryNode).filter(MasteryNode.id == h.mastery_node_id).first()
        if not node:
            continue
        gid = node.pattern or node.topic_id
        by_day[day].append((gid, h.delta))

    pair_stats: dict[tuple[str, str], dict] = {}
    for day, moves in by_day.items():
        for i in range(len(moves)):
            for j in range(i + 1, len(moves)):
                a, da = moves[i]
                b, db_ = moves[j]
                if a == b:
                    continue
                key = (a, b) if a < b else (b, a)
                st = pair_stats.setdefault(key, {"count": 0, "drops": 0})
                st["count"] += 1
                if da < 0 and db_ < 0:
                    st["drops"] += 1

    edges = []
    for (a, b), st in pair_stats.items():
        if st["count"] < MIN_CO_OCCURRENCES:
            continue
        edges.append({
            "from": a, "to": b, "type": "CORRELATION",
            "weight": min(1.0, st["count"] / 5.0),
            "co_occurrences": st["count"], "joint_drops": st["drops"],
            "note": (f"Mastery moved together on {st['count']} days"
                     + (f" ({st['drops']} joint drops)" if st["drops"] else "")),
        })
    edges.sort(key=lambda e: (-e["joint_drops"], -e["co_occurrences"]))
    return edges[:20]
