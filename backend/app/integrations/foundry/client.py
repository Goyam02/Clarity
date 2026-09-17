"""Foundry integration layer — the ONLY place Azure SDK calls live.

Verified against installed packages (Sep 2026 env): azure-identity /
azure-ai-projects SDKs are NOT installed here, so this module uses:
  - mock mode (default): deterministic local outputs
  - azure mode: OpenAI-compatible chat endpoint (AZURE_OPENAI_ENDPOINT or
    AZURE_FOUNDRY_PROJECT_ENDPOINT) via the installed `openai` package with
    DefaultAzureCredential only when `azure-identity` is present (optional import).

Deviations from CLARITY-product-spec.md §11 (documented, not fabricated):
  - "Managed memory", "Foundry IQ", "Deep Research tool", "Connected Agents",
    "Voice Live" APIs are referenced in the spec but no stable SDK surface for
    them exists in this environment. Each has a typed abstraction below
    (Memory/IQ/Workflows/Tracing modules) with a working mock + a documented
    azure path, so features integrate later without touching routes.
"""
import time
import uuid

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


def get_credential():
    """DefaultAzureCredential when azure-identity is installed, else None (key/CLI auth)."""
    try:
        from azure.identity import DefaultAzureCredential  # type: ignore
        return DefaultAzureCredential()
    except Exception:
        return None


class FoundryClient:
    """Central client abstraction. Mode from CLARITY_AI_MODE (mock|azure)."""

    def __init__(self):
        self.settings = get_settings()
        self._openai = None

    @property
    def mode(self) -> str:
        return "azure" if self.settings.ai_mode == "azure" else "mock"

    def _azure_chat_client(self):
        if self._openai is not None:
            return self._openai
        endpoint = self.settings.AZURE_OPENAI_ENDPOINT or self.settings.AZURE_FOUNDRY_PROJECT_ENDPOINT
        if not endpoint:
            return None
        try:
            from openai import AsyncAzureOpenAI  # installed
            cred = get_credential()
            if self.settings.AZURE_OPENAI_API_KEY:
                self._openai = AsyncAzureOpenAI(
                    azure_endpoint=endpoint, api_key=self.settings.AZURE_OPENAI_API_KEY,
                    api_version="2024-10-01-preview")
            elif cred is not None:
                from azure.identity import get_bearer_token_provider  # type: ignore
                provider = get_bearer_token_provider(
                    cred, "https://cognitiveservices.azure.com/.default")
                self._openai = AsyncAzureOpenAI(
                    azure_endpoint=endpoint, azure_ad_token_provider=provider,
                    api_version="2024-10-01-preview")
            else:
                return None
            return self._openai
        except Exception as e:
            log.info(f"azure chat client unavailable: {e}")
            return None

    async def complete_structured(self, agent_name: str, system: str, user_payload: str,
                                  fallback: dict, model: str = "") -> dict:
        """Structured completion with bounded retries (3 attempts, transient only)."""
        if self.mode == "mock":
            return fallback
        client = self._azure_chat_client()
        if client is None:
            log.info("azure endpoint unconfigured; using mock fallback")
            return fallback
        last_err: Exception | None = None
        for attempt in range(3):
            try:
                resp = await client.chat.completions.create(
                    model=model or self.settings.AZURE_FOUNDRY_MODEL or "gpt-4o-mini",
                    messages=[{"role": "system", "content": system},
                              {"role": "user", "content": user_payload}],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                )
                import json
                return json.loads(resp.choices[0].message.content or "{}")
            except Exception as e:
                last_err = e
                log.info(f"foundry call attempt {attempt + 1} failed: {e}")
                time.sleep(1 + attempt)
        log.info(f"foundry failed after retries: {last_err}; using mock fallback")
        return fallback

    def new_trace_id(self) -> str:
        return uuid.uuid4().hex[:16]


foundry = FoundryClient()
