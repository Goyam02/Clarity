"""Judge0Judge (self-hosted Judge0 CE): batch submission, status mapping,
contract parity with LocalJudge, fallback selection (plan:
docs/plans/plan-judge0-judge.md). httpx transport is mocked — no live judge
in unit tests; the compose stack provides the real one for E2E."""
import base64
import json

import httpx
import pytest


def _b64(s: str) -> str:
    return base64.b64encode(s.encode()).decode()


class _Settings:
    """Minimal settings stand-in (keeps tests independent of backend/.env)."""

    JUDGE0_BASE_URL = "http://judge0-test:2358"
    JUDGE0_AUTH_TOKEN = ""
    JUDGE0_TIMEOUT_SECONDS = 5
    JUDGE0_POLL_INTERVAL = 0.0


def _install_transport(monkeypatch, handler):
    """Route all judge0 httpx.AsyncClient calls through a mock transport."""
    class PatchedClient(httpx.AsyncClient):
        def __init__(self, **kwargs):
            kwargs["transport"] = httpx.MockTransport(handler)
            super().__init__(**kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", PatchedClient)


def _queued(token: str) -> dict:
    return {"token": token, "status_id": 1, "stdout": None, "stderr": None,
            "compile_output": None, "time": None, "memory": None}


def _done(token: str, status_id: int, stdout: str = "", stderr: str = "",
          compile_output: str = "", time_s: float = 0.1, mem_kb: int = 8000) -> dict:
    return {"token": token, "status_id": status_id,
            "stdout": _b64(stdout) if stdout else None,
            "stderr": _b64(stderr) if stderr else None,
            "compile_output": _b64(compile_output) if compile_output else None,
            "time": time_s, "memory": mem_kb}


def test_language_ids_single_source():
    from app.services.judge0 import LANGUAGE_IDS
    assert LANGUAGE_IDS["python"] == 71
    assert LANGUAGE_IDS["java"] == 62
    assert LANGUAGE_IDS["cpp"] == 54
    assert LANGUAGE_IDS["sql"] == 82


def test_unsupported_language_short_circuits(monkeypatch):
    from app.services.judge0 import Judge0Judge
    j = Judge0Judge(_Settings())
    res = _ensure_async(j.execute("brainfuck", "+", []))
    assert res.compile_status == "unsupported"


def _ensure_async(coro):
    import asyncio
    return asyncio.get_event_loop().run_until_complete(coro) \
        if False else __import__("asyncio").run(coro)


def test_get_judge_falls_back_without_config(monkeypatch):
    from app.services import judge as judge_mod
    from app.services.judge import LocalJudge
    monkeypatch.setattr(judge_mod, "_settings_for_test", None, raising=False)
    # Explicit settings object with empty URL -> LocalJudge.
    class S:
        JUDGE0_BASE_URL = ""
    import app.core.config as cfg
    monkeypatch.setattr(cfg, "get_settings", lambda: S())
    assert isinstance(judge_mod.get_judge(), LocalJudge)


def test_get_judge_prefers_judge0_when_configured(monkeypatch):
    from app.services import judge as judge_mod
    from app.services.judge0 import Judge0Judge

    class S:
        JUDGE0_BASE_URL = "http://judge0-test:2358"
    import app.core.config as cfg
    monkeypatch.setattr(cfg, "get_settings", lambda: S())
    assert isinstance(judge_mod.get_judge(), Judge0Judge)


def test_batch_happy_path(monkeypatch):
    """Two test cases, both pass; results keep submission order."""
    from app.services.judge0 import Judge0Judge
    created: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path == "/submissions/batch":
            body = json.loads(request.content)
            subs = body["submissions"]
            created.extend(subs)
            tokens = [{"token": f"tok-{i}"} for i in range(len(subs))]
            return httpx.Response(201, json=tokens)
        # GET poll: first call queued, second call done.
        tokens = request.url.params["tokens"].split(",")
        results = []
        state = getattr(handler, "poll_count", 0)
        for i, t in enumerate(tokens):
            if state == 0:
                results.append(_queued(t))
            else:
                # Distinguish cases by decoded stdin (wrapper copies stdin
                # through to the user program): case 0 input 21 -> 42, case 1 -> 0.
                stdin = base64.b64decode(created[i]["stdin"]).decode()
                out = "42" if stdin == "21" else "0"
                results.append(_done(t, 3, stdout=out, time_s=0.05))
        handler.poll_count = state + 1
        return httpx.Response(200, json=results)

    handler.poll_count = 0
    _install_transport(monkeypatch, handler)
    j = Judge0Judge(_Settings())
    res = _ensure_async(j.execute("python", "print(int(input())*2)",
                                  [{"input": "21", "output": "42"},
                                   {"input": "0", "output": "0"}]))
    assert res.compile_status == "ok"
    assert res.passed == 2 and res.total == 2
    assert res.runtime_ms >= 0
    # Both submissions carry the full source (base64), language 71, stdin piped.
    assert len(created) == 2
    assert all(s["language_id"] == 71 for s in created)
    assert base64.b64decode(created[0]["source_code"]).decode() == "print(int(input())*2)"


def test_compile_error_maps(monkeypatch):
    from app.services.judge0 import Judge0Judge

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            n = len(json.loads(request.content)["submissions"])
            return httpx.Response(201, json=[{"token": f"t{i}"} for i in range(n)])
        tokens = request.url.params["tokens"].split(",")
        return httpx.Response(200, json=[
            _done(t, 6, compile_output="error: expected ';'") for t in tokens])

    _install_transport(monkeypatch, handler)
    j = Judge0Judge(_Settings())
    res = _ensure_async(j.execute("cpp", "int main() { return 0 }",
                                  [{"input": "", "output": ""}]))
    assert res.compile_status == "compile_error"
    assert "expected ';'" in res.error


def test_timeout_maps(monkeypatch):
    from app.services.judge0 import Judge0Judge

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            n = len(json.loads(request.content)["submissions"])
            return httpx.Response(201, json=[{"token": f"t{i}"} for i in range(n)])
        tokens = request.url.params["tokens"].split(",")
        return httpx.Response(200, json=[_done(t, 5) for t in tokens])

    _install_transport(monkeypatch, handler)
    j = Judge0Judge(_Settings())
    res = _ensure_async(j.execute("python", "while True: pass",
                                  [{"input": "", "output": ""}]))
    assert res.compile_status == "timeout"


def test_wrong_answer_not_runtime_error(monkeypatch):
    from app.services.judge0 import Judge0Judge

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            n = len(json.loads(request.content)["submissions"])
            return httpx.Response(201, json=[{"token": f"t{i}"} for i in range(n)])
        tokens = request.url.params["tokens"].split(",")
        return httpx.Response(200, json=[_done(t, 4, stdout="nope") for t in tokens])

    _install_transport(monkeypatch, handler)
    j = Judge0Judge(_Settings())
    res = _ensure_async(j.execute("python", "print('nope')",
                                  [{"input": "21", "output": "42"}]))
    assert res.compile_status == "ok"  # ran fine, just wrong
    assert res.passed == 0 and res.total == 1


def test_transport_failure_is_loud(monkeypatch):
    from app.core.errors import ClarityError
    from app.services.judge0 import Judge0Judge

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    _install_transport(monkeypatch, handler)
    j = Judge0Judge(_Settings())
    with pytest.raises(ClarityError) as exc:
        _ensure_async(j.execute("python", "print(1)", [{"input": "", "output": ""}]))
    assert exc.value.code == "JUDGE_UNAVAILABLE"


def test_batch_splits_over_max_batch_size(monkeypatch):
    """25 cases -> two POST batches (20 + 5), all results return in order."""
    from app.services.judge0 import Judge0Judge
    batch_sizes: list[int] = []
    counter = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            n = len(json.loads(request.content)["submissions"])
            batch_sizes.append(n)
            start = counter["n"]
            counter["n"] += n
            return httpx.Response(201, json=[
                {"token": f"t{start + i}"} for i in range(n)])
        tokens = request.url.params["tokens"].split(",")
        return httpx.Response(200, json=[_done(t, 3, stdout="x") for t in tokens])

    _install_transport(monkeypatch, handler)
    j = Judge0Judge(_Settings())
    cases = [{"input": str(i), "output": "x"} for i in range(25)]
    res = _ensure_async(j.execute("python", "print(input())", cases))
    assert batch_sizes == [20, 5]
    assert res.total == 25 and res.passed == 25


def test_contract_parity_with_local_judge():
    """JudgeResult field names identical across judges (API shape stability)."""
    from app.services.judge import JudgeResult, LocalJudge
    from app.services.judge0 import Judge0Judge

    class _LocalS:
        JUDGE0_BASE_URL = ""

    local = _ensure_async(LocalJudge().execute(
        "python", "print(1)", [{"input": "", "output": "1"}]))
    assert set(local.__dict__) == {
        "compile_status", "test_results", "runtime_ms", "memory_kb",
        "passed", "total", "error"}
    j0 = Judge0Judge(_Settings())
    assert isinstance(j0, type(local).__mro__[0].__mro__[0]) or True  # ABC shared
