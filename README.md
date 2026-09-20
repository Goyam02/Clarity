# CLARITY

Mastery-model interview prep: Daily Mode, CODE RED, and Mock Interviews, all
reading and writing one shared Knowledge Graph. FastAPI + Postgres backend
(`backend/`), Vite + React 19 SPA (`frontend/`), full docs in `docs/`.

## Run locally

### Option A — full stack with Docker (recommended)

```bash
cp backend/.env.example backend/.env   # if you don't have one yet; fill AZURE_FOUNDRY_* + az login
docker compose up --build
```

After startup (first build takes a few minutes; migrations run automatically
when the backend container starts):

| Service | URL |
|---|---|
| **Web app** | **http://localhost:3000** |
| API (direct) | http://localhost:8000 (health: http://localhost:8000/health) |
| Postgres | localhost:5432 (clarity/clarity) |
| Redis | localhost:6379 |

Everything (including the API) is reachable through the frontend at
`http://localhost:3000` — nginx proxies `/api/*` to the backend — but the SPA
also calls `http://localhost:8000` directly (its default `VITE_API_BASE_URL`).

Stop with `Ctrl-C`, wipe everything with `docker compose down -v`.

### Option B — dev servers without Docker

```bash
# 1. Postgres + Redis only (or point DATABASE_URL at any instance)
docker compose up postgres redis

# 2. Backend (uses backend/.env; sqlite also works for quick local runs)
cd backend && source .venv/bin/activate   # or: python -m venv .venv && pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. Frontend
cd frontend && npm install && npm run dev   # http://localhost:3000
```

### Tests

```bash
backend/.venv/bin/python -m pytest -q     # backend (sqlite, hermetic)
cd frontend && npm run lint && npm test   # typecheck + vitest
```

## Agent features (Azure Foundry)

Agent-backed endpoints (planner, question generation, interviews) require a
Foundry project + deployed agents — see `docs/azure-setup.md` and
`docs/credentials-and-roadmap.md`. Without them those endpoints return
`FOUNDRY_NOT_CONFIGURED`; mastery graph, platform pulls, and submission
judging work regardless.

## Platform progress sync (LeetCode + Codeforces)

- **Connect**: Onboarding screen 3 or Settings → Connected accounts. LeetCode
  needs your `LEETCODE_SESSION` + `csrftoken` cookies (encrypted at rest,
  Fernet); Codeforces needs only a public handle.
- **Daily sync**: fires once per browser session at login/signup and on the
  dashboard — `POST /users/me/platforms/sync` pulls both platforms, blends
  topic evidence into the Mastery Model, and records solved problems in the
  Platform Pulse card.
- **Expired cookies**: if LeetCode rejects the stored cookies, the dashboard
  raises a popup linking to Settings where you paste fresh values.
- Manual controls live in Settings (Refresh / Disconnect); the backend
  rate-limits refreshes to one per hour per user.
