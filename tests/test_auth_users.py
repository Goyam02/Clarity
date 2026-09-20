"""Phase 1: auth (password + google gating) and user settings endpoints."""
import pytest


def test_register_login_flow(client):
    r = client.post("/api/v1/auth/register",
                    json={"email": "auth-x@t.com", "name": "X", "password": "supersecret1"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["token"]

    ok = client.post("/api/v1/auth/login",
                     json={"email": "auth-x@t.com", "password": "supersecret1"})
    assert ok.status_code == 200 and ok.json()["user_id"] == body["user_id"]

    bad = client.post("/api/v1/auth/login",
                      json={"email": "auth-x@t.com", "password": "wrong-password"})
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_register_validation(client):
    dup = client.post("/api/v1/auth/register",
                      json={"email": "auth-x@t.com", "password": "supersecret1"})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "EMAIL_TAKEN"

    short = client.post("/api/v1/auth/register",
                        json={"email": "auth-y@t.com", "password": "short"})
    assert short.status_code == 400


def test_google_gated_when_unconfigured(client):
    r = client.get("/api/v1/auth/google/url")
    assert r.status_code == 501
    assert r.json()["error"]["code"] == "AUTH_NOT_CONFIGURED"


def test_error_envelope_shape(client):
    r = client.get("/api/v1/problems/does-not-exist", headers={"X-User-Id": "nobody"})
    assert r.status_code == 404
    err = r.json()["error"]
    assert set(err) == {"code", "message", "request_id"}


def test_settings_get_patch(client, user):
    h = user["headers"]
    s = client.get("/api/v1/users/me/settings", headers=h)
    assert s.status_code == 200, s.text
    assert "target_companies" in s.json() and "default_mood" in s.json()

    p = client.patch("/api/v1/users/me/settings",
                     json={"name": "New Name", "default_mood": "push",
                           "codeforces_handle": "tourist"}, headers=h)
    assert p.status_code == 200 and p.json()["default_mood"] == "push"
    assert p.json()["codeforces_handle"] == "tourist"


def test_users_me_alias(client, user):
    r = client.get("/api/v1/users/me", headers=user["headers"])
    assert r.status_code == 200 and r.json()["email"].endswith("@x.com")


def test_target_companies_management(client, user):
    h = user["headers"]
    a = client.post("/api/v1/users/me/companies", json={"name": "ServiceNow"}, headers=h)
    assert a.status_code == 200 and "ServiceNow" in a.json()["companies"]
    listing = client.get("/api/v1/users/me/companies", headers=h).json()["companies"]
    entry = next(c for c in listing if c["name"] == "ServiceNow")
    assert entry["in_corpus"] is True  # data/company-corpus has servicenow.csv
    assert entry["top_patterns"]

    # cap at 5
    for i in range(5):
        client.post("/api/v1/users/me/companies", json={"name": f"Co{i}"}, headers=h)
    sixth = client.post("/api/v1/users/me/companies", json={"name": "Co5"}, headers=h)
    assert sixth.status_code == 400

    d = client.delete("/api/v1/users/me/companies/servicenow", headers=h)
    assert d.status_code == 200 and "ServiceNow" not in d.json()["companies"]


def test_export_and_delete_account(client):
    r = client.post("/api/v1/auth/register",
                    json={"email": "del@t.com", "name": "D", "password": "supersecret1"})
    h = {"X-User-Id": r.json()["user_id"]}
    client.post("/api/v1/onboarding/initialize", headers=h)

    ex = client.get("/api/v1/users/me/export", headers=h)
    assert ex.status_code == 200
    body = ex.json()
    assert body["profile"]["email"] == "del@t.com"
    assert len(body["mastery_nodes"]) >= 5

    dl = client.delete("/api/v1/users/me", headers=h)
    assert dl.status_code == 200 and dl.json()["deleted"] is True
    gone = client.get("/api/v1/users/me", headers=h)
    assert gone.status_code == 404
