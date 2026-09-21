"""Auth: minimal HS256 JWT (stdlib only) for MVP + dev X-User-Id header fallback.

Passwords use PBKDF2-HMAC-SHA256 (stdlib only, per-user salt). Production
should replace with Entra ID validation; every user-scoped query must still
filter by the authenticated user_id (see dependencies.get_current_user_id).
"""
import base64
import hashlib
import hmac
import json
import secrets
import time
import uuid

from app.core.config import get_settings

settings = get_settings()


# --- Passwords (PBKDF2, stdlib only) -------------------------------------

_PBKDF2_ITERATIONS = 240_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt, hexdigest = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt.encode(), int(iterations))
        return hmac.compare_digest(digest.hex(), hexdigest)
    except Exception:
        return False


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


def new_state() -> str:
    """CSRF state token for OAuth flows (short-lived, stored client-side)."""
    return secrets.token_urlsafe(24)
