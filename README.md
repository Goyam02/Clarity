# CLARITY

Personalized interview/OA prep platform: a live mastery model of what the
student knows, read and written by five AI agents, consumed by Daily Mode,
CODE RED, and Mock Interview. Product spec: `CLARITY-product-spec.md`.

## Repo map

```
CLARITY-product-spec.md   # full product spec (source of truth for WHAT)
docs/
  backend-architecture.md # what is built + how it connects (source of truth for HOW)
  api-contracts.md        # versioned REST contracts for the frontend engineer
  azure-setup.md          # Azure resources + verification checklist
backend/                  # FastAPI modular monolith (agents, workflows, services)
  app/  requirements.txt  Dockerfile  docker-compose.yml  .env.example
tests/                    # 26 tests, Azure-free via stub backend injection
pytest.ini
```

## Backend in 30 seconds

- `backend/app/agents/` — Planner, Question Generator, Evaluator,
  Interviewer, Company Intel. Real Foundry calls (Entra auth, JSON-mode
  structured outputs, Pydantic validation + one repair retry). No mocks.
- `backend/app/services/mastery_engine.py` — deterministic scoring; the LLM
  never writes mastery directly. Decay computed at read time.
- `backend/app/services/judge.py` — subprocess code sandbox (never in-process).
- `backend/app/integrations/foundry/client.py` — the only Azure SDK touchpoint.
- State: PostgreSQL authoritative (sqlite default locally); Redis provisioned;
  Blob for files; App Insights for traces.

Start here: `backend/README.md` (run), `docs/azure-setup.md` (provise),
`docs/api-contracts.md` (integrate).
