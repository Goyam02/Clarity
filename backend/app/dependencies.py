"""Request-scoped dependencies: DB + authenticated user_id."""
from fastapi import Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decode_token
from app.db.session import get_db  # re-export for routes

settings = get_settings()


def get_current_user_id(
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
) -> str:
    """Bearer JWT preferred; X-User-Id header allowed only when DEV_AUTH_ALLOW_HEADER."""
    if authorization and authorization.lower().startswith("bearer "):
        uid = decode_token(authorization[7:])
        if uid:
            return uid
        raise HTTPException(status_code=401, detail="Invalid token")
    if x_user_id and settings.DEV_AUTH_ALLOW_HEADER:
        return x_user_id
    raise HTTPException(status_code=401, detail="Missing credentials")


__all__ = ["get_db", "get_current_user_id"]
