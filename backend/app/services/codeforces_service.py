"""Codeforces public API wrapper. Official API only, graceful failure."""
import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


async def get_user_info(handle: str) -> dict:
    """Normalized: {handle, rating, rank, maxRating, organization} or {error}."""
    settings = get_settings()
    url = f"{settings.CODEFORCES_API_BASE_URL}/user.info"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, params={"handles": handle})
            data = r.json()
        if data.get("status") != "OK" or not data.get("result"):
            return {"error": "handle_not_found", "handle": handle}
        u = data["result"][0]
        return {"handle": u.get("handle", handle), "rating": u.get("rating", 0),
                "rank": u.get("rank", "unrated"), "maxRating": u.get("maxRating", 0),
                "organization": u.get("organisation", ""),
                "derived_signals": _signals_from_rating(u.get("rating", 0))}
    except Exception as e:
        log.info(f"codeforces unavailable: {e}")
        return {"error": "codeforces_unavailable", "handle": handle}


async def get_user_status(handle: str, count: int = 20, with_submissions: bool = True) -> dict:
    settings = get_settings()
    url = f"{settings.CODEFORCES_API_BASE_URL}/user.status"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, params={"handle": handle, "count": count})
            data = r.json()
        if data.get("status") != "OK":
            return {"error": "handle_not_found", "handle": handle}
        subs = data.get("result", [])
        solved = sum(1 for s in subs if s.get("verdict") == "OK")
        tags: dict[str, int] = {}
        recent: list[dict] = []
        for s in subs:
            if s.get("verdict") == "OK":
                for t in s.get("problem", {}).get("tags", []):
                    tags[t] = tags.get(t, 0) + 1
            problem = s.get("problem", {})
            recent.append({
                "id": s.get("id"),
                "problem": problem.get("name", ""),
                "tags": problem.get("tags", [])[:6],
                "rating": problem.get("rating", 0),
                "verdict": s.get("verdict", ""),
                "at": s.get("creationTimeSeconds", 0),
            })
        return {"handle": handle, "recent_submissions": len(subs), "solved": solved,
                "top_tags": sorted(tags.items(), key=lambda kv: -kv[1])[:10],
                "recent": recent[:count]}
    except Exception as e:
        log.info(f"codeforces unavailable: {e}")
        return {"error": "codeforces_unavailable", "handle": handle}


def _signals_from_rating(rating: int) -> list[dict]:
    level = min(1.0, max(0.0, rating / 2400)) if rating else 0.0
    return [{"pattern": "competitive-programming", "signal": round(level, 3), "source": "CODEFORCES"}]
