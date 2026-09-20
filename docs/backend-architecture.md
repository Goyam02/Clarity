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

## Foundry integration (real, verified)

Verified against `azure-ai-projects` 2.6.1 + `azure-identity` (Sep 2026):

- `AIProjectClient(endpoint, DefaultAzureCredential)` — project client.
- `client.get_openai_client(agent_name=...)` — async OpenAI-compatible client
  routed to a deployed Foundry agent; chat completions with JSON mode produce
  structured outputs, validated with Pydantic (one repair retry, then loud
  failure — never fallback content).
- Auth is Entra ID only: `az login` locally, Managed Identity on Azure.

There is no mock mode and no environment branching in agent code. Every agent
(Planner, Question Generator, Evaluator, Interviewer, Company Intel) defines a
system prompt + output schema and calls the live service via
`app/integrations/foundry/client.py` — the only file that touches Azure SDKs.
Code enforces constraints only (budget clamp, LIGHT-mood filter, problem
validation); all content is model-generated.

| Spec §11 claim | Status |
|---|---|
| Agent Service / Connected Agents | Done via per-agent routing + `agents/orchestrator.py` handoffs with `AgentRun` audit rows |
| Managed memory as mastery store | **Rejected by design**: mastery stays in Postgres (queryable/deterministic); `MemoryService` holds agent context only |
| Foundry IQ | `shims.iq_retrieve` queries Azure AI Search when configured, else no anchors (never canned answers) |
| Deep Research (`o3-deep-research`) | Not in the installed SDK surface — Company Intel uses the deployed agent + retrieval anchors; research-tool wiring is a later step, not faked now |
| Live web question research | **Grounding with Bing Search** (the standalone Bing Search APIs retired Aug 2025): the agent named by `WEB_RESEARCH_AGENT` has the tool attached in the Foundry portal; `integrations/foundry/web_research.py` pulls structured, source-cited findings via the shared chat path. `services/web_corpus.py` merges them with the data/company-corpus CSV corpus (CSV stays authoritative, dedupe on title, provenance tagged) and TTL-gates re-search (`WEB_RESEARCH_TTL_DAYS`). Unconfigured → CSV-only, no behavior change |
| Code Interpreter for grading | Not in the installed SDK surface — `services/judge.py::LocalJudge` subprocess sandbox (Python; Java if JDK present) behind the `CodeJudge` ABC |
| Voice Live | Not in the installed SDK surface — session/event/transcript/debrief backend is real; `speech_available()=False` marks the gap |
| Tracing + Evaluation | `agent_runs` table + `emit_trace()` (App Insights when configured) |

## Key decisions

- `MasteryEngine` is pure/deterministic; LLM (Evaluator) produces evidence only.
- Effective mastery computed at read time (decay); DB written only on attempts.
- CLEAR SCORE = 0–100 weighted readiness index, never a "probability".
- Transport failures raise `FoundryError` (502/503, actionable message);
  retries are bounded (3, transient errors only). No silent fallbacks.
- Cost control: company intel refreshes only when stale (>90d)/missing.
- Judge never runs code in-process (subprocess + temp dir + timeout).
- Tests inject a stub `ChatBackend` via `set_backend()` — a test seam, not
  product branching.
