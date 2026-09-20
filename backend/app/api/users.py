"""User settings (spec §9): profile, connected accounts, target companies,
default mood, data export, account deletion. Kept intentionally thin — every
field feeds an agent or protects the account."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.errors import ClarityError
from app.dependencies import get_current_user_id, get_db
from app.models import (CalibrationRun, CodeRedSession, DailyPlan, InterviewEvent,
                        MasteryHistory, MasteryNode, MockSession, Outcome,
                        ProblemAttempt, Profile, User, WeeklyMock)
from app.schemas import CompanyAddIn, ProfilePatch
from app.services import company_corpus

router = APIRouter()


class LeetCodeConnectIn(BaseModel):
    leetcode_session: str
    leetcode_csrf: str
    leetcode_username: str = ""


def _profile_or_404(db: Session, user_id: str) -> Profile:
    prof = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not prof:
        prof = Profile(user_id=user_id)
        db.add(prof)
        db.commit()
        db.refresh(prof)
    return prof


def _settings_payload(db: Session, user: User) -> dict:
    prof = _profile_or_404(db, user.id)
    return {
        "user_id": user.id, "email": user.email, "name": user.name,
        "current_focus": prof.current_focus,
        "placement_timeline": prof.placement_timeline,
        "default_mood": prof.default_mood,
        "codeforces_handle": prof.codeforces_handle,
        "github_username": prof.github_username,
        "resume_blob_ref": prof.resume_blob_ref,
        "target_companies": prof.target_companies or [],
        "onboarding_complete": bool(prof.onboarding_complete),
        "google_linked": bool(user.google_sub),
        "has_password": bool(user.password_hash),
        "leetcode": _leetcode_status(prof),
    }


@router.get("/me")
def me(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """Contract alias for GET /users/me (see docs/api-contracts.md)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ClarityError("USER_NOT_FOUND", "User not found", 404)
    return _settings_payload(db, user)


@router.get("/me/settings")
def get_settings_view(user_id: str = Depends(get_current_user_id),
                      db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ClarityError("USER_NOT_FOUND", "User not found", 404)
    return _settings_payload(db, user)


@router.patch("/me/settings")
def patch_settings(body: ProfilePatch, user_id: str = Depends(get_current_user_id),
                   db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ClarityError("USER_NOT_FOUND", "User not found", 404)
    prof = _profile_or_404(db, user_id)
    if body.name is not None:
        user.name = body.name
    if body.current_focus is not None:
        prof.current_focus = body.current_focus
    if body.placement_timeline is not None:
        prof.placement_timeline = body.placement_timeline
    if body.default_mood is not None:
        prof.default_mood = body.default_mood
    if body.codeforces_handle is not None:
        prof.codeforces_handle = body.codeforces_handle
    if body.github_username is not None:
        prof.github_username = body.github_username
    db.commit()
    return _settings_payload(db, user)


# --- LeetCode cookie pulls (docs/plans/plan-leetcode-pulls.md) ------------------


def _leetcode_status(prof: Profile) -> dict:
    status = {
        "connected": bool(prof.leetcode_session_encrypted),
        "username": prof.leetcode_username or None,
        "last_synced": (prof.leetcode_synced_at.isoformat()
                        if prof.leetcode_synced_at else None),
        "last_error": prof.leetcode_last_error or None,
        "expired": prof.leetcode_last_error == "LEETCODE_AUTH_EXPIRED",
    }
    return status


@router.get("/me/leetcode")
def leetcode_status(user_id: str = Depends(get_current_user_id),
                    db: Session = Depends(get_db)):
    prof = _profile_or_404(db, user_id)
    return _leetcode_status(prof)


@router.post("/me/leetcode")
async def leetcode_connect(body: LeetCodeConnectIn,
                           user_id: str = Depends(get_current_user_id),
                           db: Session = Depends(get_db)):
    """Verify + store tokens (encrypted), pull everything, ingest into the
    Mastery Model. Failed verification records the error on the profile so the
    UI can report expired cookies."""
    from app.api.onboarding import _connect_leetcode
    from app.core.errors import ClarityError
    from app.services import platform_signals as ps
    try:
        summary = await _connect_leetcode(db, user_id, body.leetcode_session,
                                          body.leetcode_csrf, body.leetcode_username)
    except ClarityError as e:
        ps.mark_leetcode_error(db, user_id, e.code)
        raise
    prof = _profile_or_404(db, user_id)
    return {**summary, **_leetcode_status(prof)}


@router.post("/me/platforms/sync")
async def platforms_sync(user_id: str = Depends(get_current_user_id),
                         db: Session = Depends(get_db)):
    """Refresh every connected platform (LeetCode + Codeforces). Called when
    the user opens the dashboard — daily progress updates itself. LeetCode is
    skipped (not an error) when cookies have expired; the status endpoint
    reports that so the user can fix it."""
    from app.core.config import get_settings
    from app.services import leetcode_service as lc
    from app.services import platform_signals as ps
    from app.core.errors import ClarityError

    prof = _profile_or_404(db, user_id)
    results: dict[str, object] = {}

    # LeetCode (tokens) — skip silently on rate limit, report on auth expiry.
    if prof.leetcode_session_encrypted:
        min_interval = get_settings().LEETCODE_REFRESH_MIN_INTERVAL
        rate_limited = False
        if prof.leetcode_synced_at:
            last = prof.leetcode_synced_at if prof.leetcode_synced_at.tzinfo else (
                prof.leetcode_synced_at.replace(tzinfo=timezone.utc))
            if (datetime.now(timezone.utc) - last).total_seconds() < min_interval:
                rate_limited = True
        if not rate_limited:
            try:
                profile = await lc.pull_for_user(db, user_id)
                summary = ps.persist_leetcode(db, user_id, profile,
                                              handle=profile.get("username", ""))
                from app.services.leetcode_service import recent_activity_topics
                active = set(recent_activity_topics(profile.get("recent_ac", [])))
                summary["blended"] = ps.ingest_topic_signals(
                    db, user_id, profile.get("topic_solved", {}), active_topics=active)
                ps.record_recent_ac(db, user_id, "leetcode",
                                    profile.get("recent_ac", []),
                                    handle=profile.get("username", ""))
                results["leetcode"] = {"ok": True, **summary}
            except ClarityError as e:
                if e.code == "LEETCODE_AUTH_EXPIRED":
                    ps.mark_leetcode_error(db, user_id, e.code)
                    results["leetcode"] = {"ok": False, "error": e.code}
                elif e.code == "LEETCODE_RATE_LIMITED":
                    results["leetcode"] = {"ok": False, "error": "LEETCODE_RATE_LIMITED"}
                else:
                    results["leetcode"] = {"ok": False, "error": e.code}
        else:
            results["leetcode"] = {"ok": True, "skipped": "recently_synced"}

    # Codeforces (no tokens needed) — always syncs when a handle is set.
    if prof.codeforces_handle:
        results["codeforces"] = ps.sync_codeforces(db, user_id, prof.codeforces_handle)

    prof = _profile_or_404(db, user_id)
    return {"synced_at": datetime.now(timezone.utc).isoformat(),
            "results": results,
            "leetcode": _leetcode_status(prof),
            "activity": ps.recent_activity_feed(db, user_id)}


@router.get("/me/platforms/activity")
def platforms_activity(user_id: str = Depends(get_current_user_id),
                       db: Session = Depends(get_db)):
    """Recent solved-problems feed across platforms (persisted signals)."""
    from app.services import platform_signals as ps
    prof = _profile_or_404(db, user_id)
    return {"activity": ps.recent_activity_feed(db, user_id),
            "leetcode": _leetcode_status(prof),
            "codeforces_synced_at": (prof.codeforces_synced_at.isoformat()
                                     if prof.codeforces_synced_at else None)}


@router.post("/me/leetcode/refresh")
async def leetcode_refresh(user_id: str = Depends(get_current_user_id),
                           db: Session = Depends(get_db)):
    """Re-pull LeetCode only, using stored cookies (rate-limited per user)."""
    from app.core.config import get_settings
    from app.services import leetcode_service as lc
    from app.services import platform_signals as ps

    prof = _profile_or_404(db, user_id)
    if not prof.leetcode_session_encrypted:
        raise ClarityError("LEETCODE_NOT_CONNECTED",
                           "No LeetCode cookies stored — connect first", 400)
    min_interval = get_settings().LEETCODE_REFRESH_MIN_INTERVAL
    if prof.leetcode_synced_at:
        last = prof.leetcode_synced_at if prof.leetcode_synced_at.tzinfo else (
            prof.leetcode_synced_at.replace(tzinfo=timezone.utc))
        elapsed = (datetime.now(timezone.utc) - last).total_seconds()
        if elapsed < min_interval:
            raise ClarityError(
                "LEETCODE_RATE_LIMITED",
                f"Already synced {int(elapsed // 60)} min ago — retry in "
                f"{int((min_interval - elapsed) // 60) + 1} min", 429)
    profile = await lc.pull_for_user(db, user_id)
    summary = ps.persist_leetcode(db, user_id, profile,
                                  handle=profile.get("username", ""))
    from app.services.leetcode_service import recent_activity_topics
    active = set(recent_activity_topics(profile.get("recent_ac", [])))
    summary["blended"] = ps.ingest_topic_signals(db, user_id,
                                                 profile.get("topic_solved", {}),
                                                 active_topics=active)
    ps.record_recent_ac(db, user_id, "leetcode", profile.get("recent_ac", []),
                        handle=profile.get("username", ""))
    prof = _profile_or_404(db, user_id)
    return {**summary, **_leetcode_status(prof)}


@router.delete("/me/leetcode")
def leetcode_disconnect(user_id: str = Depends(get_current_user_id),
                        db: Session = Depends(get_db)):
    """Wipe stored cookies. Ingested signals/mastery stay (derived facts,
    not credentials)."""
    prof = _profile_or_404(db, user_id)
    prof.leetcode_session_encrypted = ""
    prof.leetcode_csrf_encrypted = ""
    db.commit()
    return {"disconnected": True, **_leetcode_status(prof)}


@router.get("/me/companies")
def list_companies(user_id: str = Depends(get_current_user_id),
                   db: Session = Depends(get_db)):
    prof = _profile_or_404(db, user_id)
    companies = []
    for name in prof.target_companies or []:
        companies.append({
            "name": name,
            "in_corpus": company_corpus.known_company(name),
            "top_patterns": company_corpus.company_anchor_patterns(name)[:5],
        })
    return {"companies": companies}


@router.post("/me/companies")
def add_company(body: CompanyAddIn, user_id: str = Depends(get_current_user_id),
                db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise ClarityError("VALIDATION_ERROR", "Company name is required", 400)
    prof = _profile_or_404(db, user_id)
    companies = list(prof.target_companies or [])
    if name not in companies:
        if len(companies) >= 5:
            raise ClarityError("VALIDATION_ERROR", "At most 5 target companies", 400)
        companies.append(name)
        prof.target_companies = companies
        db.commit()
    return {"companies": companies}


@router.delete("/me/companies/{name}")
def remove_company(name: str, user_id: str = Depends(get_current_user_id),
                   db: Session = Depends(get_db)):
    prof = _profile_or_404(db, user_id)
    companies = [c for c in (prof.target_companies or [])
                 if c.lower() != name.lower()]
    prof.target_companies = companies
    db.commit()
    return {"companies": companies}


@router.get("/me/export")
def export_data(user_id: str = Depends(get_current_user_id),
                db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ClarityError("USER_NOT_FOUND", "User not found", 404)
    prof = _profile_or_404(db, user_id)
    nodes = db.query(MasteryNode).filter(MasteryNode.user_id == user_id).all()
    node_ids = {n.id for n in nodes}
    history = db.query(MasteryHistory).filter(
        MasteryHistory.user_id == user_id).limit(2000).all()
    return {
        "profile": _settings_payload(db, user),
        "profile_detail": {
            "skills": prof.skills, "projects": prof.projects,
        },
        "mastery_nodes": [{"topic_id": n.topic_id, "pattern": n.pattern,
                           "mastery": n.mastery_score, "confidence": n.confidence,
                           "attempts": n.times_attempted} for n in nodes],
        "mastery_history": [{"previous": h.previous_score, "new": h.new_score,
                             "delta": h.delta, "source": h.source_type,
                             "at": h.created_at.isoformat() if h.created_at else ""}
                            for h in history],
        "daily_plans": [{"date": p.date, "mood": p.mood, "tasks": p.tasks}
                        for p in db.query(DailyPlan).filter(
                            DailyPlan.user_id == user_id).limit(200).all()],
        "outcomes": [{"company": o.company_id, "role": o.role, "round": o.round,
                      "result": o.result} for o in db.query(Outcome).filter(
                          Outcome.user_id == user_id).limit(200).all()],
    }


@router.delete("/me")
def delete_account(user_id: str = Depends(get_current_user_id),
                   db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ClarityError("USER_NOT_FOUND", "User not found", 404)
    # Delete user-owned rows; company profiles are shared seed data and stay.
    mock_ids = [s.id for s in db.query(MockSession).filter(
        MockSession.user_id == user_id).all()]
    cr_ids = [s.id for s in db.query(CodeRedSession).filter(
        CodeRedSession.user_id == user_id).all()]
    if mock_ids:
        db.query(InterviewEvent).filter(
            InterviewEvent.session_id.in_(mock_ids)).delete(synchronize_session=False)
    if cr_ids:
        from app.models import CodeRedTask
        db.query(CodeRedTask).filter(
            CodeRedTask.session_id.in_(cr_ids)).delete(synchronize_session=False)
    # MasteryHistory first: it references mastery_nodes.id (FK) but is
    # user-scoped; deleting nodes before it violates the constraint.
    for model in (MasteryHistory, MasteryNode, DailyPlan, CodeRedSession,
                  MockSession, Outcome, WeeklyMock, CalibrationRun,
                  ProblemAttempt, Profile):
        db.query(model).filter(model.user_id == user_id).delete()
    from app.models import PlatformSignal
    db.query(PlatformSignal).filter(PlatformSignal.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    return {"deleted": True}
