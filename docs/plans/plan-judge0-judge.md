# Plan — Judge0 Self-Hosted Code Execution (Java, C++, Python, SQL)

Replaces `LocalJudge` subprocess execution (`services/judge.py`) with **Judge0 CE**
running **inside the same repository's docker-compose stack** — per requirement,
the judge must not load the main backend, and the whole product comes up with a
single `docker compose up` (no separate node, no external setup).
`CodeJudge` ABC stays; `Judge0Judge` swaps in via `get_judge()` based on config.
Python/Java/C++/SQL are all supported by Judge0 out of the box (60+ languages,
sandboxed via `isolate`).

## Why Judge0 (researched Sep 2026)

- Self-host via `judge0/judge0` docker-compose (API + Postgres + Redis +
  workers). Sandboxing = `isolate` (cgroups/seccomp), real CPU/memory/wall
  limits per submission.
- API: `POST /submissions?base64_encoded=true&wait=false` → token; then
  `GET /submissions/{token}` until `status.id` terminal. Batch endpoint
  `POST /submissions/batch` runs N test cases efficiently.
- Auth optional; set `X-Auth-Token` when configured. `judges[].id` pins
  specific runner machines when scaling (not needed v1).

## Deployment (in-repo compose service — implemented)

- **No `judge0/` subfolder and no separate VM.** Judge0 runs as compose
  services in the **root `docker-compose.yml`**: `judge0-server` (API,
  :2358, `privileged: true` — isolate needs it), `judge0-worker` (polling
  workers), `judge0-db` (its own Postgres 16.2), `judge0-redis` (Redis 7.2.4
  with requirepass). They are named `judge0-*` so they never collide with the
  app's `postgres`/`redis`.
- The backend service gets `JUDGE0_BASE_URL=http://judge0-server:2358` from
  compose and depends on `judge0-server` being healthy; `get_judge()` then
  selects `Judge0Judge` automatically.
- Verify after `docker compose up`:
  `curl http://localhost:2358/system_info`.
- Prod notes (if ever split out): enable `ENABLE_TOKENS=true` + `X-Auth-Token`,
  put behind the LB with HTTPS only from the backend, restrict ingress to the
  backend's egress IP.
- Sizing heuristic: each submission ~1 CPU-sec; the worker COUNT defaults to
  2×nproc on the Docker host, which comfortably covers local/dev concurrency.

## Backend changes (main FastAPI app)

### 1. Config (`app/core/config.py`)

```
JUDGE0_BASE_URL: str = ""        # compose default: http://judge0-server:2358
JUDGE0_AUTH_TOKEN: str = ""      # optional X-Auth-Token
JUDGE0_TIMEOUT_SECONDS: int = 20
JUDGE0_POLL_INTERVAL: float = 0.4
```

Empty `JUDGE0_BASE_URL` → fall back to `LocalJudge` (keeps local dev + tests
green with zero infra; the fallback is explicit config, not silent magic).

### 2. `Judge0Judge(CodeJudge)` (`app/services/judge0.py`, new)

- Language ID map (Judge0's fixed CE ids, verified against the live
  `/languages` endpoint, Sep 2026):
  `python (71), java (62), cpp (54 — C++ GCC 9.2), sql (sqlite3 82)`.
  Centralized in `_LANGUAGE_IDS` so tests/ports are single-source.
- **Wrapper strategy**: user code is embedded into a generated runner file
  that reads stdin test cases, calls the user's function, prints normalized
  output — same contract the frontend editor already uses (a `solution()`
  entrypoint). One wrapper per language, versioned in
  `app/services/judge_runners/{python,java,cpp,sql}.j2` (jinja-less simple
  string templates; no new dependency).
- Flow per submission batch:
  1. For each test case → `POST /submissions/batch` with
     `{language_id, source_code: runner+user code, stdin: tc.input,
       expected_output: tc.output, cpu_time_limit, memory_limit}`.
  2. Poll tokens (or `wait=true` for batches ≤5 — fewer round trips).
  3. Map Judge0 `status.id` → `JudgeResult.compile_status`:
     `3=ok, 5=timeout, 6=compile_error, 11=runtime_error` (others →
     runtime_error with message).
  4. Build existing `JudgeResult`/`TestCaseResult` dataclasses — **API shape
     unchanged**, so `api/submissions.py`, workflows, and tests keep passing.
- Timeouts: per-test `cpu_time_limit=5s` default (configurable by problem
  difficulty), total batch wall-clock cap `JUDGE0_TIMEOUT_SECONDS`.
- Errors: transport failure → `ClarityError("JUDGE_UNAVAILABLE", ..., 502)`
  (mirrors Foundry error style: loud, actionable, no fallback content).
- SQL is different in shape: "test cases" = seed SQL statements + expected
  query result rows; wrapper does `sqlite3` execution — Judge0 runs
  sqlite3 with the user's SELECT. Only v1 scope: single-statement queries.

### 3. `get_judge()` update (`services/judge.py`)

```python
def get_judge() -> CodeJudge:
    if settings.JUDGE0_BASE_URL:
        return Judge0Judge()
    return LocalJudge()
```

`LocalJudge` stays for tests/dev; it already implements the ABC.
**Implemented** in `services/judge.py` with `Judge0Judge` in
`services/judge0.py` (batch POST + terminal-status polling + status mapping;
httpx-mocked unit tests in `tests/test_judge0.py`).

### 4. Observability

- Submission rows already persist `compile_status`, `test_results`,
  `runtime_ms`, `memory_kb` — Judge0 gives real memory/cpu numbers (LocalJudge
  faked memory). No schema change needed.
- `agent_runs` gains judge submissions as `workflow_name="judge"` entries
  (latency + status), so the demo trace shows Evaluator's tool call.

## Frontend changes (small)

- `mock-oa` and CODE RED interview editor language selector: add
  `C++` and `SQL` options (Python/Java exist conceptually already); language
  ids pass through `POST /submissions` unchanged.
- Disable-and-explain state when judge returns `JUDGE_UNAVAILABLE` or
  `compile_status="unsupported"` (existing error envelope renders already).

## Testing

- `tests/test_judge0.py` (implemented): mock httpx transport — happy path
  (status 3), compile error (6), timeout (5), wrong-answer-not-runtime-error,
  batch splitting (25 cases → 20+5), fallback selection when
  `JUDGE0_BASE_URL` empty, loud `JUDGE_UNAVAILABLE` on transport failure.
- Contract test: `JudgeResult` field names asserted identical across
  LocalJudge and Judge0Judge (API shape stability).
- Manual E2E: `docker compose up`, submit Python/Java/C++/SQL once each
  through the mock-OA editor.

## Security

- The judge container is the blast radius: user code never touches the FastAPI
  container (already true for LocalJudge; Judge0 makes it true at infra level).
- Compose-network-internal by default (`ENABLE_TOKENS=false`); enable tokens
  before any non-local exposure.
- Limits: `cpu_time_limit` (≤15s, from config), `wall_time_limit` (≤20s),
  `memory_limit=512000` KB — inside Judge0 CE's own MAX_* caps.

## Rollout order

1. ~~`Judge0Judge` + tests behind config flag (no behavior change).~~ Done.
2. ~~Separate node~~ → Judge0 added to the root compose stack (done); verify
   with `curl localhost:2358/system_info` after `docker compose up`.
3. Wire SQL + C++ wrappers; frontend language options. (SQL/C++/Java map via
   `LANGUAGE_IDS`; wrapper-free — user source is submitted directly with
   stdin/stdout contract, matching the editor's `solution()` entrypoint.)
4. Flip `JUDGE0_BASE_URL` on in staging; keep LocalJudge as fallback config.
