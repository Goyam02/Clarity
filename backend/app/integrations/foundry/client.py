"""Foundry integration layer — the ONLY place Azure SDK calls live.

Verified against azure-ai-projects 2.6.1 + azure-identity (Sep 2026):
  - `AIProjectClient(endpoint, DefaultAzureCredential)` — project-scoped client.
  - `client.get_openai_client()` — project-scoped async Responses client;
    `agent_reference` selects the deployed agent (including its model/tools).
  - Auth uses an optional API key or Entra ID (`az login` / Managed Identity).

There are no mock fallbacks. Every agent call hits the real service; transport
failures raise FoundryError (mapped to 502/503 with an actionable message) and
schema violations trigger one repair attempt before failing loudly.
"""
import asyncio
import json
import re
from typing import Protocol

from app.core.config import get_settings
from app.core.errors import ClarityError
from app.core.logging import get_logger

log = get_logger(__name__)


class FoundryError(ClarityError):
    def __init__(self, message: str, code: str = "FOUNDRY_UNAVAILABLE",
                 status: int = 502):
        super().__init__(code, message, status)


class ChatBackend(Protocol):
    async def complete_json(self, *, agent: str, system: str, user: str) -> dict:
        """Return the model-decoded JSON object for this agent call."""
        ...


class FoundryChatBackend:
    """Production backend: Foundry Responses API with deployed agent references."""

    def __init__(self, settings=None):
        self.settings = settings or get_settings()
        if not self.settings.AZURE_FOUNDRY_PROJECT_ENDPOINT:
            raise FoundryError(
                "AZURE_FOUNDRY_PROJECT_ENDPOINT is not configured. "
                "Create a Microsoft Foundry project and set the endpoint "
                "(see docs/azure-setup.md).",
                code="FOUNDRY_NOT_CONFIGURED", status=500)
        self._project = None
        self._client = None

    def _project_client(self):
        if self._project is None:
            try:
                from azure.ai.projects.aio import AIProjectClient
                from azure.identity.aio import DefaultAzureCredential
                self._project = AIProjectClient(
                    endpoint=self.settings.AZURE_FOUNDRY_PROJECT_ENDPOINT,
                    credential=DefaultAzureCredential())
            except ClarityError:
                raise
            except Exception as e:
                raise FoundryError(
                    "Could not build the Foundry project client: "
                    f"{e}. In containers, DefaultAzureCredential needs a service "
                    "principal (AZURE_CLIENT_ID / AZURE_TENANT_ID / "
                    "AZURE_CLIENT_SECRET) or a managed identity — 'az login' "
                    "tokens from the host are not visible. "
                    "See docs/azure-setup.md.",
                    code="FOUNDRY_AUTH_FAILED", status=500) from e
        return self._project

    async def _get_client(self):
        if self._client is None:
            try:
                # Optional API-key auth (AZURE_FOUNDRY_API_KEY): see vision.py.
                api_key = self.settings.AZURE_FOUNDRY_API_KEY or None
                kwargs: dict = {"api_key": api_key} if api_key else {}
                # azure-ai-projects >= 2.6: get_openai_client() is SYNC and
                # returns the AsyncOpenAI client directly (do NOT await it).
                # Agent-specific preview endpoints do not expose Chat
                # Completions for these agents. Invoke them through the
                # project's Responses API with an agent_reference instead.
                self._client = self._project_client().get_openai_client(**kwargs)
            except FoundryError:
                raise
            except Exception as e:
                raise FoundryError(
                    f"Could not build the Foundry Responses client: {e}.",
                    code="FOUNDRY_CLIENT_FAILED") from e
        return self._client

    async def complete_json(self, *, agent: str, system: str, user: str) -> dict:
        messages = [{"type": "message", "role": "system",
                     "content": system + "\nReturn only a JSON object, "
                     "without Markdown code fences."},
                    {"type": "message", "role": "user", "content": user}]
        for attempt in range(2):
            resp = await self._request(agent=agent, messages=messages)
            if resp.status != "completed":
                raise FoundryError(
                    f"Agent '{agent}' response did not complete (status={resp.status}).",
                    code="FOUNDRY_BAD_OUTPUT")
            content = (resp.output_text or "").strip()
            # Accept a single fenced JSON document, but never guess which
            # object to use from prose or multiple documents.
            fenced = re.fullmatch(r"```(?:json)?\s*\n(.*?)\n\s*```", content,
                                  flags=re.DOTALL | re.IGNORECASE)
            if fenced:
                content = fenced.group(1).strip()
            try:
                output = json.loads(content)
            except json.JSONDecodeError as e:
                detail = f"invalid JSON at line {e.lineno}, column {e.colno}: {e.msg}"
            else:
                if isinstance(output, dict):
                    return output
                detail = "expected a JSON object, not " + type(output).__name__
            if attempt:
                raise FoundryError(
                    f"Agent '{agent}' returned invalid JSON output after one repair attempt "
                    f"({detail}).", code="FOUNDRY_BAD_OUTPUT")
            log.info(f"foundry agent '{agent}' output needs JSON repair: {detail}")
            if resp.output_text:
                messages.append({"type": "message", "role": "assistant",
                                 "content": resp.output_text})
            messages.append({"type": "message", "role": "user", "content": (
                f"Your previous response could not be decoded: {detail}. "
                "Return the complete corrected JSON object for the original task. "
                "Use double-quoted keys and strings, escape newlines within strings, "
                "and include no commentary or Markdown fences.")})

    async def _request(self, *, agent: str, messages: list[dict]):
        """Transport retries are independent of the single JSON repair attempt."""
        from azure.core.exceptions import ClientAuthenticationError
        from openai import (APIConnectionError, APITimeoutError, InternalServerError,
                            NotFoundError, RateLimitError)
        transient = (RateLimitError, APIConnectionError, APITimeoutError,
                     InternalServerError, asyncio.TimeoutError)
        client = await self._get_client()
        last_err: Exception | None = None
        for attempt in range(max(1, self.settings.FOUNDRY_MAX_RETRIES)):
            try:
                # With agent_reference, model/instructions/temperature/text
                # overrides are rejected. Supply the per-call prompt as input
                # messages; model settings and tools come from the agent.
                return await client.responses.create(
                    input=messages,
                    extra_body={"agent_reference": {"name": agent,
                                                    "type": "agent_reference"}},
                    timeout=self.settings.FOUNDRY_TIMEOUT_SECONDS,
                )
            except transient as e:
                last_err = e
                log.info(f"foundry agent '{agent}' attempt {attempt + 1} transient failure: {e}")
                await asyncio.sleep(1.5 ** attempt)
            except FoundryError:
                raise
            except NotFoundError as e:
                raise FoundryError(
                    f"Foundry could not find agent '{agent}' or its deployment. "
                    "Check AZURE_FOUNDRY_PROJECT_ENDPOINT and the configured "
                    f"agent name; ensure the agent has a deployed version. {e}",
                    code="FOUNDRY_AGENT_NOT_FOUND") from e
            except ClientAuthenticationError as e:
                # Auth token fetch is lazy (first request): map credential
                # failures to an actionable message instead of a raw 500.
                raise FoundryError(
                    "Foundry authentication failed: no Entra credential is "
                    "available to the backend. Easiest fix: set "
                    "AZURE_FOUNDRY_API_KEY in backend/.env (Foundry project "
                    "API key), or give the container a service principal "
                    "(AZURE_CLIENT_ID / AZURE_TENANT_ID / AZURE_CLIENT_SECRET). "
                    "See docs/azure-setup.md.",
                    code="FOUNDRY_AUTH_FAILED", status=500) from e
            except Exception as e:
                # Non-transient (auth, bad request, missing deployment): fail fast.
                raise FoundryError(
                    f"Foundry call for agent '{agent}' failed: {e}",
                    code="FOUNDRY_CALL_FAILED") from e
        raise FoundryError(
            f"Foundry agent '{agent}' unavailable after retries: {last_err}",
            code="FOUNDRY_UNAVAILABLE") from last_err


_backend: ChatBackend | None = None


def get_backend() -> ChatBackend:
    """Process-wide backend. Tests inject a stub via set_backend() — production
    code never branches on environment."""
    global _backend
    if _backend is None:
        _backend = FoundryChatBackend()
    return _backend


def set_backend(backend: ChatBackend | None) -> None:
    global _backend
    _backend = backend


def new_trace_id() -> str:
    import uuid
    return uuid.uuid4().hex[:16]
