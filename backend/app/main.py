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
