#!/usr/bin/env python
"""Live E2E test for LeetCode cookie pulls (plan: docs/plans/plan-leetcode-pulls.md).

Runs BOTH layers against the real LeetCode API:
  1. Service layer: LeetCodeClient.pull_everything() with the given tokens.
  2. Full API E2E: registers a throwaway user in the running backend, connects
     via POST /users/me/leetcode, checks mastery nodes got built from the pull,
     and verifies the activity feed + sync routes.

Usage:
  python scripts/test_leetcode_live.py --session <LEETCODE_SESSION> --csrf <csrftoken> \
      [--base-url http://localhost:8000] [--username rachitgoyell]

Security: tokens are read from argv/env, sent only to leetcode.com and your
local backend, and never printed. The throwaway user is deleted at the end.
"""
import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import httpx  # noqa: E402

BASE = os.environ.get("CLARITY_BASE_URL", "http://localhost:8000")


def _headers(uid: str) -> dict:
    return {"X-User-Id": uid}


async def service_layer_check(session: str, csrf: str, username: str) -> dict:
    """Layer 1: hit leetcode.com directly through the service client."""
    from app.services.leetcode_service import LeetCodeClient, recent_activity_topics

    client = LeetCodeClient(session, csrf)
    profile = await client.pull_everything(username)
    print("\n== Layer 1: LeetCode service client ==")
    print(f"  username        : {profile['username']}")
    print(f"  ranking         : {profile.get('ranking')}")
    print(f"  total solved    : {profile['total_solved']} "
          f"{profile.get('difficulty_split', {})}")
    topics = profile.get("topic_solved", {})
    top = sorted(topics.items(), key=lambda kv: -kv[1])[:8]
    print(f"  mapped topics   : {len(topics)} (top: "
          + ", ".join(f"{t}={n}" for t, n in top) + ")")
    recent = profile.get("recent_ac", [])
    print(f"  recent AC pulled: {len(recent)}"
          + (f" — latest: {recent[0]['title']}" if recent else ""))
    active = recent_activity_topics(recent)
    print(f"  recent activity : {len(active)} topics active in last 30 days")
    return profile


async def api_layer_check(base_url: str, session: str, csrf: str, username: str) -> None:
    """Layer 2: full backend E2E with a throwaway user.

    DB assertions run inside the BACKEND's own database (Postgres in docker
    compose, or a local sqlite when CLARITY_LOCAL_DB is set) — not a second
    sqlite mirror, which would silently assert against the wrong data."""
    import app.models  # noqa: F401  (register metadata)
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.config import get_settings
    from app.services.secret_box import get_secret_box
    from app.models import PlatformSignal, MasteryNode, Profile

    settings = get_settings()
    # The DB to assert against: prefer an explicit CLARITY_CHECK_DB (the
    # backend's real Postgres), else whatever the local settings resolve to.
    check_url = os.environ.get("CLARITY_CHECK_DB") or settings.DATABASE_URL
    if check_url.startswith("sqlite"):
        import app.db.base  # noqa: F401
        from app.db.base import Base
        from sqlalchemy import create_engine as _ce
        _e = _ce(check_url)
        Base.metadata.create_all(bind=_e)
        _e.dispose()

    def open_db():
        # A fresh engine per open avoids cross-loop sqlite thread issues.
        eng = create_engine(check_url, pool_pre_ping=True)
        return sessionmaker(bind=eng)(), eng

    print("\n== Layer 2: full API E2E (throwaway user) ==")
    async with httpx.AsyncClient(timeout=40) as api:
        email = f"lc-live-{os.getpid()}@clarity-test.local"
        r = await api.post(f"{base_url}/api/v1/auth/register",
                           json={"email": email, "name": "LC Live"})
        r.raise_for_status()
        uid = r.json()["user_id"]
        h = _headers(uid)
        print(f"  throwaway user  : {uid}")

        # Initialize mastery so nodes exist to blend into.
        await api.post(f"{base_url}/api/v1/onboarding/initialize", headers=h)

        # Connect with real tokens (this pulls + ingests).
        r = await api.post(f"{base_url}/api/v1/users/me/leetcode", headers=h,
                           json={"leetcode_session": session, "leetcode_csrf": csrf,
                                 "leetcode_username": username})
        assert r.status_code == 200, f"connect failed: {r.status_code} {r.text[:400]}"
        body = r.json()
        print(f"  connect         : username={body['username']} "
              f"total_solved={body.get('total_solved')} "
              f"signals={body.get('signals')} blended={len(body.get('blended', []))}")
        for b in body.get("blended", [])[:5]:
            print(f"    - {b['topic_id']}: solved={b['solved']} "
                  f"mastery {b['previous']} -> {b['new']} (delta {b['delta']})")

        # DB assertions: signals persisted, cookies encrypted at rest.
        db, eng = open_db()
        try:
            n_signals = db.query(PlatformSignal).filter(
                PlatformSignal.user_id == uid).count()
            node = db.query(MasteryNode).filter(
                MasteryNode.user_id == uid,
                MasteryNode.topic_id.in_(["sliding-window", "two-pointers",
                                          "dp-knapsack", "graphs-bfs", "dsu"])).first()
            prof = db.query(Profile).filter(Profile.user_id == uid).first()
            assert n_signals >= 5, f"expected >=5 signals, got {n_signals}"
            assert node is not None, "no mastery node was built from the pull"
            assert prof.leetcode_session_encrypted, "cookies not persisted"
            ciphertext = prof.leetcode_session_encrypted
            assert ciphertext != session, "cookie stored as plaintext!"
            assert session[:16] not in ciphertext
            # Decrypt with the backend's own key when reachable (docker exec);
            # from outside we can only verify ciphertext-not-plaintext.
            print(f"  db assertions   : {n_signals} signals stored; node "
                  f"'{node.topic_id}' built; cookie stored encrypted "
                  f"({len(ciphertext)} chars, not plaintext)")
        finally:
            db.close()
            eng.dispose()

        # Activity feed shows the real solved problems.
        r = await api.get(f"{base_url}/api/v1/users/me/platforms/activity", headers=h)
        assert r.status_code == 200
        feed = r.json()["activity"]
        print(f"  activity feed   : {len(feed)} solved problems "
              + (f"(latest: {feed[0]['title']} @ {feed[0]['solved_at'][:16]})"
                 if feed else ""))

        # Sync route reports healthy status.
        r = await api.post(f"{base_url}/api/v1/users/me/platforms/sync", headers=h)
        assert r.status_code == 200, r.text[:300]
        sync_body = r.json()
        print(f"  platforms sync  : leetcode={sync_body['leetcode']['connected']} "
              f"expired={sync_body['leetcode']['expired']} "
              f"feed={len(sync_body['activity'])} items")

        # Cleanup throwaway user.
        r = await api.delete(f"{base_url}/api/v1/users/me", headers=h)
        assert r.status_code == 200
        print("  cleanup         : throwaway user deleted")


async def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--session", required=True, help="LEETCODE_SESSION cookie value")
    p.add_argument("--csrf", required=True, help="csrftoken cookie value")
    p.add_argument("--username", default="", help="LeetCode username (else decoded from JWT)")
    p.add_argument("--base-url", default=BASE, help="running Clarity backend")
    p.add_argument("--skip-api", action="store_true",
                   help="only run the direct service-layer check")
    args = p.parse_args()

    profile = await service_layer_check(args.session, args.csrf, args.username)

    if not args.skip_api:
        await api_layer_check(args.base_url, args.session, args.csrf,
                              args.username or profile["username"])

    print("\nAll live checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
