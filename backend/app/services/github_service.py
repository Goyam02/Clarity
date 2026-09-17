"""GitHub public API wrapper. No credentials required for MVP."""
import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


async def get_user_summary(username: str) -> dict:
    """Normalized: {username, repos, languages, topics} or {error}."""
    settings = get_settings()
    base = settings.GITHUB_API_BASE_URL
    try:
        async with httpx.AsyncClient(timeout=10, headers={"Accept": "application/vnd.github+json"}) as client:
            user = (await client.get(f"{base}/users/{username}")).json()
            if user.get("message") == "Not Found":
                return {"error": "user_not_found", "username": username}
            repos = (await client.get(f"{base}/users/{username}/repos",
                                      params={"per_page": 30})).json()
        languages: dict[str, int] = {}
        topics: dict[str, int] = {}
        names = []
        if isinstance(repos, list):
            for repo in repos:
                names.append(repo.get("name", ""))
                if repo.get("language"):
                    languages[repo["language"]] = languages.get(repo["language"], 0) + 1
                for t in repo.get("topics", []) or []:
                    topics[t] = topics.get(t, 0) + 1
        return {"username": username, "public_repos": user.get("public_repos", 0),
                "languages": languages, "topics": topics, "repositories": names[:30]}
    except Exception as e:
        log.info(f"github unavailable: {e}")
        return {"error": "github_unavailable", "username": username}
