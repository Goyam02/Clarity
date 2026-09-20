"""Auth endpoints: register, login, Google sign-in, me."""
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import ClarityError
from app.core.security import create_access_token, hash_password, new_state, verify_password
from app.dependencies import get_current_user_id, get_db
from app.models import Profile, User

router = APIRouter()


class RegisterIn(BaseModel):
    email: str
    name: str = ""
    password: str = ""


class LoginIn(BaseModel):
    email: str
    password: str


def _issue(user: User) -> dict:
    return {"user_id": user.id, "email": user.email,
            "token": create_access_token(user.id)}


@router.post("/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise ClarityError("VALIDATION_ERROR", "A valid email is required", 400)
    user = db.query(User).filter(User.email == email).first()
    if user:
        raise ClarityError("EMAIL_TAKEN", "An account with this email already exists", 409)
    if body.password and len(body.password) < 8:
        raise ClarityError("VALIDATION_ERROR", "Password must be at least 8 characters", 400)
    user = User(email=email, name=body.name,
                password_hash=hash_password(body.password) if body.password else "")
    db.add(user)
    db.commit()
    db.refresh(user)
    db.add(Profile(user_id=user.id))
    db.commit()
    return _issue(user)


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise ClarityError("INVALID_CREDENTIALS", "Email or password is incorrect", 401)
    return _issue(user)


@router.get("/google/url")
def google_url():
    """Spec Screen 1: Google sign-in. Returns the consent-screen URL to open."""
    settings = get_settings()
    if not settings.google_oauth_enabled:
        raise ClarityError(
            "AUTH_NOT_CONFIGURED",
            "Google sign-in is not configured: set GOOGLE_CLIENT_ID and "
            "GOOGLE_CLIENT_SECRET (see .env.example).", 501)
    state = new_state()
    from urllib.parse import urlencode
    params = urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    })
    return {"auth_url": f"https://accounts.google.com/o/oauth2/v2/auth?{params}",
            "state": state}


class GoogleCallbackIn(BaseModel):
    code: str
    state: str = ""


@router.post("/google/callback")
async def google_callback(body: GoogleCallbackIn, db: Session = Depends(get_db)):
    settings = get_settings()
    if not settings.google_oauth_enabled:
        raise ClarityError(
            "AUTH_NOT_CONFIGURED",
            "Google sign-in is not configured: set GOOGLE_CLIENT_ID and "
            "GOOGLE_CLIENT_SECRET (see .env.example).", 501)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            tok = await client.post("https://oauth2.googleapis.com/token", data={
                "code": body.code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            })
            tok.raise_for_status()
            access = tok.json().get("access_token")
            if not access:
                raise ClarityError("AUTH_FAILED", "Google did not return an access token", 401)
            info = await client.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={"Authorization": f"Bearer {access}"})
            info.raise_for_status()
            profile_data = info.json()
    except httpx.HTTPError as e:
        raise ClarityError("AUTH_FAILED", f"Google sign-in failed: {e}", 401) from e

    sub = profile_data.get("sub", "")
    email = (profile_data.get("email") or "").strip().lower()
    if not email:
        raise ClarityError("AUTH_FAILED", "Google account has no email", 401)
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, name=profile_data.get("name", ""), google_sub=sub)
        db.add(user)
        db.commit()
        db.refresh(user)
        db.add(Profile(user_id=user.id))
        db.commit()
    elif sub and not user.google_sub:
        user.google_sub = sub
        db.commit()
    return _issue(user)


@router.get("/me")
def me(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ClarityError("USER_NOT_FOUND", "User not found", 404)
    return {"user_id": user.id, "email": user.email, "name": user.name,
            "has_password": bool(user.password_hash), "google_linked": bool(user.google_sub)}
