# Plan — Judge0 Self-Hosted Code Execution (Java, C++, Python, SQL)

Replaces `LocalJudge` subprocess execution (`services/judge.py`) with **Judge0 CE**
running as a **separate deployment** — per requirement, the judge must not load
the main backend. `CodeJudge` ABC stays; a new `Judge0Judge` implementation
swaps in via `get_judge()` based on config. Python/Java/C++/SQL all supported
by Judge0 out of the box (60+ languages, sandboxed via `isolate`).

## Why Judge0 (researched Sep 2026)

- Self-host via `judge0/judge0` docker-compose (API + Postgres + Redis +
  workers). Sandboxing = `isolate` (cgroups/seccomp), real CPU/memory/wall
  limits per submission.
- API: `POST /submissions?base64_encoded=true&wait=false` → token; then
  `GET /submissions/{token}` until `status.id` terminal. Batch endpoint
  `POST /submissions/batch` runs N test cases efficiently.
- Auth optional; set `X-Auth-Token` when configured. `judges[].id` pins
  specific runner machines when scaling (not needed v1).

## Deployment (separate service, separate host)

- **`judge0/` at repo root**: `docker-compose.yml` copied from upstream
  `judge0/judge0` (vanilla CE 1.13+) — runs on its **own VM / node** (e.g.
  2 vCPU / 4 GB droplet or EC2). NOT added to the app's compose file.
- Prod notes: set `RAILS_MIN_THREADS`, enable `X-Auth-Token` (
  `ENABLE_TOKENS=true` + per-judge token file), put behind the LB with
  HTTPS only from the backend, restrict ingress to the backend's egress IP.
- Sizing heuristic: each submission ~1 CPU-sec; 40 concurrent students ×
  5 test-cases ≈ needs 2 workers — start 1 node, scale horizontally
  (API is stateless; results stored in its Postgres).

## Backend changes (main FastAPI app)

### 1. Config (`app/core/config.py`)

```
JUDGE0_BASE_URL: str = ""        # e.g. https://judge0.internal.example.com
JUDGE0_AUTH_TOKEN: str = ""      # optional X-Auth-Token
JUDGE0_TIMEOUT_SECONDS: int = 15
JUDGE0_POLL_INTERVAL: float = 0.4
```

Empty `JUDGE0_BASE_URL` → fall back to `LocalJudge` (keeps local dev + tests
green with zero infra; the fallback is explicit config, not silent magic).

### 2. `Judge0Judge(CodeJudge)` (`app/services/judge0.py`, new)

- Language ID map (Judge0's fixed CE ids):
  `python (71), java (62), cpp (54 gcc / 54→ C++17 via 54 or 76), sql (sqlite3 82)`.
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

- `tests/test_judge0.py`: mock httpx transport — happy path (status 3),
  compile error (6), timeout (5), batch splitting, wrapper generation per
  language, fallback selection when `JUDGE0_BASE_URL` empty.
- Contract test: run LocalJudge and Judge0Judge (mocked) against identical
  fixtures and assert identical `JudgeResult` shapes.
- Manual E2E: point `JUDGE0_BASE_URL` at a local `judge0/judge0` compose,
  submit Python/Java/C++/SQL once each.

## Security

- The judge host is the blast radius: user code never touches the FastAPI
  container (already true for LocalJudge; Judge0 makes it true at infra level).
- `ENABLE_TOKENS=true` in prod; token lives in backend env only.
- Limits: `cpu_time_limit=5`, `wall_time_limit=10`, `memory_limit=512000` KB,
  `max_file_size` default. Problems may declare stricter limits.

## Rollout order

1. `Judge0Judge` + tests behind config flag (no behavior change).
2. Spin up self-hosted Judge0 on the separate node; point dev env at it.
3. Wire SQL + C++ wrappers; frontend language options.
4. Flip `JUDGE0_BASE_URL` on in staging; keep LocalJudge as fallback config.
