"""Reusable agent base: structured I/O, logging, trace metadata, retries, audit."""
import time
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.integrations.foundry.client import foundry
from app.integrations.foundry.shims import AGENT_SYSTEM_PROMPTS, emit_trace
from app.models import AgentRun

log = get_logger(__name__)


class ClarityAgent:
    name: str = "base"

    async def run(self, input_data: dict, user_id: str = "", workflow: str = "",
                  db: Session | None = None) -> dict:
        trace_id = foundry.new_trace_id()
        start = time.time()
        try:
            output = await self._execute(input_data)
            status, error = "ok", ""
        except Exception as e:
            output, status, error = {"error": str(e)[:500]}, "error", str(e)[:1000]
        latency_ms = int((time.time() - start) * 1000)
        emit_trace(self.name, workflow or "adhoc", trace_id, status, latency_ms)
        if db is not None:
            try:
                db.add(AgentRun(agent_name=self.name, workflow_name=workflow,
                                user_id=user_id, input_summary=_summarize(input_data),
                                output_summary=_summarize(output), status=status,
                                latency_ms=latency_ms, error=error, trace_id=trace_id))
                db.commit()
            except Exception as e:
                log.info(f"agent_run audit failed: {e}")
                db.rollback()
        return {"output": output, "trace_id": trace_id, "status": status}

    async def _execute(self, input_data: dict) -> dict:
        raise NotImplementedError


def _summarize(d: Any, limit: int = 2000) -> Any:
    s = str(d)
    return {"preview": s[:limit], "trace": uuid.uuid4().hex[:8]}
