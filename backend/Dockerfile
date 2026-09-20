FROM python:3.13-slim

WORKDIR /srv/app

# Build context is the repo root (see root docker-compose.yml).
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/alembic.ini ./alembic.ini
# Company problem-frequency corpus is read at runtime (COMPANY_CORPUS_DIR).
COPY data/company-corpus ./company-corpus

ENV PYTHONPATH=/srv/app
ENV COMPANY_CORPUS_DIR=/srv/app/company-corpus/companies

EXPOSE 8000

# Apply migrations to the (already healthy) Postgres, then serve.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
