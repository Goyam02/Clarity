# CLARITY Azure Setup

All values map to `backend/.env.example`. The Foundry project (1–4) is
**required** — every agent calls the live service; without it, agent
endpoints return `FOUNDRY_NOT_CONFIGURED` with setup instructions.

> **Auth inside Docker (the common local hangup):** `DefaultAzureCredential`
> finds nothing in a plain container — no `az login` token, no managed
> identity. If uploads/agent calls return `FOUNDRY_AUTH_FAILED`, set
> **`AZURE_FOUNDRY_API_KEY`** in `backend/.env` (Foundry project → Overview →
> API key) and `docker compose up -d --build backend`. The code uses key auth
> when present and falls back to Entra ID when not (host `az login` or a
> service principal `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` /
> `AZURE_CLIENT_SECRET`).

1. **Subscription + resource group** — why: container for all below; used by:
   everything; env: none; local: no; prod: yes.
2. **Microsoft Foundry project** — why: model endpoint + agents; used by:
   `integrations/foundry/client.py`; env: `AZURE_FOUNDRY_PROJECT_ENDPOINT`;
   local: yes (`az login`); prod: yes.
3. **Model deployment** (e.g. gpt-4o-mini) — why: structured agent calls;
   env: `AZURE_FOUNDRY_MODEL_DEPLOYMENT`; local: yes; prod: yes.
4. **Five deployed agents** (`planner`, `question-generator`, `evaluator`,
   `interviewer`, `company-intel` or your names) — why: one agent resource per
   Clarity agent, routed via `get_openai_client(agent_name=...)`; env:
   `PLANNER_AGENT`, `QUESTION_GENERATOR_AGENT`, `EVALUATOR_AGENT`,
   `INTERVIEWER_AGENT`, `COMPANY_INTEL_AGENT`; local: yes; prod: yes.
   Managed Identity + RBAC: `Cognitive Services OpenAI User` on the project
   (local dev: `az login` instead).
5. **Azure AI Search** (optional) — why: Foundry IQ corpus (company intel,
   problem anchors); used by: `shims.iq_retrieve`; env: `AZURE_SEARCH_ENDPOINT`,
   `AZURE_SEARCH_INDEX`, `AZURE_SEARCH_API_KEY`; local: no; prod: recommended.
12. **Grounding with Bing Search** (optional, web research) — why: live,
    source-cited company OA problems + interview questions on top of the
    data/company-corpus corpus (the standalone Bing Search APIs retired Aug 2025; this
    tool is Microsoft's sanctioned replacement); used by:
    `integrations/foundry/web_research.py`; setup: in the Foundry portal open
    your project → Agents → the agent named by `WEB_RESEARCH_AGENT` (default
    `company-intel`) → Tools → Add → "Grounding with Bing Search" (creates a
    Bing Grounding connection) → deploy. env: `WEB_RESEARCH_AGENT`,
    `WEB_RESEARCH_TTL_DAYS`; local: yes; prod: yes. Without it the backend
    runs CSV-corpus-only and nothing else changes.
6. **Foundry Memory** (optional) — why: long-term agent context ONLY (mastery
   stays in Postgres); used by: `MemoryService`; local: no; prod: optional.
7. **Azure Database for PostgreSQL** — why: authoritative state; env:
   `DATABASE_URL=postgresql+psycopg2://...`; local: no (compose provides);
   prod: yes. Apply: `alembic upgrade head`.
8. **Storage Account** — why: resume PDFs; used by:
   `storage_service.upload_blob`; env: `AZURE_STORAGE_CONNECTION_STRING`,
   `AZURE_STORAGE_CONTAINER`; local: no (local dir fallback); prod: yes.
   (Not Azure, but env-adjacent: the voice interview uses a Google Gemini key
   `VITE_GEMINI_API_KEY` in `frontend/.env.local` — see README.)
9. **Key Vault** — why: hold secrets instead of env files; wire via Container
    Apps secret references; local: no; prod: recommended.
10. **Application Insights** — why: traces/latency/errors; used by:
    `shims.emit_trace`; env: `APPLICATIONINSIGHTS_CONNECTION_STRING`;
    local: no; prod: recommended.
11. **Azure Container Apps** — why: host backend; image from
    `backend/Dockerfile`; set env per `.env.example`; needs Managed Identity
    (4) + `DATABASE_URL` (7). Local equivalent: `docker compose up`
    (http://localhost:8000, /docs).

## Deploy sketch

```bash
az group create -n clarity-rg -l eastus
az postgres flexible-server create ... # + DATABASE_URL
az containerapp up -n clarity-api --source ./backend --env-vars AZURE_FOUNDRY_PROJECT_ENDPOINT=... AZURE_FOUNDRY_MODEL_DEPLOYMENT=gpt-4o-mini ...
```

## Verify your setup

```bash
# 1. Health (no Azure needed)
curl localhost:8000/health   # {"status":"ok"}

# 2. Register + seed mastery
TOKEN_REG=$(curl -s -X POST localhost:8000/api/v1/auth/register \
  -H 'Content-Type: application/json' -d '{"email":"you@x.com","name":"You"}')
UID=$(echo "$TOKEN_REG" | python3 -c "import sys,json; print(json.load(sys.stdin)['user_id'])")
curl -s -X POST localhost:8000/api/v1/onboarding/initialize -H "X-User-Id: $UID"

# 3. Agent call (needs endpoint + deployment + planner agent)
curl -s -X POST localhost:8000/api/v1/daily/plan -H "X-User-Id: $UID" \
  -H 'Content-Type: application/json' -d '{"mood":"normal","time_available":40}'
# misconfigured → {"error":{"code":"FOUNDRY_NOT_CONFIGURED", ...}} (tells you what to set)
# misnamed agent  → {"error":{"code":"FOUNDRY_AGENT_NOT_FOUND", ...}}
# success         → {"plan_id":..., "tasks":[...], "trace_id":...}
```

`az login` must be active for local calls (or Managed Identity on Azure);
without credentials the error message names the missing auth.
