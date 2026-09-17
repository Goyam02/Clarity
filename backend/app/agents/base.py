"""Reusable agent base: prompt -> real LLM call -> pydantic validation.

Each agent declares a system prompt, an output schema, and optional
post-validation (budget clamps, constraint enforcement — never content).
Schema violations trigger one repair attempt showing the model its errors;
persistent failure raises FoundryError instead of serving bad data.
"""
import time

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.integrations.foundry.client import ChatBackend, FoundryError, get_backend, new_trace_id
from app.integrations.foundry.shims import emit_trace
from app.models import AgentRun

log = get_logger(__name__)


class ClarityAgent:
    name: str = "base"
    foundry_agent: str = ""  # Foundry agent resource; defaults to name
    system_prompt: str = ""
    output_model: type[BaseModel] | None = None

    def __init__(self, llm: ChatBackend | None = None):
        self.llm = llm or get_backend()

    def build_prompt(self, input_data: dict) -> str:
        import json
        return json.dumps(input_data, default=str)

    def post_validate(self, data: BaseModel, input_data: dict) -> BaseModel:
        return data

    async def run(self, input_data: dict, user_id: str = "",
                  workflow: str = "", db: Session | None = None) -> dict:
        trace_id = new_trace_id()
        start = time.time()
        try:
            raw = await self.llm.complete_json(
                agent=self.foundry_agent or self.name,
                system=self.system_prompt,
                user=self.build_prompt(input_data))
            try:
                parsed = self._parse(raw)
            except ValidationError as e:
                # One repair attempt: show the model its schema errors.
                raw = await self.llm.complete_json(
                    agent=self.foundry_agent or self.name,
                    system=self.system_prompt,
                    user=(self.build_prompt(input_data)
                          + f"\n\nYour previous output failed schema validation with: "
                          f"{e.errors()}. Return ONLY corrected JSON."))
                parsed = self._parse(raw)  # raises -> FoundryError path below
            output = self.post_validate(parsed, input_data).model_dump()
            status, error = "ok", ""
        except ValidationError as e:
            output, status, error = {}, "error", f"schema validation failed: {e.errors()}"
        except FoundryError as e:
            output, status, error = {}, "error", f"{e.code}: {e.message}"
        except Exception as e:
            output, status, error = {}, "error", str(e)[:1000]
        latency_ms = int((time.time() - start) * 1000)
        emit_trace(self.name, workflow or "adhoc", trace_id, status, latency_ms)
        if db is not None:
            try:
                db.add(AgentRun(agent_name=self.name, workflow_name=workflow,
                                user_id=user_id,
                                input_summary={"preview": str(input_data)[:2000]},
                                output_summary={"preview": str(output)[:2000]},
                                status=status, latency_ms=latency_ms,
                                error=error, trace_id=trace_id))
                db.commit()
            except Exception as e:
                log.info(f"agent_run audit failed: {e}")
                db.rollback()
        if status != "ok":
            raise FoundryError(error or "agent failed", code="AGENT_FAILED")
        return {"output": output, "trace_id": trace_id, "status": status}

    def _parse(self, raw: dict) -> BaseModel:
        assert self.output_model is not None, f"{self.name} has no output_model"
        if not isinstance(raw, dict):
            raise FoundryError(f"Agent '{self.name}' returned non-object JSON.",
                               code="FOUNDRY_BAD_OUTPUT")
        return self.output_model(**raw)
