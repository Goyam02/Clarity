"""User settings (spec §9): profile, connected accounts, target companies,
default mood, data export, account deletion. Kept intentionally thin — every
field feeds an agent or protects the account."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import ClarityError
from app.dependencies import get_current_user_id, get_db
from app.models import (CalibrationRun, CodeRedSession, DailyPlan, InterviewEvent,
                        MasteryHistory, MasteryNode, MockSession, Outcome,
                        ProblemAttempt, Profile, User, WeeklyMock)
from app.schemas import CompanyAddIn, ProfilePatch
from app.services import company_corpus

router = APIRouter()


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
    for model in (MasteryNode, MasteryHistory, DailyPlan, CodeRedSession,
                  MockSession, Outcome, WeeklyMock, CalibrationRun,
                  ProblemAttempt, Profile):
        db.query(model).filter(model.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    return {"deleted": True}
