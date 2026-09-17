"""Structured logging with request_id propagation."""
import logging
import sys
import uuid
from contextvars import ContextVar

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(logging.Formatter(
    "%(asctime)s %(levelname)s request_id=%(request_id)s %(name)s: %(message)s"
))


class _Adapter(logging.LoggerAdapter):
    def process(self, msg, kwargs):
        kwargs.setdefault("extra", {}).setdefault("request_id", request_id_ctx.get())
        return msg, kwargs


def get_logger(name: str) -> logging.LoggerAdapter:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.addHandler(_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return _Adapter(logger, {})


def new_request_id() -> str:
    rid = uuid.uuid4().hex[:12]
    request_id_ctx.set(rid)
    return rid
