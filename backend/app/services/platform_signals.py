"""Platform-signal ingest: pulled platform data -> PlatformSignal rows (DB) ->
Mastery Model updates (MasteryEngine, with provenance in MasteryHistory).

Design rules (docs/plans/plan-leetcode-pulls.md):
- Signals are real observations (ground truth), never self-report.
- MasteryEngine is the only writer of mastery scores; a platform signal is
  high-confidence evidence, blended — never a raw overwrite.
- Every node write gets a MasteryHistory row (source_type="PLATFORM_SIGNAL").
- Idempotent: re-pulling the same data upserts signals and re-blends from the
  stored score (MasteryEngine is convergent — repeated identical evidence
  moves the score toward the same target, not linearly upward).
"""
import asyncio
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models import MasteryHistory, MasteryNode, PlatformSignal, Profile, Topic
from app.services.mastery_engine import MasteryEngine
from app.services.topic_map import topic_id_for_cf_tag

log = get_logger(__name__)

# Expected solved counts per topic for a "solid" candidate; a topic at/above
# this reads as mastered evidence (correctness ~= 1.0 scaled by level below).
EXPECTED_SOLVED_PER_TOPIC = 15
MAX_SIGNAL_CORRECTNESS = 0.92  # platform evidence never fully overrides live attempts


def _signal_correctness(solved: int) -> float:
    """Calibrate solved-count evidence into MasteryEngine correctness [0..1]."""
    if solved <= 0:
        return 0.0
    return min(MAX_SIGNAL_CORRECTNESS, solved / EXPECTED_SOLVED_PER_TOPIC)


def upsert_signal(db: Session, user_id: str, platform: str, signal_type: str,
                  topic_id: str, value: dict) -> PlatformSignal:
    row = db.query(PlatformSignal).filter(
        PlatformSignal.user_id == user_id,
        PlatformSignal.platform == platform,
        PlatformSignal.signal_type == signal_type,
        PlatformSignal.topic_id == topic_id,
    ).first()
    if row:
        row.value = value
        row.observed_at = datetime.now(timezone.utc)
    else:
        row = PlatformSignal(user_id=user_id, platform=platform,
                             signal_type=signal_type, topic_id=topic_id, value=value)
        db.add(row)
    return row


def persist_leetcode(db: Session, user_id: str, profile: dict,
                     handle: str = "") -> dict:
    """Persist a leetcode_service.pull_everything() result. Returns summary."""
    now = datetime.now(timezone.utc)
    signals = 0
    upsert_signal(db, user_id, "leetcode", "profile", "",
                  {"username": profile.get("username", handle),
                   "ranking": profile.get("ranking"),
                   "pulled_at": profile.get("pulled_at", now.isoformat())})
    signals += 1
    upsert_signal(db, user_id, "leetcode", "difficulty_split", "",
                  {"split": profile.get("difficulty_split", {})})
    signals += 1
    for tid, solved in (profile.get("topic_solved") or {}).items():
        upsert_signal(db, user_id, "leetcode", "topic_solved", tid,
                      {"count": int(solved)})
        signals += 1
    for s in profile.get("recent_ac", [])[:50]:
        upsert_signal(db, user_id, "leetcode", "recent_ac",
                      s.get("title_slug", ""),
                      {"title": s.get("title", ""), "timestamp": s.get("timestamp", 0)})
        signals += 1

    prof = db.query(Profile).filter(Profile.user_id == user_id).first()
    if prof:
        prof.leetcode_username = profile.get("username", handle)
        prof.leetcode_synced_at = now
        prof.leetcode_last_error = ""  # success clears any expiry flag
    db.commit()
    return {"signals": signals, "username": profile.get("username", handle),
            "total_solved": profile.get("total_solved", 0)}


def ingest_topic_signals(db: Session, user_id: str,
                         topic_solved: dict[str, int],
                         active_topics: set[str] | None = None,
                         source_id: str = "leetcode",
                         reason_prefix: str = "leetcode pull") -> list[dict]:
    """Blend per-topic solved counts into MasteryNodes. Creates nodes for
    known topics the user doesn't have yet (so the graph grows from real
    signal). Returns per-topic results for the API response."""
    from app.workflows.onboarding import ensure_seed_topics
    ensure_seed_topics(db)
    active_topics = active_topics or set()
    results = []
    now = datetime.now(timezone.utc)
    for tid, solved in (topic_solved or {}).items():
        topic = db.query(Topic).filter(Topic.id == tid).first()
        if not topic:
            # Unknown mapped topic — signal is stored but no node is invented.
            continue
        node = db.query(MasteryNode).filter(
            MasteryNode.user_id == user_id, MasteryNode.topic_id == tid).first()
        created = False
        if not node:
            node = MasteryNode(user_id=user_id, topic_id=tid, pattern=tid,
                               mastery_score=0.35, confidence=0.35,
                               importance_weight=topic.importance)
            db.add(node)
            db.flush()
            created = True
        prev = node.mastery_score
        correctness = _signal_correctness(int(solved))
        r = MasteryEngine.update(prev, correctness, 600, 600, 0, node.confidence)
        node.mastery_score = r.new_score
        node.confidence = min(0.95, node.confidence + 0.1)
        if tid in active_topics:
            node.last_seen = now
        db.add(MasteryHistory(
            user_id=user_id, mastery_node_id=node.id,
            previous_score=prev, new_score=r.new_score, delta=r.delta,
            source_type="PLATFORM_SIGNAL", source_id=source_id,
            reason=f"{reason_prefix}: {solved} solved in {tid}"
                   + (" (recent activity)" if tid in active_topics else "")))
        results.append({"topic_id": tid, "solved": int(solved), "created": created,
                        "previous": round(prev, 4), "new": r.new_score,
                        "delta": r.delta})
    db.commit()
    return results


def ingest_codeforces(db: Session, user_id: str, cf_result: dict) -> dict:
    """Persist a codeforces_service result (tags -> topic signals)."""
    handle = cf_result.get("handle", "")
    upsert_signal(db, user_id, "codeforces", "profile", "",
                  {"handle": handle, "rating": cf_result.get("rating"),
                   "rank": cf_result.get("rank")})
    prof = db.query(Profile).filter(Profile.user_id == user_id).first()
    if prof:
        prof.codeforces_synced_at = datetime.now(timezone.utc)
    topic_solved: dict[str, int] = {}
    for tag, count in cf_result.get("top_tags", []):
        tid = topic_id_for_cf_tag(tag)
        topic_solved[tid] = topic_solved.get(tid, 0) + int(count)
    blended = []
    if topic_solved and "error" not in cf_result:
        blended = ingest_topic_signals(
            db, user_id, topic_solved, source_id=f"codeforces:{handle}",
            reason_prefix="codeforces pull")
    db.commit()
    return {"handle": handle, "signals": 1 + len(blended), "blended": blended}


def latest_topic_signals(db: Session, user_id: str, platform: str = "leetcode") -> dict[str, int]:
    """Convenience read: latest topic_solved signals for a platform."""
    rows = db.query(PlatformSignal).filter(
        PlatformSignal.user_id == user_id,
        PlatformSignal.platform == platform,
        PlatformSignal.signal_type == "topic_solved").all()
    return {r.topic_id: int((r.value or {}).get("count", 0)) for r in rows}


def mark_leetcode_error(db: Session, user_id: str, code: str) -> None:
    """Record the last LeetCode failure (e.g. LEETCODE_AUTH_EXPIRED) so the
    frontend can show 'cookies expired — re-enter them'. Cleared on success."""
    prof = db.query(Profile).filter(Profile.user_id == user_id).first()
    if prof:
        prof.leetcode_last_error = code
        db.commit()


def record_recent_ac(db: Session, user_id: str, platform: str, recent: list[dict],
                     handle: str = "") -> list[dict]:
    """Persist each recent AC as its own signal row (deduped by platform+slug).
    Powers the daily "what did I actually solve today" feed."""
    new_items = []
    for s in recent[:50]:
        # leetcode payloads use title_slug; codeforces payloads use slug/name.
        slug = (s.get("title_slug", "") or s.get("slug", "")
                or s.get("name", ""))
        if not slug:
            continue
        row = db.query(PlatformSignal).filter(
            PlatformSignal.user_id == user_id,
            PlatformSignal.platform == platform,
            PlatformSignal.signal_type == "recent_ac",
            PlatformSignal.topic_id == slug).first()
        if not row:
            upsert_signal(db, user_id, platform, "recent_ac", slug,
                          {"title": s.get("title", s.get("name", slug)),
                           "timestamp": int(s.get("timestamp", 0) or 0),
                           "handle": handle})
            new_items.append({"platform": platform, "slug": slug,
                              "title": s.get("title", s.get("name", slug)),
                              "timestamp": int(s.get("timestamp", 0) or 0)})
    db.commit()
    return new_items


def recent_activity_feed(db: Session, user_id: str, days: int = 7) -> list[dict]:
    """Daily solved-problems feed across platforms (newest first), for the
    dashboard 'platform progress' card. Reads persisted recent_ac signals."""
    cutoff = datetime.now(timezone.utc).timestamp() - days * 86400
    rows = db.query(PlatformSignal).filter(
        PlatformSignal.user_id == user_id,
        PlatformSignal.signal_type == "recent_ac").order_by(
        PlatformSignal.observed_at.desc()).limit(200).all()
    items = []
    for r in rows:
        ts = int((r.value or {}).get("timestamp", 0) or 0)
        if ts and ts < cutoff:
            continue
        items.append({"platform": r.platform, "slug": r.topic_id,
                      "title": (r.value or {}).get("title", r.topic_id),
                      "solved_at": datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
                      if ts else r.observed_at.isoformat()})
    items.sort(key=lambda i: i["solved_at"], reverse=True)
    return items[:60]


async def sync_codeforces(db: Session, user_id: str, handle: str) -> dict:
    """Full Codeforces sync: pull user.info + recent submissions (public API,
    no tokens), persist signals, blend topic evidence into the Mastery Model.
    Must be awaited — callers are async route handlers (platforms/sync on
    dashboard open / login); blocking the event loop here used to 500 the
    whole sync."""
    from app.services import codeforces_service
    info, status = await asyncio.gather(
        codeforces_service.get_user_info(handle),
        codeforces_service.get_user_status(handle, count=50))
    if "error" in info:
        return {"platform": "codeforces", "ok": False, "error": info["error"]}
    upsert_signal(db, user_id, "codeforces", "profile", "",
                  {"handle": handle, "rating": info.get("rating"),
                   "rank": info.get("rank")})
    topic_solved: dict[str, int] = {}
    recent = []
    for s in status.get("recent", []):
        if s.get("verdict") == "OK":
            recent.append({"name": s.get("problem", ""), "slug": s.get("problem", "").lower().replace(" ", "-"),
                           "timestamp": s.get("at", 0)})
            for t in s.get("tags", []):
                tid = topic_id_for_cf_tag(t)
                topic_solved[tid] = topic_solved.get(tid, 0) + 1
    prof = db.query(Profile).filter(Profile.user_id == user_id).first()
    if prof:
        prof.codeforces_synced_at = datetime.now(timezone.utc)
    db.commit()
    new_ac = record_recent_ac(db, user_id, "codeforces", recent, handle=handle)
    blended = ingest_topic_signals(db, user_id, topic_solved,
                                   source_id=f"codeforces:{handle}",
                                   reason_prefix="codeforces sync")
    db.commit()
    return {"platform": "codeforces", "ok": True, "handle": handle,
            "rating": info.get("rating"), "signals": 1 + len(blended) + len(new_ac),
            "blended": blended, "new_ac": len(new_ac)}
