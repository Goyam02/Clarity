# CLARITY Backend Architecture

Source spec: `CLARITY-product-spec.md` (repo root). This doc records what was
built, and where it deliberately deviates from the spec's Foundry assumptions
after verifying the SDK surface available in this environment.

## Inspection findings (Sep 2026)

- Repo contained only `CLARITY-product-spec.md` — no backend, frontend,
  Docker, env, tests, or Azure config. Greenfield backend created under
  `backend/`. (Task text references `README.md`; the actual spec file is
  `CLARITY-product-spec.md`.)
- Python 3.13, FastAPI/SQLAlchemy/Alembic/pytest/httpx/uvicorn/openai
  installed; `azure-identity`, `azure-search-documents`, `azure-storage-blob`,
  `redis`, `asyncpg/psycopg2` NOT installed → all Azure SDK imports are
  optional/guarded; mock mode runs with zero Azure deps.
- Postgres + redis-server binaries not running locally → default
  `DATABASE_URL=sqlite:///./clarity.db` for local/tests; Postgres via
  `docker compose up` / `DATABASE_URL` override. All models are Postgres-first
  (timezone-aware datetimes, JSON columns) and SQLite-compatible.

## Architecture (modular monolith)

```
FastAPI (/api/v1) → workflows/ → agents/ → services/ → Postgres/Redis/Azure
                        |              \-> integrations/foundry (ONLY Azure SDK touchpoint)
Mastery Model = Postgres (authoritative). Foundry Memory = agent context only.
```

## Foundry verification vs spec §11

| Spec claim | Status |
|---|---|
| Agent Service / Connected Agents | No stable SDK in env → `agents/orchestrator.py` implements explicit handoffs locally with `AgentRun` audit rows; swap to Agent Service later |
| Managed memory as mastery store | **Rejected by design**: mastery stays in Postgres (queryable/deterministic); `services/storage_service.py::MemoryService` holds agent context only |
| Foundry IQ / Deep Research (`o3-deep-research`) | No SDK in env → `integrations/foundry/shims.py::iq_retrieve` (seed anchors now, AI Search when `AZURE_SEARCH_ENDPOINT` set) |
| Code Interpreter for grading | No SDK in env → `services/judge.py::LocalJudge` subprocess sandbox (Python; Java if JDK present) behind `CodeJudge` ABC |
| Voice Live | No SDK in env → session/event/transcript/debrief backend built; `speech_available()=False` documents the gap |
| Tracing + Evaluation | `agent_runs` table + `emit_trace()` (App Insights when configured, no-op locally) |

## Key decisions

- `MasteryEngine` is pure/deterministic; LLM (Evaluator) produces evidence only.
- Effective mastery computed at read time (decay); DB written only on attempts.
- CLEAR SCORE = 0–100 weighted readiness index, never a "probability".
- `CLARITY_AI_MODE=mock` (default) vs `azure`; azure falls back to mock per-call on failure.
- Cost control: company intel refreshes only when stale (>90d)/missing; planner has no redundant LLM calls in mock.
- Judge never runs code in-process (subprocess + temp dir + timeout).
