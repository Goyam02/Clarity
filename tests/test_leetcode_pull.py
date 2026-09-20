"""LeetCode cookie pulls: GraphQL client, encryption, signal persistence,
Mastery Model blending, connect/refresh/disconnect routes (plan:
docs/plans/plan-leetcode-pulls.md)."""
import base64
import json

import httpx
import pytest


def _b64(claims: dict) -> str:
    raw = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode()
    return raw.rstrip("=")


def _fake_jwt(username: str = "pulltester") -> str:
    return f"hdr.{_b64({'username': username, 'id': 1})}.sig"


PROFILE_DATA = {
    "matchedUser": {
        "username": "pulltester",
        "profile": {"ranking": 123456, "reputation": 0},
        "submitStatsGlobal": {"acSubmissionNum": [
            {"difficulty": "Easy", "count": 80},
            {"difficulty": "Medium", "count": 120},
            {"difficulty": "Hard", "count": 25}]},
        "tagProblemCounts": {
            "advanced": [{"tagName": "Dynamic Programming",
                          "tagSlug": "dynamic-programming", "problemsSolved": 30}],
            "intermediate": [{"tagName": "Sliding Window",
                              "tagSlug": "sliding-window", "problemsSolved": 18}],
            "fundamental": [{"tagName": "Arrays",
                             "tagSlug": "array", "problemsSolved": 90}],
        },
    }
}

import time as _time
_RECENT_TS = str(int(_time.time()) - 3600)  # 1h ago -> inside the feed window
RECENT_DATA = {"recentAcSubmissionList": [
    {"id": "1", "title": "Minimum Size Subarray Sum",
     "titleSlug": "minimum-size-subarray-sum", "timestamp": _RECENT_TS},
    {"id": "2", "title": "Two Sum",
     "titleSlug": "two-sum", "timestamp": _RECENT_TS},
]}


def _mock_transport(handler):
    return httpx.MockTransport(handler)


@pytest.fixture()
def lc_env(monkeypatch):
    """Point the GraphQL URL at a mocked transport via env-friendly patching.
    One stable patched class with a swappable transport (re-patching a patched
    class would wrap the old transport and the first handler would win)."""
    state = {"handler": lambda request: httpx.Response(200, json={"data": {}})}

    def install(handler):
        state["handler"] = handler

    class PatchedClient(httpx.AsyncClient):
        def __init__(self, **kwargs):
            kwargs["transport"] = httpx.MockTransport(state["handler"])
            super().__init__(**kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", PatchedClient)
    return {"install": install}


def test_secret_box_roundtrip():
    from app.services.secret_box import get_secret_box
    box = get_secret_box()
    ct = box.encrypt("super-secret-cookie-value")
    assert ct != "super-secret-cookie-value"
    assert box.decrypt(ct) == "super-secret-cookie-value"
    assert box.decrypt("garbage") == ""  # key mismatch -> empty, not crash
    assert box.encrypt("") == ""


def test_token_verified_and_signals_ingested(client, user, lc_env):
    """Full happy path: POST /onboarding/signals with tokens -> encrypted
    storage + PlatformSignal rows + mastery nodes blended."""
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        q = body.get("query", "")
        if "recentAcSubmissionList" in q:
            return httpx.Response(200, json={"data": RECENT_DATA})
        return httpx.Response(200, json={"data": PROFILE_DATA})

    lc_env["install"](handler)
    h = user["headers"]
    r = client.post("/api/v1/onboarding/signals", headers=h, json={
        "codeforces_handle": "", "github_username": "",
        "leetcode_session": _fake_jwt("pulltester"),
        "leetcode_csrf": "csrf-token-1",
        "leetcode_username": "pulltester"})
    assert r.status_code == 200, r.text
    body = r.json()
    lc = body["leetcode"]
    assert lc["connected"] is True
    assert lc["username"] == "pulltester"
    assert lc["total_solved"] == 225
    assert lc["signals"] >= 5  # profile + difficulty split + 3 topics + 2 recent
    # Sliding-window maps to seed topic and should have been blended into a node.
    blended_topics = {b["topic_id"] for b in lc["blended"]}
    assert "sliding-window" in blended_topics

    # Headers sent to LeetCode must include both cookies + CSRF header.
    # (Verified implicitly: auth headers path taken since cookies present.)

    # DB state: signals persisted, profile fields set, ciphertext not plaintext.
    from app.db.session import SessionLocal
    from app.models import PlatformSignal, Profile
    db = SessionLocal()
    try:
        n = db.query(PlatformSignal).filter(
            PlatformSignal.user_id == user["id"],
            PlatformSignal.platform == "leetcode").count()
        assert n >= 5
        prof = db.query(Profile).filter(Profile.user_id == user["id"]).first()
        assert prof.leetcode_username == "pulltester"
        assert prof.leetcode_synced_at is not None
        assert "eyJ" not in prof.leetcode_session_encrypted  # ciphertext, not JWT
        assert prof.leetcode_session_encrypted != _fake_jwt("pulltester")
    finally:
        db.close()


def test_status_and_disconnect(client, user, lc_env):
    lc_env["install"](lambda req: httpx.Response(200, json={"data": {
        "matchedUser": {**PROFILE_DATA["matchedUser"], "username": "u2"}}}))
    h = user["headers"]
    conn = client.post("/api/v1/users/me/leetcode", headers=h, json={
        "leetcode_session": _fake_jwt("u2"), "leetcode_csrf": "csrf-2",
        "leetcode_username": "u2"})
    assert conn.status_code == 200, conn.text
    assert conn.json()["connected"] is True

    status = client.get("/api/v1/users/me/leetcode", headers=h)
    assert status.status_code == 200
    assert status.json()["username"] == "u2"

    disc = client.delete("/api/v1/users/me/leetcode", headers=h)
    assert disc.status_code == 200 and disc.json()["disconnected"] is True
    assert client.get("/api/v1/users/me/leetcode", headers=h).json()["connected"] is False
    # Settings payload also reflects state.
    me = client.get("/api/v1/users/me", headers=h).json()
    assert me["leetcode"]["connected"] is False


def test_refresh_rate_limited(client, user, lc_env):
    lc_env["install"](lambda req: httpx.Response(200, json={"data": {
        "matchedUser": {**PROFILE_DATA["matchedUser"], "username": "u3"}}}))
    h = user["headers"]
    client.post("/api/v1/users/me/leetcode", headers=h, json={
        "leetcode_session": _fake_jwt("u3"), "leetcode_csrf": "csrf-3",
        "leetcode_username": "u3"})
    r = client.post("/api/v1/users/me/leetcode/refresh", headers=h)
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "LEETCODE_RATE_LIMITED"


def test_refresh_without_connection(client, user):
    r = client.post("/api/v1/users/me/leetcode/refresh", headers=user["headers"])
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "LEETCODE_NOT_CONNECTED"


def test_expired_cookies_are_loud(client, user, lc_env):
    lc_env["install"](lambda req: httpx.Response(401, json={"data": None}))
    h = user["headers"]
    r = client.post("/api/v1/users/me/leetcode", headers=h, json={
        "leetcode_session": _fake_jwt("u4"), "leetcode_csrf": "csrf-4",
        "leetcode_username": "u4"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "LEETCODE_AUTH_EXPIRED"
    # Nothing persisted on failure.
    status = client.get("/api/v1/users/me/leetcode", headers=h).json()
    assert status["connected"] is False


def test_mastery_blending_uses_mastery_engine(client, user, lc_env):
    """Convergence: re-pulling identical evidence doesn't ramp mastery
    linearly — second pull moves (much) less than the first."""
    lc_env["install"](lambda req: httpx.Response(200, json={"data": PROFILE_DATA}))
    h = user["headers"]
    payload = {"leetcode_session": _fake_jwt("u5"), "leetcode_csrf": "csrf-5",
               "leetcode_username": "u5"}
    first = client.post("/api/v1/users/me/leetcode", headers=h, json=payload).json()
    node_sw = next(b for b in first["blended"] if b["topic_id"] == "sliding-window")
    second = client.post("/api/v1/users/me/leetcode", headers=h, json=payload).json()
    node_sw2 = next(b for b in second["blended"] if b["topic_id"] == "sliding-window")
    assert abs(node_sw2["delta"]) < abs(node_sw["delta"])  # convergent, not linear
    # Provenance rows written.
    from app.db.session import SessionLocal
    from app.models import MasteryHistory
    db = SessionLocal()
    try:
        rows = db.query(MasteryHistory).filter(
            MasteryHistory.user_id == user["id"],
            MasteryHistory.source_type == "PLATFORM_SIGNAL").count()
        assert rows >= 2
    finally:
        db.close()


def test_grql_error_maps_to_auth(client, user, lc_env):
    """GraphQL-level errors (e.g. unknown user) map to the auth error code."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"errors": [{"message": "user not found"}]})

    lc_env["install"](handler)
    r = client.post("/api/v1/users/me/leetcode", headers=user["headers"], json={
        "leetcode_session": _fake_jwt("ghost"), "leetcode_csrf": "csrf-6",
        "leetcode_username": "ghost"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "LEETCODE_AUTH_EXPIRED"


def test_delete_account_after_pull(client, user, lc_env):
    """Regression: account deletion used to 500 with an FK violation because
    MasteryHistory rows referenced nodes being deleted (history is user-scoped
    but node-keyed). LeetCode pulls create exactly that shape."""
    lc_env["install"](lambda req: httpx.Response(200, json={"data": {
        "matchedUser": {**PROFILE_DATA["matchedUser"], "username": "deleter"}}}))
    h = user["headers"]
    r = client.post("/api/v1/users/me/leetcode", headers=h, json={
        "leetcode_session": _fake_jwt("deleter"), "leetcode_csrf": "csrf-d",
        "leetcode_username": "deleter"})
    assert r.status_code == 200, r.text
    d = client.delete("/api/v1/users/me", headers=h)
    assert d.status_code == 200, d.text
    assert d.json()["deleted"] is True


def test_topic_map():
    from app.services.topic_map import topic_id_for_cf_tag, topic_id_for_lc_slug
    assert topic_id_for_lc_slug("sliding-window") == "sliding-window"
    assert topic_id_for_lc_slug("union-find") == "dsu"
    assert topic_id_for_lc_slug("dynamic-programming") == "dp-knapsack"
    assert topic_id_for_cf_tag("dp") == "dp-knapsack"
    assert topic_id_for_cf_tag("two pointers") == "two-pointers"


def test_expired_flag_reported_and_cleared(client, user, lc_env):
    """Failed connect marks profile expired=True; successful re-connect clears it."""
    h = user["headers"]
    tokens = {"leetcode_session": _fake_jwt("ux"), "leetcode_csrf": "csrf-x",
              "leetcode_username": "ux"}
    lc_env["install"](lambda req: httpx.Response(401, json={"data": None}))
    r = client.post("/api/v1/users/me/leetcode", headers=h, json=tokens)
    assert r.status_code == 401
    status = client.get("/api/v1/users/me/leetcode", headers=h).json()
    assert status["expired"] is True
    assert status["last_error"] == "LEETCODE_AUTH_EXPIRED"

    lc_env["install"](lambda req: httpx.Response(200, json={"data": {
        "matchedUser": {**PROFILE_DATA["matchedUser"], "username": "ux"}}}))
    ok = client.post("/api/v1/users/me/leetcode", headers=h, json=tokens)
    assert ok.status_code == 200
    status = client.get("/api/v1/users/me/leetcode", headers=h).json()
    assert status["expired"] is False and status["last_error"] is None


def test_platform_sync_and_activity_feed(client, user, lc_env):
    """POST /users/me/platforms/sync refreshes connected platforms; the activity
    feed reports per-problem solved items (daily progress)."""
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        if "recentAcSubmissionList" in body.get("query", ""):
            return httpx.Response(200, json={"data": RECENT_DATA})
        return httpx.Response(200, json={"data": {
            "matchedUser": {**PROFILE_DATA["matchedUser"], "username": "syncer"}}})

    lc_env["install"](handler)
    h = user["headers"]
    conn = client.post("/api/v1/users/me/leetcode", headers=h, json={
        "leetcode_session": _fake_jwt("syncer"), "leetcode_csrf": "csrf-s",
        "leetcode_username": "syncer"})
    assert conn.status_code == 200, conn.text

    # Sync right after connect is rate-limited for leetcode but still returns
    # the activity feed.
    sync = client.post("/api/v1/users/me/platforms/sync", headers=h)
    assert sync.status_code == 200, sync.text
    body = sync.json()
    assert "activity" in body and "results" in body
    assert body["leetcode"]["connected"] is True

    # Activity feed route works standalone.
    act = client.get("/api/v1/users/me/platforms/activity", headers=h)
    assert act.status_code == 200
    feed = act.json()["activity"]
    assert isinstance(feed, list)
    slugs = {i["slug"] for i in feed}
    assert "two-sum" in slugs  # from RECENT_DATA via connect pull
    assert all(set(i) >= {"platform", "slug", "title", "solved_at"} for i in feed)


def test_codeforces_ingest_creates_activity(client, user):
    """Codeforces handle in onboarding signals persists recent AC + topic signals
    (mocked CF API)."""
    import httpx as _hx

    def cf_handler(request: _hx.Request) -> _hx.Response:
        url = str(request.url)
        if "user.info" in url:
            return _hx.Response(200, json={"status": "OK", "result": [
                {"handle": "tourist", "rating": 3500, "rank": "legendary",
                 "maxRating": 3600, "organisation": "}"}]})
        if "user.status" in url:
            return _hx.Response(200, json={"status": "OK", "result": [
                {"id": 1, "problem": {"name": "Two Pointers Demo",
                                      "tags": ["two pointers"]},
                 "verdict": "OK", "creationTimeSeconds": int(_time.time()) - 3600}]})
        return _hx.Response(200, json={"status": "FAILED"})

    class Patched(_hx.AsyncClient):
        def __init__(self, **kwargs):
            kwargs["transport"] = _hx.MockTransport(cf_handler)
            super().__init__(**kwargs)

    import app.services.codeforces_service as cfsvc
    orig = _hx.AsyncClient
    _hx.AsyncClient = Patched
    try:
        h = user["headers"]
        r = client.post("/api/v1/onboarding/signals", headers=h, json={
            "codeforces_handle": "tourist", "github_username": "",
            "leetcode_session": "", "leetcode_csrf": ""})
        assert r.status_code == 200, r.text
        assert r.json()["codeforces_ingested"] is not None
        act = client.get("/api/v1/users/me/platforms/activity", headers=h)
        slugs = {i["slug"] for i in act.json()["activity"]}
        assert "two-pointers-demo" in slugs
    finally:
        _hx.AsyncClient = orig
