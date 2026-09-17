# CLARITY Backend

Mastery-model backend (FastAPI modular monolith). Full spec: repo-root
`CLARITY-product-spec.md`; architecture notes: `docs/backend-architecture.md`;
contracts: `docs/api-contracts.md`; Azure: `docs/azure-setup.md`.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload        # http://localhost:8000/docs

# tests live at the repo root, so run them from there:
cd .. && pytest tests -q             # (or plain `pytest`, via pytest.ini)
```
