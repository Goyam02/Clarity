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
- `FoundryChatBackend`: cached project Responses client, deployed agents selected
  by `agent_reference` (model and tools configured on each agent),
  bounded retries (3, exponential backoff, transient errors
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
| Agent Service / Connected Agents | Done via per-agent routing + `agents/orchestrator.py` handoffs with `AgentRun` audit rows |
| Managed memory as mastery store | **Rejected by design**: mastery stays in Postgres (queryable/deterministic); `MemoryService` holds agent context only |
| Foundry IQ | `shims.iq_retrieve` queries Azure AI Search when configured, else no anchors (never canned answers) |
| Deep Research (`o3-deep-research`) | Not in the installed SDK surface — Company Intel uses the deployed agent + retrieval anchors; research-tool wiring is a later step, not faked now |
| Live web question research | **Grounding with Bing Search** (the standalone Bing Search APIs retired Aug 2025): the agent named by `WEB_RESEARCH_AGENT` has the tool attached in the Foundry portal; `integrations/foundry/web_research.py` pulls structured, source-cited findings via the shared chat path. `services/web_corpus.py` merges them with the data/company-corpus CSV corpus (CSV stays authoritative, dedupe on title, provenance tagged) and TTL-gates re-search (`WEB_RESEARCH_TTL_DAYS`). Unconfigured → CSV-only, no behavior change |
| Code Interpreter for grading | **Judge0 CE, self-hosted in the root compose stack** (`services/judge0.py::Judge0Judge`, `JUDGE0_BASE_URL=http://judge0-server:2358`): sandboxed Python/Java/C++/SQL via isolate, batch submissions, real CPU/memory numbers; `LocalJudge` subprocess stays as the zero-infra fallback behind the same `CodeJudge` ABC |
| Voice Live | **Gemini Live API, frontend-only** (`frontend/src/lib/geminiLive.ts`): browser→Gemini voice-to-voice on the CODE RED interview page; transcript mirrored to `/interviews/{id}/events` so the events/transcript/debrief backend below is unchanged. LiveKit plan superseded |
| Tracing + Evaluation | `agent_runs` table + `emit_trace()` (App Insights when configured) |

## 4. Agents (`app/agents/`)

- `MasteryEngine` is pure/deterministic; LLM (Evaluator) produces evidence only.
- Effective mastery computed at read time (decay); DB written only on attempts.
- CLEAR SCORE = 0–100 weighted readiness index, never a "probability".
- Transport failures raise `FoundryError` (502/503, actionable message);
  retries are bounded (3, transient errors only). No silent fallbacks.
- Cost control: company intel refreshes only when stale (>90d)/missing.
- Judge never runs code in-process: Judge0 CE (compose, isolate-sandboxed)
  when configured, else subprocess + temp dir + timeout (`LocalJudge`).
- Tests inject a stub `ChatBackend` via `set_backend()` — a test seam, not
  product branching.
