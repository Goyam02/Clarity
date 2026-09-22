"""Consistent error envelope: {"error": {"code","message","request_id"}}."""
from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.logging import get_logger, request_id_ctx

log = get_logger(__name__)


class ClarityError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


async def clarity_error_handler(request: Request, exc: ClarityError) -> JSONResponse:
    if exc.status >= 500:
        log.error("%s %s -> %s %s: %s", request.method, request.url.path,
                  exc.status, exc.code, exc.message)
    return JSONResponse(
        status_code=exc.status,
        content={"error": {
            "code": exc.code,
            "message": exc.message,
            "request_id": request_id_ctx.get(),
        }},
    )


async def unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
    # Never leak internals (stack traces, SDK errors, credentials).
    return JSONResponse(
        status_code=500,
        content={"error": {
            "code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred.",
            "request_id": request_id_ctx.get(),
        }},
    )
