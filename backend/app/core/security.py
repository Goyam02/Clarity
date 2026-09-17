"""Auth: minimal HS256 JWT (stdlib only) for MVP + dev X-User-Id header fallback.

Production should replace with Entra ID validation; every user-scoped query
must still filter by the authenticated user_id (see dependencies.get_current_user_id).
"""
import base64
import hashlib
import hmac
import json
import time
import uuid

from app.core.config import get_settings

settings = get_settings()


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def create_access_token(user_id: str, expires_minutes: int = 60 * 24) -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64url(json.dumps(
        {"sub": user_id, "exp": int(time.time()) + expires_minutes * 60}).encode())
    sig = _b64url(hmac.new(settings.JWT_SECRET.encode(), f"{header}.{body}".encode(),
                           hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"


def decode_token(token: str) -> str | None:
    try:
        header, body, sig = token.split(".")
        expected = _b64url(hmac.new(settings.JWT_SECRET.encode(),
                                   f"{header}.{body}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, sig):
            return None
        payload = json.loads(_b64url_decode(body))
        if payload.get("exp", 0) < time.time():
            return None
        return str(payload.get("sub"))
    except Exception:
        return None


def new_id(prefix: str = "") -> str:
    uid = uuid.uuid4().hex[:12]
    return f"{prefix}{uid}" if prefix else uid
