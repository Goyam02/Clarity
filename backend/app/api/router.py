"""Versioned router: /api/v1/*."""
from fastapi import APIRouter

from app.api import (auth, daily, dashboard, extended, mastery, onboarding,
                     problems, submissions, uploads, users)

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])
router.include_router(mastery.router, prefix="/mastery", tags=["mastery"])
router.include_router(daily.router, prefix="/daily", tags=["daily"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
router.include_router(problems.router, prefix="/problems", tags=["problems"])
router.include_router(submissions.router, prefix="/submissions", tags=["submissions"])
router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
router.include_router(extended.router_codered, prefix="/code-red", tags=["code-red"])
router.include_router(extended.router_mock_oa, prefix="/mock-oa", tags=["mock-oa"])
router.include_router(extended.router_interviews, prefix="/interviews", tags=["interviews"])
router.include_router(extended.router_companies, prefix="/companies", tags=["companies"])
router.include_router(extended.router_outcomes, prefix="/outcomes", tags=["outcomes"])
router.include_router(extended.router_weekly, prefix="/weekly", tags=["weekly"])


@router.get("/health")
def health():
    return {"status": "ok"}
