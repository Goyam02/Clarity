# CLARITY Backend Architecture

Source spec: `CLARITY-product-spec.md` (repo root). This doc is the
authoritative description of what is actually built, how the pieces connect,
and where it deliberately deviates from the spec after verifying the real
Azure SDK surface. Read this before touching `backend/`.

## 1. Big picture

CLARITY is a mastery-model interview-prep platform: one shared, structured
model of what the student knows (PostgreSQL), read and written by five
specialized AI agents, consumed by Daily Mode, CODE RED, and Mock Interview.

```
                  FastAPI (/api/v1)
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   workflows/        agents/          services/
   (orchestration)   (LLM calls)      (deterministic logic)
        │                │                │
        └────────────────┼────────────────┘
                         │
              PostgreSQL (authoritative state)
              Redis (provisioned via compose; caching/session wiring pending)
                         │
   integrations/foundry (ONLY Azure SDK touchpoint) → Microsoft Foundry
```

Modular monolith — no microservices. Module boundaries (agents, services,
workflows) are clean enough to extract later.

## 2. State ownership (mandatory split)

| Store | Owns | Never owns |
|---|---|---|
| PostgreSQL | users, profiles, topics, mastery nodes + history, problems, attempts, submissions, daily plans, CODE RED sessions/tasks, mock sessions + interview events, companies + profiles, outcomes, calibration runs, agent_runs | — |
| Foundry agents | live reasoning, structured outputs | persistent mastery (never the source of truth) |
| `MemoryService` (in-memory; Foundry Memory later) | agent long-term context, observations | mastery scores |
| Azure AI Search ("Foundry IQ") | retrieval anchors for company intel + problem style | transactional state |
| Blob Storage (local-dir fallback) | resume PDFs, screenshots, audio | structured profile data |
| App Insights (+ `agent_runs` table) | traces, latency, handoffs, errors | — |

## 3. Foundry integration (real, verified Sep 2026)

SDKs: `azure-ai-projects` 2.6.1 + `azure-identity`, pinned in
`backend/requirements.txt`. Verified API surface:

- `AIProjectClient(endpoint, DefaultAzureCredential)` — project client.
- `client.get_openai_client(agent_name=...)` (async variant) — OpenAI-compatible
  client routed to a deployed Foundry agent.
- Chat completions with `response_format={"type": "json_object"}` produce
  structured outputs, validated with Pydantic.
- Auth is Entra ID only: `az login` locally, Managed Identity on Azure. No keys.

Implementation (`app/integrations/foundry/client.py` — the only file importing
Azure SDKs):

- `ChatBackend` protocol (`complete_json(agent, system, user) -> dict`).
- `FoundryChatBackend`: per-agent client cache, `AZURE_FOUNDRY_MODEL_DEPLOYMENT`
  as the model, bounded retries (3, exponential backoff, transient errors
  only: rate-limit / connection / timeout / 5xx). Auth/schema-config errors
  fail fast.
- `FoundryError` (a `ClarityError`): missing config → `FOUNDRY_NOT_CONFIGURED`
  (500, tells the operator exactly which env var to set); call failure →
  `FOUNDRY_CALL_FAILED` / `FOUNDRY_UNAVAILABLE` (502). Nothing is fabricated.
- `get_backend()` process singleton; `set_backend()` test seam. **No
  environment branching anywhere in agent/workflow/route code.**
- `shims.iq_retrieve()`: Azure AI Search when `AZURE_SEARCH_ENDPOINT` is set,
  else `[]` (agents work without anchors). `shims.emit_trace()`: App Insights
  when configured, else no-op.

### Spec §11 deviations (verified, not assumed)

| Spec claim | Status |
|---|---|
| Agent Service / Connected Agents | Done via per-agent routing + `agents/orchestrator.py` handoffs recorded on `AgentRun` rows |
| Managed memory as mastery store | **Rejected by design** — mastery stays in Postgres |
| Foundry IQ | Real AI Search path; empty anchors when unconfigured (never canned answers) |
| Deep Research (`o3-deep-research`) | Not in installed SDK surface — Company Intel uses the deployed agent + anchors; not faked |
| Code Interpreter for grading | Not in installed SDK surface — `LocalJudge` subprocess sandbox (Python; Java if a JDK exists) behind the `CodeJudge` ABC |
| Voice Live | Not in installed SDK surface — session/event/transcript/debrief backend is real; `speech_available() == False` marks the gap |
| Tracing + Evaluation | `agent_runs` table + `emit_trace()` |

## 4. Agents (`app/agents/`)

Shared base (`base.py`): prompt → `llm.complete_json()` → Pydantic validation →
**one repair retry** (model is shown its schema errors) → `post_validate`
hook → `AgentRun` audit row (agent, workflow, user, input/output previews,
status, latency, error, trace_id). Persistent validation failure raises
`FoundryError(AGENT_FAILED)` — malformed output is never served.

| Agent | File | Output schema | What code enforces (not content) |
|---|---|---|---|
| Planner | `planner.py` | `PlannerOutput` (tasks: type/node/duration/reason/title) | `enforce_budget` (scale + drop tail tasks to fit); LIGHT mood drops non-revision tasks |
| Question Generator | `question_generator.py` | `GeneratedProblem` (title/statement/constraints/examples/≥2 hidden test cases/complexity) | `validate_problem`; repair-or-raise, malformed problems never stored |
| Evaluator | `evaluator.py` | `EvaluationResult` (correctness/error type/approach/complexity/feedback/mastery signals) | Judge pass/fail counts are ground truth in the prompt; score math stays in `MasteryEngine` |
| Interviewer | `interviewer.py` | `InterviewerOutput` (utterance/hint_given) | Single persona; stuck nudge after 180s (`STUCK_THRESHOLD_SECONDS`) |
| Company Intel | `interviewer.py` (`CompanyIntelAgent`) | `CompanyProfileOut` | Refresh only when stale/missing (>90d via `company_service.drift_status`); `last_verified` set server-side; sources must not invent URLs |

`orchestrator.run_daily_pipeline`: Planner → QuestionGen per problem task, with
handoff records (`from/to/reason/trace_id`) linked onto the planner's
`AgentRun` — the observable multi-agent trace.

## 5. Deterministic services (`app/services/`)

- `mastery_engine.MasteryEngine` — pure functions. `update()` blends
  correctness, time-vs-expected, hints (−12% gain each), explanation quality,
  with an adaptive step from stored confidence. `effective_mastery()` applies
  exponential decay at **read time** (no DB writes on read).
- `clear_score.compute_clear_score` — 0–100 weighted readiness index
  (target_mastery .30, recent .25, company .20, timed .15, core_cs .10).
  Explicitly not a probability.
- `judge.LocalJudge` — subprocess sandbox (temp dir, timeout, stdin/stdout
  compare). Never in-process.
- `company_service.drift_status` — stale flag without triggering research.
- `codeforces_service` / `github_service` — official public APIs only via
  httpx; failures return `{"error": ...}`, never raise.
- `storage_service.upload_blob` — Azure SDK when a connection string exists,
  else local dir; returns a `azure://` or `local://` ref (ref stored in
  Postgres, never the bytes).

## 6. Workflows (`app/workflows/`) and routes (`app/api/` → `/api/v1`)

- `daily.build_daily_plan` — mastery snapshot (with effective mastery) +
  recent history → Planner → budget clamp → `DailyPlan` row.
- `onboarding` — `gather_signals` runs Codeforces/GitHub/resume concurrently
  (`asyncio.gather`); `init_mastery` seeds 10 topics/nodes at 0.5; `focus`
  saves targets + preloads company profiles.
- `calibration` — 10 adaptive questions (agent-generated fresh variants,
  topic rotation in code); correct→harder, wrong→easier (1–5); completion
  persists signals via `MasteryEngine` with source `CALIBRATION`.
- `code_red.create_session` — company get-or-refresh → mastery diff →
  checklist (`WEAK_SPOT`/`COMPANY`/`CORE` with titles) → CLEAR SCORE →
  persisted session + tasks.
- `mock_interview` — event-sourced sessions; interviewer turns include
  transcript tail; `debrief` evaluates → updates mastery (`MOCK_INTERVIEW`)
  → returns correctness/communication/deltas.
- Mastery writes: `POST /mastery/update` (decay-aware), submissions
  (`DAILY_PRACTICE`), calibration, debrief — all append `MasteryHistory`.
- Auth: `POST /auth/register` (JWT + dev `X-User-Id` header); every
  user-scoped query filters by authenticated `user_id`.

Contracts: `docs/api-contracts.md`. Azure resource setup: `docs/azure-setup.md`.

## 7. Configuration

Required for any agent endpoint: `AZURE_FOUNDRY_PROJECT_ENDPOINT`,
`AZURE_FOUNDRY_MODEL_DEPLOYMENT`, five `*_AGENT` names (see
`backend/.env.example`). Without them, health/state/judge endpoints work but
agent calls return `FOUNDRY_NOT_CONFIGURED`. `DATABASE_URL` defaults to local
sqlite; Postgres via compose/override. No secrets in code or git (`.env` +
`*.db` gitignored).

## 8. Testing (`tests/`, run from repo root: `pytest tests -q`)

26 tests, no Azure needed: `conftest.StubBackend` implements `ChatBackend`
with per-agent canned JSON, injected via `set_backend()` — a test seam, not
product branching. Coverage: mastery engine rules + history, CLEAR SCORE
bounds/determinism/sensitivity, planner constraints, full API loop
(register → init → plan → generate → attempt → submit → mastery update),
CODE RED + CLEAR SCORE, company lookup/drift, interview events/transcript/
debrief, outcome loop, judge pass/fail/timeout/unsupported, CF/GH graceful
failure, `FoundryChatBackend` config validation.
