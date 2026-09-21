# CLARITY Backend

Mastery-model backend (FastAPI modular monolith — agents, workflows,
services, one Foundry touchpoint). Product spec: repo-root
`CLARITY-product-spec.md`. Architecture: `docs/backend-architecture.md`.
API contracts: `docs/api-contracts.md`. Azure setup: `docs/azure-setup.md`.

## Prerequisites

- Python 3.11+ and `pip`
- A Microsoft Foundry project with a model deployment (e.g. `gpt-4o-mini`)
  and five deployed agents (`planner`, `question-generator`, `evaluator`,
  `interviewer`, `company-intel`) — see `docs/azure-setup.md`
- `az login` (local Entra auth; Managed Identity on Azure — no keys)
- Docker (optional, for Postgres + Redis via compose)

## Run

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill AZURE_FOUNDRY_PROJECT_ENDPOINT + MODEL_DEPLOYMENT
uvicorn app.main:app --reload        # http://localhost:8000/docs

# tests live at the repo root, so run them from there:
cd .. && pytest tests -q             # (or plain `pytest`, via pytest.ini)
```

Without the Azure env vars the API still boots: health/state/judge endpoints
work, agent endpoints return `FOUNDRY_NOT_CONFIGURED` with setup instructions.

```bash
docker compose up      # backend + postgres + redis (from backend/)
```

## Layout

```
backend/app/
  main.py  api/           # /api/v1 routes (router.py; extended.py = code-red/interviews/companies/outcomes)
  agents/                 # planner, question_generator, evaluator, interviewer (+company intel), orchestrator, base
  workflows/              # daily, onboarding, calibration, code_red, mock_interview
  services/               # mastery_engine, clear_score, judge, company_service, codeforces/github, storage
  integrations/foundry/   # client.py (ONLY Azure SDK imports) + shims.py (search/tracing)
  models/ schemas/ db/ core/  # sqlalchemy models, pydantic I/O, session+migrations, config/security/logging/errors
tests/                    # stub-ChatBackend injection, no Azure needed (26 tests)
```

## Key env vars

| Var | Required for | Default |
|---|---|---|
| `AZURE_FOUNDRY_PROJECT_ENDPOINT` | all agent calls | — |
| `AZURE_FOUNDRY_MODEL_DEPLOYMENT` | all agent calls | — |
| `PLANNER_AGENT`, `QUESTION_GENERATOR_AGENT`, `EVALUATOR_AGENT`, `INTERVIEWER_AGENT`, `COMPANY_INTEL_AGENT` | agent routing | `planner`, `question-generator`, … |
| `DATABASE_URL` | state | `sqlite:///./clarity.db` (compose overrides to Postgres) |
| `REDIS_URL` | reserved (caching/sessions) | `redis://localhost:6379/0` |
| `JWT_SECRET`, `DEV_AUTH_ALLOW_HEADER` | auth | dev-only values |
| `AZURE_SEARCH_ENDPOINT/INDEX` | retrieval anchors | — (agents work without) |
| `AZURE_STORAGE_CONNECTION_STRING` | blob uploads | — (local-dir fallback) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | tracing | — (no-op locally) |
