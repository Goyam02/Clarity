# CLARITY — Credentials & Remaining Work

Companion to `docs/azure-setup.md` (Azure how-to) and `docs/backend-architecture.md`
(what was built and why). This doc answers two questions: **what keys do I need?**
and **what's left to build?**

---

## Part 1 — Credentials / API keys

There is exactly **one hard requirement** (Microsoft Foundry) and everything else
is optional or a provider choice. No OpenAI key, no Anthropic key — all model
calls go through the Foundry project with Entra ID auth (`az login` locally,
Managed Identity in prod). There are no keys for the model path by design.

### Required — backend cannot serve agent endpoints without it

| Credential | Env vars | Where to get it | Used by |
|---|---|---|---|
| Microsoft Foundry project + model deployment | `AZURE_FOUNDRY_PROJECT_ENDPOINT`, `AZURE_FOUNDRY_MODEL_DEPLOYMENT` | portal.azure.com → create a Foundry project → deploy a model (e.g. `gpt-4o-mini`) | every agent call — Planner, Question Generator, Evaluator, Interviewer, Company Intel (`integrations/foundry/client.py`) |
| Entra ID identity (not a key) | — | `az login` locally; Managed Identity on Container Apps | auth for the Foundry calls above; RBAC role `Cognitive Services OpenAI User` on the project |

Five deployed agents are referenced by name (`PLANNER_AGENT`,
`QUESTION_GENERATOR_AGENT`, `EVALUATOR_AGENT`, `INTERVIEWER_AGENT`,
`COMPANY_INTEL_AGENT`); without them, agent-backed endpoints return
`FOUNDRY_NOT_CONFIGURED` / `AGENT_FAILED`.

### Optional — features degrade safely without them

| Credential | Env vars | What you get without it | Used by |
|---|---|---|---|
| Grounding with Bing Search (attach to the `WEB_RESEARCH_AGENT` agent in the Foundry portal) | `WEB_RESEARCH_AGENT`, `WEB_RESEARCH_TTL_DAYS` | CODE RED runs on the CSV company corpus only; no live web-sourced problems/questions | `integrations/foundry/web_research.py`, `services/web_corpus.py` |
| Google OAuth client (web app type) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | `/auth/google/*` return 501; email/password auth still works fully | `api/auth.py` |
| Azure AI Search | `AZURE_SEARCH_ENDPOINT`, `AZURE_SEARCH_INDEX`, `AZURE_SEARCH_API_KEY` | retrieval anchors return empty (no canned content is substituted) | `shims.iq_retrieve` |
| Azure Storage Account | `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_CONTAINER` | uploads fall back to local disk | `storage_service.upload_blob` |
| Application Insights | `APPLICATIONINSIGHTS_CONNECTION_STRING` | no remote traces; `agent_runs` table still records everything | `shims.emit_trace` |
| Redis | `REDIS_URL` | cache misses; core flows unaffected | session/cache layer |
| LiveKit project (free tier for dev) | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `INTERVIEW_AGENT_INTERNAL_SECRET` | voice interviews unavailable; everything else unaffected — see `docs/plans/plan-livekit-voice-interview.md` | `livekit-agent/` worker, `api/interviews_live.py` |
| Judge0 deployment (self-hosted, separate node) | `JUDGE0_BASE_URL`, `JUDGE0_AUTH_TOKEN` | falls back to local Python-only subprocess judge; Java/C++/SQL need Judge0 — see `docs/plans/plan-judge0-judge.md` | `services/judge0.py` |

### User-supplied tokens (not env vars, entered in-app by each user)

| Token | Entered where | What it unlocks |
|---|---|---|
| LeetCode `LEETCODE_SESSION` + `csrftoken` cookies (2 tokens) | Onboarding screen 4 / Settings — stored Fernet-encrypted at rest | Automatic pull of solved counts per topic + recent AC submissions into the Mastery Model — see `docs/plans/plan-leetcode-pulls.md` |

### Infrastructure (not keys, but required to run)

- **PostgreSQL** — `DATABASE_URL` (compose provides it locally; Azure Database
  for PostgreSQL in prod; `alembic upgrade head` applies schema).
- **JWT secret** — `JWT_SECRET` (change from the dev default in prod).

### Local dev quick check

```bash
cp backend/.env.example backend/.env   # fill AZURE_FOUNDRY_* , az login
docker compose up                       # postgres + redis + backend + frontend
curl http://localhost:8000/health       # {"status":"ok"}
```

Frontend needs no keys at all; `VITE_API_BASE_URL` just points at the backend
(default `http://localhost:8000`).

The old `frontend/.env.example` still lists `GEMINI_API_KEY` / `APP_URL` from
the AI-Studio-era tree — **obsolete**, nothing reads them anymore; safe to
delete.

---

## Part 2 — What's left in implementation

### Done and working

- **Backend (FastAPI, modular monolith)** — auth (JWT + Google-ready),
  onboarding (signals, calibration, focus), mastery graph, daily planner,
  problem generation, submissions + local subprocess judge, CODE RED (tasks,
  clear-score, drift), interviews (events/transcript/debrief), outcomes, mock
  OA, uploads, company corpus + web research merge. 62 tests green.
- **Docker** — full stack via root `docker-compose.yml` (Postgres 16, Redis 7,
  backend, nginx-served frontend); backend migrations run on container start.
- **Frontend (Vite + React 19 + TS)** — landing, auth, 7-screen onboarding,
  dashboard, knowledge graph, CODE RED entry/live/interview/debrief, mock OA,
  settings; typed API client wired to FastAPI.

### Open gaps (in rough priority order)

| # | Item | Status / what's missing | Where |
|---|---|---|---|
| 1 | **Foundry project + agents** | Config work, not code: create the project, deploy a model, deploy the five named agents; without it every agent endpoint returns `FOUNDRY_NOT_CONFIGURED` | portal + `backend/.env` |
| 2 | **Voice / Voice Live** | **Planned — `docs/plans/plan-livekit-voice-interview.md`**: LiveKit Agents worker (`livekit-agent/`), AI-first interview UI with tool-call editor reveal, backend-owned per-session prompts, stuck-detection while coding. Supersedes `speech_available()=False` | `livekit-agent/`, `api/interviews_live.py` |
| 3 | **Code Interpreter grading** | **Planned — `docs/plans/plan-judge0-judge.md`**: self-hosted Judge0 CE on a separate deployment for Java/C++/Python/SQL; `Judge0Judge` behind the existing `CodeJudge` ABC with `LocalJudge` fallback | `services/judge0.py`, separate `judge0/` node |
| 4 | **LeetCode cookie pulls + graph completion** | **Planned — `docs/plans/plan-leetcode-pulls.md`**: LEETCODE_SESSION + csrftoken entry in onboarding/settings, encrypted persistence, `/onboarding/platform-pull` route, PlatformSignal ingestion into Mastery Model, prerequisite + correlation edge building (`MasteryEdge`) | `services/leetcode_service.py`, `services/graph_builder.py` |
| 9 | **Production hardening** | CORS `allow_origins=["*"]` in `main.py`, dev-only `X-User-Id` auth fallback (`DEV_AUTH_ALLOW_HEADER`), Key Vault not wired, no rate limiting | `main.py`, `dependencies.py` |
| 10 | **Legacy env cleanup** | `frontend/.env.example` (GEMINI_API_KEY, APP_URL) and stray `test_clarity.db` / `backend/docker-compose.yml` are leftovers to remove | repo root |
| 11 | **Deep Research** | Not in the installed SDK surface; Company Intel uses the deployed agent + web grounding instead. Wiring `o3-deep-research` is a later step | `docs/backend-architecture.md` |
| 12 | **Foundry IQ / Memory wiring** | `iq_retrieve` (`integrations/foundry/shims.py`) and `MemoryService` (`services/storage_service.py`, agent context only) exist behind config flags; no provisioned Search instance or Memory store hooked up yet | see left |
| 13 | **Java in the judge container** | Superseded by item 3: Judge0 handles Java/C++ on its own deployment; the backend image needs no JDK | `backend/Dockerfile` |
| 14 | **E2E / integration tests** | 62 backend unit tests + vitest graph tests exist; no full-stack test through the Dockerized compose stack | `tests/`, `frontend` |

### Spec features intentionally not built

- **LeetCode/GFG session-cookie pulls** — originally designed out (spec §13
  security decision); now **planned back in** as a user-owned, encrypted
  integration (see `docs/plans/plan-leetcode-pulls.md`) — update the spec
  section when implemented.
- **Correlation edges on the graph** (§5, dashed dynamic edges) — the mastery
  graph ships prerequisite edges only; correlation computation from logged
  history is specified in `docs/plans/plan-leetcode-pulls.md`.
- **GFG / HackerRank live auto-pull** — still cut: no reliable API path.
