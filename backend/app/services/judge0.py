"""Judge0Judge: code execution via self-hosted Judge0 CE (plan:
docs/plans/plan-judge0-judge.md).

Runs in the root docker-compose stack (`judge0-server` service, port 2358);
the FastAPI backend reaches it over the compose network and never executes
user code itself. Sandboxing is Judge0's isolate (cgroups/seccomp) with real
CPU/wall/memory limits per submission.

Contract parity with LocalJudge (`services/judge.py`): same stdin/stdout
test-case shape, same JudgeResult/TestCaseResult dicts — so API routes,
workflows, and tests keep passing regardless of which judge is active.

Judge0 facts (verified against CE v1.13.1 API docs, Sep 2026):
- Language ids (CE flavor): 71 Python 3.8, 62 Java (OpenJDK 13), 54 C++ (GCC
  9.2), 82 SQL (SQLite 3.27).
- POST /submissions/batch?base64_encoded=true → [{token}]; GET
  /submissions/batch?tokens=... until every status_id is terminal.
- Status ids: 1 In Queue, 2 Processing, 3 Accepted, 4 Wrong Answer,
  5 Time Limit Exceeded, 6 Compilation Error, 7 Runtime Error (NZEC),
  11 Segmentation Fault, 12 Out of Memory, 13 Illegal System Call,
  14 Internal Error.

Errors are loud ClarityErrors — transport failures raise JUDGE_UNAVAILABLE
(502); nothing silently falls back mid-request. Config chooses the judge.
"""
import asyncio
import base64
import time as _time
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.errors import ClarityError
from app.core.logging import get_logger

log = get_logger(__name__)

# Judge0 CE fixed language ids (single source of truth for tests too).
LANGUAGE_IDS: dict[str, int] = {
    "python": 71,
    "py": 71,
    "python3": 71,
    "java": 62,
    "cpp": 54,
    "c++": 54,
    "sql": 82,
    "sqlite": 82,
}

# Judge0 status ids -> local JudgeResult compile_status vocabulary.
_STATUS_OK = {3, 4}             # accepted / wrong answer: code ran fine
_STATUS_TIMEOUT = 5
_STATUS_COMPILE_ERROR = 6
_TERMINAL_STATUSES = set(range(3, 15))  # 1 (queue) and 2 (processing) are not
_MAX_BATCH = 20                  # Judge0 MAX_SUBMISSION_BATCH_SIZE default


def _b64(data: str) -> str:
    return base64.b64encode((data or "").encode()).decode()


class Judge0Judge:
    """CodeJudge implementation backed by a self-hosted Judge0 CE instance."""

    def __init__(self, settings=None):
        self.settings = settings or get_settings()

    # --- config ---------------------------------------------------------------

    @property
    def base_url(self) -> str:
        return (self.settings.JUDGE0_BASE_URL or "").rstrip("/")

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        token = self.settings.JUDGE0_AUTH_TOKEN
        if token:
            headers["X-Auth-Token"] = token
        return headers

    def _limits(self, timeout_seconds: int) -> dict:
        # Judge0 CE config caps: MAX_CPU_TIME_LIMIT 15, MAX_WALL_TIME_LIMIT 20.
        cpu = max(1, min(float(timeout_seconds), 15.0))
        return {
            "cpu_time_limit": cpu,
            "wall_time_limit": min(cpu * 2, 20.0),
            "memory_limit": 512000,  # KB — MAX_MEMORY_LIMIT
        }

    # --- transport ------------------------------------------------------------

    async def _post_batch(self, client: httpx.AsyncClient,
                          payload: list[dict]) -> list[str]:
        try:
            r = await client.post(
                f"{self.base_url}/submissions/batch",
                params={"base64_encoded": "true", "wait": "false"},
                json={"submissions": payload}, headers=self._headers())
        except (httpx.HTTPError, OSError) as e:
            raise ClarityError("JUDGE_UNAVAILABLE",
                               f"Judge0 could not be reached: {e}", 502) from e
        if r.status_code == 401:
            raise ClarityError("JUDGE_UNAVAILABLE",
                               "Judge0 rejected the auth token (X-Auth-Token)",
                               502)
        if r.status_code == 429:
            raise ClarityError("JUDGE_BUSY", "Judge0 queue is full — retry shortly", 503)
        if r.status_code not in (200, 201):
            raise ClarityError("JUDGE_UNAVAILABLE",
                               f"Judge0 returned HTTP {r.status_code}", 502)
        try:
            tokens = [item["token"] for item in r.json()]
        except (ValueError, KeyError, TypeError) as e:
            raise ClarityError("JUDGE_UNAVAILABLE",
                               "Judge0 batch response was malformed", 502) from e
        return tokens

    async def _get_batch(self, client: httpx.AsyncClient, tokens: list[str]) -> list[dict]:
        try:
            r = await client.get(
                f"{self.base_url}/submissions/batch",
                params={"tokens": ",".join(tokens), "base64_encoded": "true",
                        "fields": "token,status_id,stdout,stderr,compile_output,"
                                  "time,memory"},
                headers=self._headers())
        except (httpx.HTTPError, OSError) as e:
            raise ClarityError("JUDGE_UNAVAILABLE",
                               f"Judge0 could not be reached: {e}", 502) from e
        if r.status_code != 200:
            raise ClarityError("JUDGE_UNAVAILABLE",
                               f"Judge0 returned HTTP {r.status_code}", 502)
        try:
            return r.json()
        except ValueError as e:
            raise ClarityError("JUDGE_UNAVAILABLE",
                               "Judge0 returned a non-JSON response", 502) from e

    # --- polling ----------------------------------------------------------------

    async def _await_batch(self, client: httpx.AsyncClient,
                           tokens: list[str]) -> list[dict]:
        """Poll GET /submissions/batch until every token is terminal or the
        overall wall clock (JUDGE0_TIMEOUT_SECONDS) runs out."""
        settings = self.settings
        deadline = _time.monotonic() + settings.JUDGE0_TIMEOUT_SECONDS
        remaining = list(tokens)
        done: dict[str, dict] = {}
        while remaining:
            if _time.monotonic() > deadline:
                raise ClarityError("JUDGE_TIMEOUT",
                                   "Judge0 did not finish the batch in time — "
                                   "retry or reduce test cases", 504)
            for sub in await self._get_batch(client, remaining):
                status = sub.get("status_id") or sub.get("status", {}).get("id")
                if status in _TERMINAL_STATUSES:
                    done[sub["token"]] = sub
                    remaining = [t for t in remaining if t != sub["token"]]
            if remaining:
                await asyncio.sleep(settings.JUDGE0_POLL_INTERVAL)
        return [done[t] for t in tokens]  # preserve submission order

    # --- CodeJudge contract -------------------------------------------------------

    async def execute(self, language: str, source_code: str, test_cases: list,
                      timeout_seconds: int = 10) -> Any:
        from app.services.judge import JudgeResult, TestCaseResult

        lang = (language or "").lower()
        lang_id = LANGUAGE_IDS.get(lang)
        if lang_id is None:
            return JudgeResult(compile_status="unsupported",
                               error=f"Language '{language}' not supported by Judge0 judge")
        cases = [tc if isinstance(tc, dict) else {"input": "", "output": ""}
                 for tc in (test_cases or [])]

        # Batch in chunks of MAX_BATCH (Judge0 rejects bigger batches).
        chunks: list[list[dict]] = []
        for i in range(0, len(cases), _MAX_BATCH):
            chunk = []
            for tc in cases[i:i + _MAX_BATCH]:
                sub = {"language_id": lang_id,
                       "source_code": _b64(source_code),
                       "stdin": _b64(str(tc.get("input", "") or "")),
                       "expected_output": _b64(str(tc.get("output", "") or "").strip()),
                       **self._limits(timeout_seconds)}
                if lang_id == LANGUAGE_IDS["sql"]:
                    # Judge0 SQL (SQLite) prints query results on stdout; give
                    # it more CPU headroom than default for larger seeds.
                    sub["cpu_time_limit"] = 15
                chunk.append(sub)
            chunks.append(chunk)

        if not chunks:
            return JudgeResult(compile_status="ok", passed=0, total=0)

        async with httpx.AsyncClient(
                timeout=self.settings.JUDGE0_TIMEOUT_SECONDS + 5) as client:
            all_tokens: list[str] = []
            for chunk in chunks:
                all_tokens.extend(await self._post_batch(client, chunk))
            submissions = await self._await_batch(client, all_tokens)

        # --- map results (identical shape to LocalJudge) -------------------------
        results: list[TestCaseResult] = []
        total_ms = 0
        max_mem_kb = 0
        compile_output = ""
        for i, sub in enumerate(submissions):
            def _dec(v: Any) -> str:
                if v is None:
                    return ""
                try:
                    return base64.b64decode(v).decode(errors="replace")
                except Exception:
                    return str(v)

            status = sub.get("status_id") or sub.get("status", {}).get("id")
            stdout = _dec(sub.get("stdout"))
            stderr = _dec(sub.get("stderr"))
            if sub.get("compile_output"):
                compile_output = _dec(sub.get("compile_output"))[:2000]
            total_ms += int(float(sub.get("time") or 0) * 1000)
            max_mem_kb = max(max_mem_kb, int(float(sub.get("memory") or 0)))
            if status == _STATUS_TIMEOUT:
                results.append(TestCaseResult(i, False, stdout, stderr, True))
            elif status == _STATUS_COMPILE_ERROR:
                results.append(TestCaseResult(i, False, "", compile_output))
            else:
                expected = str(cases[i].get("output", "") or "").strip()
                results.append(TestCaseResult(i, stdout == expected, stdout, stderr))

        passed = sum(1 for r in results if r.passed)
        any_runtime_error = any((not r.passed) and r.stderr and (not r.timed_out)
                                for r in results)
        if compile_output and all(not r.passed for r in results):
            # Compiler ran but rejected the source: every case failed with the
            # same compiler output and nothing executed.
            status = "compile_error"
        elif any(r.timed_out for r in results):
            status = "timeout"
        elif any_runtime_error:
            status = "runtime_error"
        else:
            status = "ok"

        return JudgeResult(compile_status=status,
                           test_results=[r.__dict__ for r in results],
                           runtime_ms=total_ms, memory_kb=max_mem_kb,
                           passed=passed, total=len(results),
                           error=compile_output if status == "compile_error" else "")
