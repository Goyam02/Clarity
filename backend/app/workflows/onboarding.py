"""Onboarding orchestration: parallel extraction -> calibration -> mastery init."""
import asyncio

from sqlalchemy.orm import Session

from app.models import MasteryNode, Topic
from app.services import codeforces_service, github_service


async def _cf(handle: str) -> dict:
    return await codeforces_service.get_user_info(handle) if handle else {"skipped": True}


async def _gh(username: str) -> dict:
    return await github_service.get_user_summary(username) if username else {"skipped": True}


async def _resume(ref: str) -> dict:
    # Real path: multimodal Foundry call over the blob; mock returns pending-confirmation.
    return {"blob_ref": ref, "skills": [], "needs_confirmation": True} if ref else {"skipped": True}


async def gather_signals(codeforces_handle: str = "", github_username: str = "",
                         resume_blob_ref: str = "") -> dict:
    """Independent extractions genuinely run concurrently."""
    cf, gh, resume = await asyncio.gather(_cf(codeforces_handle), _gh(github_username),
                                          _resume(resume_blob_ref))
    return {"codeforces": cf, "github": gh, "resume": resume}


SEED_TOPICS = [
    ("sliding-window", "Sliding Window", "DSA", 0.85),
    ("two-pointers", "Two Pointers", "DSA", 0.8),
    ("dsu", "Disjoint Set Union", "DSA", 0.7),
    ("graphs-bfs", "Graph BFS/DFS", "DSA", 0.85),
    ("dp-knapsack", "DP: Knapsack", "DSA", 0.75),
    ("dbms-indexing", "DBMS Indexing", "DBMS", 0.7),
    ("sql-joins", "SQL Joins", "DBMS", 0.7),
    ("os-paging", "OS Paging", "OS", 0.6),
    ("oop", "OOP Concepts", "OOP", 0.6),
    ("cn", "Computer Networks", "CN", 0.55),
]


def ensure_seed_topics(db: Session) -> None:
    existing = {t.id for t in db.query(Topic).all()}
    for tid, name, cat, imp in SEED_TOPICS:
        if tid not in existing:
            db.add(Topic(id=tid, name=name, category=cat, importance=imp))
    db.commit()


def init_mastery(db: Session, user_id: str) -> int:
    ensure_seed_topics(db)
    existing = {n.topic_id for n in db.query(MasteryNode).filter(
        MasteryNode.user_id == user_id).all()}
    count = 0
    for tid, _, _, imp in SEED_TOPICS:
        if tid not in existing:
            db.add(MasteryNode(user_id=user_id, topic_id=tid, pattern=tid,
                               mastery_score=0.5, confidence=0.4,
                               importance_weight=imp))
            count += 1
    db.commit()
    return count
