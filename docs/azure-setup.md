# CLARITY Azure Setup

All values map to `backend/.env.example`. Nothing here is required for local
mock dev (`CLARITY_AI_MODE=mock`, sqlite). Production (`CLARITY_AI_MODE=azure`)
needs 1–4 + 8 at minimum; everything else is progressive.

1. **Subscription + resource group** — why: container for all below; used by:
   everything; env: none; local: no; prod: yes.
2. **Microsoft Foundry project** — why: model endpoint + agents; used by:
   `integrations/foundry/client.py`; env: `AZURE_FOUNDRY_PROJECT_ENDPOINT`,
   `AZURE_FOUNDRY_MODEL`; local: no; prod: yes (for azure mode).
3. **Model deployment** (e.g. gpt-4o-mini) — why: structured agent calls;
   env: `AZURE_FOUNDRY_MODEL` (+ `AZURE_OPENAI_ENDPOINT`/`AZURE_OPENAI_API_KEY`
   alternative); local: no; prod: yes.
4. **Managed Identity + RBAC** — why: keyless auth via `DefaultAzureCredential`
   (preferred over keys); used by: Foundry client, Search, Storage; local: no
   (use `az login`); prod: yes. Roles: `Cognitive Services OpenAI User`,
   `Search Index Data Reader`, `Storage Blob Data Contributor`.
5. **Agent Service deployments** (optional) — why: hosted Planner/Evaluator/etc;
   env: `PLANNER_AGENT_ID`, `QUESTION_GENERATOR_AGENT_ID`, `EVALUATOR_AGENT_ID`,
   `INTERVIEWER_AGENT_ID`, `COMPANY_INTEL_AGENT_ID`; local: no; prod: optional
   (code works without; orchestrator runs in-process).
6. **Azure AI Search** (optional) — why: Foundry IQ corpus (company intel,
   problem anchors); used by: `shims.iq_retrieve`; env: `AZURE_SEARCH_ENDPOINT`,
   `AZURE_SEARCH_INDEX`, `AZURE_SEARCH_API_KEY`; local: no; prod: recommended.
7. **Foundry Memory** (optional) — why: long-term agent context ONLY (mastery
   stays in Postgres); used by: `MemoryService`; local: no; prod: optional.
8. **Azure Database for PostgreSQL** — why: authoritative state; env:
   `DATABASE_URL=postgresql+psycopg2://...`; local: no (compose provides);
   prod: yes. Apply: `alembic upgrade head`.
9. **Storage Account** — why: resume PDFs, screenshots, audio; used by:
   `storage_service.upload_blob`; env: `AZURE_STORAGE_CONNECTION_STRING`,
   `AZURE_STORAGE_CONTAINER`; local: no (local dir fallback); prod: yes.
10. **Key Vault** — why: hold secrets instead of env files; wire via Container
    Apps secret references; local: no; prod: recommended.
11. **Application Insights** — why: traces/latency/errors; used by:
    `shims.emit_trace`; env: `APPLICATIONINSIGHTS_CONNECTION_STRING`;
    local: no; prod: recommended.
12. **Azure Container Apps** — why: host backend; image from
    `backend/Dockerfile`; set env per `.env.example`; needs Managed Identity
    (4) + `DATABASE_URL` (8). Local equivalent: `docker compose up`
    (http://localhost:8000, /docs).

## Deploy sketch

```bash
az group create -n clarity-rg -l eastus
az postgres flexible-server create ... # + DATABASE_URL
az containerapp up -n clarity-api --source ./backend --env-vars CLARITY_AI_MODE=azure ...
```
