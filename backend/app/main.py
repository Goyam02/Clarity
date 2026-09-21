"""FastAPI entrypoint: middleware (request_id, timing), errors, router."""
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router
from app.core.errors import ClarityError, clarity_error_handler, unhandled_error_handler
from app.core.logging import get_logger, new_request_id, request_id_ctx
from app.db.base import Base
from app.db.session import engine

log = get_logger(__name__)

# Import models so metadata is registered before create_all.
import app.models  # noqa: F401,E402

Base.metadata.create_all(bind=engine)


# --- Local-dev schema upgrade (sqlite only; Postgres runs alembic) --------

def _sqlite_add_missing_columns() -> None:
    """Existing local dev DBs predate the Phase 1 columns. create_all cannot
    ALTER existing tables, so add any missing columns idempotently."""
    if not str(engine.url).startswith("sqlite"):
        return
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    wanted: dict[str, list[tuple[str, str]]] = {
        "users": [("password_hash", "VARCHAR(255) DEFAULT '' NOT NULL"),
                  ("google_sub", "VARCHAR(64) DEFAULT '' NOT NULL")],
        "profiles": [("target_companies", "JSON DEFAULT '[]' NOT NULL"),
                     ("onboarding_complete", "BOOLEAN DEFAULT 0 NOT NULL")],
        "code_red_tasks": [("detail", "JSON DEFAULT '{}' NOT NULL"),
                           ("title", "VARCHAR(500) DEFAULT '' NOT NULL")],
        "company_profiles": [("web_problems", "JSON DEFAULT '[]' NOT NULL"),
                             ("web_interview_questions", "JSON DEFAULT '[]' NOT NULL"),
                             ("web_researched_at", "DATETIME NULL")],
        # LeetCode/Codeforces pull columns (docs/plans/plan-leetcode-pulls.md):
        # existing dev DBs predate 0003_platform_signals.
        "profiles": [("leetcode_session_encrypted", "TEXT DEFAULT '' NOT NULL"),
                     ("leetcode_csrf_encrypted", "TEXT DEFAULT '' NOT NULL"),
                     ("leetcode_username", "VARCHAR(64) DEFAULT '' NOT NULL"),
                     ("leetcode_synced_at", "DATETIME NULL"),
                     ("leetcode_last_error", "VARCHAR(64) DEFAULT '' NOT NULL"),
                     ("codeforces_synced_at", "DATETIME NULL")],
    }
    with engine.begin() as conn:
        for table, cols in wanted.items():
            if table not in inspector.get_table_names():
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in cols:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                    log.info(f"sqlite migration: added {table}.{name}")


try:
    _sqlite_add_missing_columns()
except Exception as e:  # fresh DB or transient inspect failure is non-fatal
    log.info(f"sqlite schema check skipped: {e}")

app = FastAPI(title="CLARITY API", version="1.0.0",
              description="Mastery-model backend: Daily, CODE RED, Mock Interview.")
app.add_exception_handler(ClarityError, clarity_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.middleware("http")
async def request_context(request: Request, call_next):
    rid = request.headers.get("X-Request-Id") or new_request_id()
    request_id_ctx.set(rid)
    start = time.time()
    response = await call_next(request)
    response.headers["X-Request-Id"] = rid
    log.info(f"{request.method} {request.url.path} -> {response.status_code} "
             f"{int((time.time() - start) * 1000)}ms")
    return response


@app.get("/health")
def root_health():
    return {"status": "ok"}
