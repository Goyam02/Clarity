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
| Gemini API key (voice-to-voice interview, frontend) | `VITE_GEMINI_API_KEY` (set in gitignored `frontend/.env.local`) | voice interview shows an actionable error; typed fallback + text interviewer flow still work — see `docs/plans/plan-livekit-voice-interview.md` (LiveKit superseded) | `frontend/src/lib/geminiLive.ts`, `pages/codered/CodeRedInterviewPage.tsx` |
| Judge0 CE (self-hosted, **in the root compose stack** — no external setup) | `JUDGE0_BASE_URL`, `JUDGE0_AUTH_TOKEN` (compose defaults both) | falls back to local Python-only subprocess judge; Java/C++/SQL need Judge0 — see `docs/plans/plan-judge0-judge.md` | `services/judge0.py`, compose `judge0-server`/`judge0-worker` |

### User-supplied tokens (not env vars, entered in-app by each user)

| Token | Entered where | What it unlocks |
|---|---|---|
| LeetCode `LEETCODE_SESSION` + `csrftoken` cookies (2 tokens) | Onboarding "Platform Pulls" screen / Settings — stored Fernet-encrypted at rest | Automatic pull of solved counts per topic + recent AC submissions into the Mastery Model — implemented per `docs/plans/plan-leetcode-pulls.md` |

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
  problem generation, submissions + **self-hosted Judge0 judge
  (Python/Java/C++/SQL, in the root compose stack; LocalJudge fallback)**,
  CODE RED (tasks, clear-score, drift), interviews (events/transcript/debrief),
  outcomes, mock OA, uploads, **LeetCode + Codeforces cookie/handle pulls with
  encrypted token storage and Mastery Model blending**, company corpus + web
  research merge. 88 tests green.
- **Docker** — full stack via root `docker-compose.yml` (Postgres 16, Redis 7,
  **Judge0 CE (server + worker + own db/redis)**, backend, nginx-served
  frontend); backend migrations run on container start. One `docker compose up`
  brings up everything.
- **Frontend (Vite + React 19 + TS)** — landing, auth, 5-step signal-first
  onboarding (resume → platform pulls incl. LeetCode cookies → calibration →
  confidence → focus), dashboard, knowledge graph, CODE RED entry/**live voice
  interview (Gemini Live API, voice-to-voice)**/debrief, mock OA, settings;
  typed API client wired to FastAPI.

### Open gaps (in rough priority order)

| # | Item | Status / what's missing | Where |
|---|---|---|---|
| 1 | **Foundry project + agents** | Config work, not code: create the project, deploy a model, deploy the five named agents; without it every agent endpoint returns `FOUNDRY_NOT_CONFIGURED` | portal + `backend/.env` |
| 2 | ~~Voice / Voice Live~~ | **Done — reimplemented on Gemini Live API (frontend-only)**; LiveKit plan superseded (no SFU, no worker container). Mic in → Gemini voice + transcript out; `show_editor`/`send_hint` tool calls drive the UI; transcript mirrored to `/interviews/{id}/events` so debrief is unchanged | `frontend/src/lib/geminiLive.ts`, `pages/codered/CodeRedInterviewPage.tsx` |
| 3 | ~~Code Interpreter grading~~ | **Done — self-hosted Judge0 CE inside the root compose stack** (no separate node; comes up with `docker compose up`). `Judge0Judge` behind the `CodeJudge` ABC; Python/Java/C++/SQL; `LocalJudge` fallback when `JUDGE0_BASE_URL` empty | `services/judge0.py`, compose `judge0-*` services |
| 4 | ~~LeetCode cookie pulls~~ | **Done — LEETCODE_SESSION + csrftoken entry in onboarding/settings, Fernet-encrypted persistence, PlatformSignal ingestion into the Mastery Model, daily sync + activity feed.** Graph correlation edges (`MasteryEdge`) remain future work | `services/leetcode_service.py`, `services/platform_signals.py`, `api/users.py` |
| 9 | **Production hardening** | CORS `allow_origins=["*"]` in `main.py`, dev-only `X-User-Id` auth fallback (`DEV_AUTH_ALLOW_HEADER`), Key Vault not wired, no rate limiting | `main.py`, `dependencies.py` |
| 10 | ~~Legacy env cleanup~~ | `frontend/.env.example` rewritten for `VITE_GEMINI_API_KEY`; stray `test_clarity.db` still to remove from git tracking | repo root |
| 11 | **Deep Research** | Not in the installed SDK surface; Company Intel uses the deployed agent + web grounding instead. Wiring `o3-deep-research` is a later step | `docs/backend-architecture.md` |
| 12 | **Foundry IQ / Memory wiring** | `iq_retrieve` (`integrations/foundry/shims.py`) and `MemoryService` (`services/storage_service.py`, agent context only) exist behind config flags; no provisioned Search instance or Memory store hooked up yet | see left |
| 13 | ~~Java in the judge container~~ | Superseded: Judge0 runs Java/C++ in its own compose containers; the backend image needs no JDK | `backend/Dockerfile` |
| 14 | **E2E / integration tests** | 88 backend unit tests + vitest graph tests exist; no full-stack test through the Dockerized compose stack | `tests/`, `frontend` |

### Spec features intentionally not built

- ~~LeetCode/GFG session-cookie pulls~~ — **LeetCode is done** (user-owned,
  encrypted, see `docs/plans/plan-leetcode-pulls.md`); update the spec's §13
  security language to match. GFG remains cut (no reliable API path).
- **Correlation edges on the graph** (§5, dashed dynamic edges) — the mastery
  graph ships prerequisite edges only; correlation computation from logged
  history is specified in `docs/plans/plan-leetcode-pulls.md`.
- **GFG / HackerRank live auto-pull** — still cut: no reliable API path.
