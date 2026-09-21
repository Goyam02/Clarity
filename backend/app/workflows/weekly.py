"""Weekly rhythm (spec §7): one mock OA + one mock interview per week, kept
deliberately light-touch — skippable/reschedulable in one tap. Same pipeline
as CODE RED, just scheduled instead of crunch-triggered.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.errors import ClarityError
from app.models import WeeklyMock

KINDS = ("OA", "Interview")


def _monday(now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    monday = now.date() - timedelta(days=now.weekday())
    return monday.isoformat()


def ensure_week(db: Session, user_id: str) -> list[WeeklyMock]:
    """Idempotently create this week's two mock slots (skippable, not obligations)."""
    week = _monday()
    existing = db.query(WeeklyMock).filter(
        WeeklyMock.user_id == user_id, WeeklyMock.week_start == week).all()
    kinds = {m.kind for m in existing}
    created = False
    for kind in KINDS:
        if kind not in kinds:
            # Default slots: OA Saturday 10:00 UTC, Interview Sunday 10:00 UTC.
            base = datetime.fromisoformat(week + "T10:00:00+00:00")
            scheduled = base + (timedelta(days=5) if kind == "OA" else timedelta(days=6))
            db.add(WeeklyMock(user_id=user_id, kind=kind, week_start=week,
                              scheduled_for=scheduled, status="scheduled"))
            created = True
    if created:
        db.commit()
    return db.query(WeeklyMock).filter(
        WeeklyMock.user_id == user_id, WeeklyMock.week_start == week).all()


def week_schedule(db: Session, user_id: str) -> dict:
    mocks = ensure_week(db, user_id)
    return {"week_start": _monday(), "mocks": [
        {"id": m.id, "kind": m.kind, "status": m.status,
         "scheduled_for": m.scheduled_for.isoformat() if m.scheduled_for else "",
         "session_id": m.session_id} for m in mocks]}


def _get(db: Session, user_id: str, mock_id: str) -> WeeklyMock:
    m = db.query(WeeklyMock).filter(
        WeeklyMock.id == mock_id, WeeklyMock.user_id == user_id).first()
    if not m:
        raise ClarityError("SESSION_NOT_FOUND", "Weekly mock not found", 404)
    return m


def skip(db: Session, user_id: str, mock_id: str) -> dict:
    m = _get(db, user_id, mock_id)
    m.status = "skipped"
    db.commit()
    return {"id": m.id, "status": m.status}


def reschedule(db: Session, user_id: str, mock_id: str, when: str) -> dict:
    m = _get(db, user_id, mock_id)
    try:
        dt = datetime.fromisoformat(when.replace("Z", "+00:00"))
    except ValueError as e:
        raise ClarityError("VALIDATION_ERROR", f"Invalid datetime: {when}", 400) from e
    m.scheduled_for = dt
    m.status = "scheduled"
    db.commit()
    return {"id": m.id, "status": m.status,
            "scheduled_for": m.scheduled_for.isoformat()}


def mark_completed(db: Session, user_id: str, mock_id: str, session_id: str) -> dict:
    m = _get(db, user_id, mock_id)
    m.status = "completed"
    m.session_id = session_id
    db.commit()
    return {"id": m.id, "status": m.status, "session_id": m.session_id}
