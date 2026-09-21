"""LeetCode authenticated GraphQL client (docs/plans/plan-leetcode-pulls.md).

Uses the two per-user tokens the candidate pastes into onboarding/settings:
LEETCODE_SESSION + csrftoken cookies. Only leetcode.com is ever called with
them; plaintext tokens exist in memory for the duration of the request.

Public queries (no cookies) also work for basic profile stats — used as
fallback when the session cookie is absent. Recent-AC submissions REQUIRE the
session cookie.

Errors are loud, typed ClarityErrors:
- LEETCODE_AUTH_EXPIRED (401): cookies present but rejected/expired.
- LEETCODE_UNREACHABLE (502): network/transport failure.
- LEETCODE_NOT_CONNECTED (400): no cookies stored for this user.
"""
import asyncio
from datetime import datetime, timezone

import httpx

from app.core.config import get_settings
from app.core.errors import ClarityError
from app.core.logging import get_logger
from app.services.topic_map import topic_id_for_lc_slug

log = get_logger(__name__)

RECENT_AC_QUERY = """
query recentAcSubmissionList($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id title titleSlug timestamp
  }
}
"""

PROFILE_QUERY = """
query userPublicProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile { ranking reputation }
    submitStatsGlobal {
      acSubmissionNum { difficulty count }
    }
    tagProblemCounts {
      advanced { tagName tagSlug problemsSolved }
      intermediate { tagName tagSlug problemsSolved }
      fundamental { tagName tagSlug problemsSolved }
    }
  }
}
"""


class LeetCodeClient:
    def __init__(self, session_cookie: str = "", csrf_token: str = "") -> None:
        self.session_cookie = session_cookie.strip()
        self.csrf_token = csrf_token.strip()

    @property
    def has_auth(self) -> bool:
        return bool(self.session_cookie and self.csrf_token)

    def _headers(self) -> dict:
        settings = get_settings()
        headers = {
            "Content-Type": "application/json",
            "Referer": "https://leetcode.com",
            "User-Agent": "clarity-app/1.0 (own-profile pull)",
        }
        if self.has_auth:
            headers["Cookie"] = (f"LEETCODE_SESSION={self.session_cookie}; "
                                 f"csrftoken={self.csrf_token}")
            headers["X-CSRFToken"] = self.csrf_token
        return headers

    async def _graphql(self, query: str, variables: dict) -> dict:
        settings = get_settings()
        try:
            async with httpx.AsyncClient(timeout=settings.LEETCODE_REQUEST_TIMEOUT) as client:
                r = await client.post(settings.LEETCODE_GRAPHQL_URL,
                                      json={"query": query, "variables": variables},
                                      headers=self._headers())
        except (httpx.HTTPError, OSError) as e:
            raise ClarityError("LEETCODE_UNREACHABLE",
                               f"LeetCode could not be reached: {e}", 502) from e
        if r.status_code in (401, 403):
            raise ClarityError(
                "LEETCODE_AUTH_EXPIRED",
                "LeetCode rejected the stored cookies — they likely expired. "
                "Re-enter LEETCODE_SESSION and csrftoken to re-sync.", 401)
        if r.status_code == 429:
            raise ClarityError("LEETCODE_RATE_LIMITED",
                               "LeetCode rate-limited this request — retry later.", 429)
        if r.status_code != 200:
            raise ClarityError("LEETCODE_UNREACHABLE",
                               f"LeetCode returned HTTP {r.status_code}", 502)
        try:
            data = r.json()
        except ValueError as e:
            raise ClarityError("LEETCODE_UNREACHABLE",
                               "LeetCode returned a non-JSON response", 502) from e
        if data.get("errors"):
            # GraphQL-level error (e.g. unknown username) — treat as auth/profile issue.
            msg = "; ".join(e.get("message", "") for e in data["errors"])[:300]
            raise ClarityError("LEETCODE_AUTH_EXPIRED",
                               f"LeetCode GraphQL error: {msg}", 401)
        return data.get("data") or {}

    # --- public API -----------------------------------------------------------

    async def fetch_profile(self, username: str) -> dict:
        """Profile stats: difficulty split + per-topic solved counts (mapped to
        clarity topic ids)."""
        data = await self._graphql(PROFILE_QUERY, {"username": username})
        mu = data.get("matchedUser")
        if not mu:
            raise ClarityError("LEETCODE_PROFILE_NOT_FOUND",
                               f"LeetCode user '{username}' not found", 404)
        diff = {d["difficulty"].lower(): d["count"]
                for d in (mu.get("submitStatsGlobal") or {}).get("acSubmissionNum", [])}
        topics: dict[str, int] = {}
        for bucket in (mu.get("tagProblemCounts") or {}).values():
            for tag in bucket or []:
                tid = topic_id_for_lc_slug(tag.get("tagSlug", ""))
                if tag.get("problemsSolved"):
                    topics[tid] = topics.get(tid, 0) + int(tag["problemsSolved"])
        return {
            "username": mu.get("username", username),
            "ranking": (mu.get("profile") or {}).get("ranking"),
            "difficulty_split": diff,          # {"easy": n, "medium": n, "hard": n}
            "total_solved": sum(diff.values()),
            "topic_solved": topics,            # clarity topic id -> solved count
        }

    async def fetch_recent_ac(self, username: str, limit: int = 20) -> list[dict]:
        """Recent accepted submissions (requires session cookie)."""
        data = await self._graphql(RECENT_AC_QUERY, {"username": username, "limit": limit})
        subs = data.get("recentAcSubmissionList") or []
        return [{"id": s.get("id", ""), "title": s.get("title", ""),
                 "title_slug": s.get("titleSlug", ""),
                 "timestamp": int(s.get("timestamp", 0) or 0)} for s in subs]

    async def pull_everything(self, username_hint: str = "") -> dict:
        """Full pull used by the platform-pull route. Username comes from the
        JWT session payload when authenticated, else the provided hint (from
        the profile URL field or a plain handle). Without cookies this still
        works for public profile stats — recent-AC just comes back empty."""
        username = username_hint
        if not username and self.has_auth:
            # Decode just the username claim (signature not verified by us —
            # LeetCode already authenticated the cookie).
            import base64
            import json
            try:
                payload_b64 = self.session_cookie.split(".")[1]
                payload_b64 += "=" * (-len(payload_b64) % 4)
                claims = json.loads(base64.urlsafe_b64decode(payload_b64))
                username = claims.get("username", "") or claims.get("user_slug", "")
            except Exception:
                username = ""
        if not username:
            raise ClarityError("VALIDATION_ERROR",
                               "LeetCode username could not be determined — "
                               "paste your profile handle too", 400)

        profile = await self.fetch_profile(username)
        recent: list[dict] = []
        if self.has_auth:
            try:
                recent = await self.fetch_recent_ac(username)
            except ClarityError as e:
                # Profile stats still stand even if recent-AC is unavailable.
                log.info(f"leetcode recent_ac unavailable: {e.message}")
                if e.code == "LEETCODE_RATE_LIMITED":
                    raise
        profile["recent_ac"] = recent
        profile["pulled_at"] = datetime.now(timezone.utc).isoformat()
        return profile


def normalize_username(raw: str) -> str:
    """Accept a LeetCode profile URL (https://leetcode.com/u/<name>/,
    /profile/<name>, or bare leetcode.com/<name>) or a plain username and
    return the username. Lets onboarding ask for one forgiving field."""
    s = (raw or "").strip()
    if not s:
        return ""
    if "leetcode.com" in s.lower() or s.lower().startswith(("http://", "https://")):
        from urllib.parse import urlparse
        try:
            url = s if "://" in s else f"https://{s}"
            path = urlparse(url).path.strip("/")
        except ValueError:
            path = s
        parts = [p for p in path.split("/") if p]
        if parts and parts[0] in ("u", "profile", "users"):
            parts = parts[1:]
        return parts[0] if parts else ""
    return s.split("/")[0].strip()


def decrypt_cookies_or_empty(session_encrypted: str, csrf_encrypted: str) -> tuple[str, str]:
    from app.services.secret_box import get_secret_box
    box = get_secret_box()
    return box.decrypt(session_encrypted), box.decrypt(csrf_encrypted)


async def pull_for_user(db, user_id: str, username_hint: str = "") -> dict:
    """Load stored cookies for a user, pull everything. Raises LEETCODE_NOT_CONNECTED
    when no cookies are stored."""
    from app.models import Profile
    prof = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not prof or not prof.leetcode_session_encrypted:
        raise ClarityError("LEETCODE_NOT_CONNECTED",
                           "No LeetCode cookies stored — connect first", 400)
    session, csrf = decrypt_cookies_or_empty(
        prof.leetcode_session_encrypted, prof.leetcode_csrf_encrypted)
    if not (session and csrf):
        raise ClarityError("LEETCODE_NOT_CONNECTED",
                           "Stored cookies could not be decrypted (key rotated?) — "
                           "re-enter them", 400)
    client = LeetCodeClient(session, csrf)
    return await client.pull_everything(username_hint or prof.leetcode_username)


async def verify_tokens(session_cookie: str, csrf_token: str, username_hint: str = "") -> dict:
    """Validate freshly-entered tokens by doing a real pull (used by connect
    route before persisting). Returns the profile dict."""
    client = LeetCodeClient(session_cookie, csrf_token)
    return await client.pull_everything(username_hint)


def recent_activity_topics(recent: list[dict], since_epoch: int | None = None) -> list[str]:
    """Clarity topic ids seen in recent AC submissions (slug-mapped), for
    last_seen bumps during ingest."""
    if since_epoch is None:
        now = datetime.now(timezone.utc).timestamp()
        since_epoch = now - 30 * 86400  # last 30 days count as "active"
    out: list[str] = []
    for s in recent:
        if s.get("timestamp", 0) >= since_epoch:
            tid = topic_id_for_lc_slug(s.get("title_slug", ""))
            if tid and tid not in out:
                out.append(tid)
    return out
