"""Vision/text extraction for onboarding (spec §3 screens 2 & 3).

- Profile screenshots (LeetCode/GFG): image goes directly into a vision-capable
  model call — no OCR step, no credentials (spec's explicit security decision).
- Resume: PDF text extracted with pypdf, then a model call produces editable
  skill/project chips. (PDF pages themselves go to the model only when the
  deployment is multimodal over documents; text path is the reliable core.)

Same rules as the rest of the integration layer: real service calls only,
no fabricated content; failures raise FoundryError with actionable messages.
"""
import base64
import json
from typing import Protocol

from app.core.config import get_settings
from app.core.logging import get_logger
from app.integrations.foundry.client import FoundryError

log = get_logger(__name__)

SCREENSHOT_SYSTEM = """You read coding-profile screenshots (LeetCode / GeeksforGeeks).
Extract what is actually visible. Return ONLY JSON:
{"solved_counts": {"easy": int, "medium": int, "hard": int, "total": int},
 "topic_breakdown": [{"topic": str, "solved": int}],
 "handle": str,
 "notes": str}
Use 0 / [] for anything not visible. Never invent numbers you cannot see."""

RESUME_SYSTEM = """You read resumes for interview-preparation onboarding.
Return ONLY JSON:
{"skills": [str], "projects": [str], "summary": str}
skills/projects are short chip-style items the student will confirm or edit.
Only include what the resume actually says."""


class VisionBackend(Protocol):
    async def extract_image(self, image_data_uri: str, system: str) -> dict: ...
    async def extract_text(self, text: str, system: str) -> dict: ...


class FoundryVisionBackend:
    """Real multimodal calls via the Foundry OpenAI-compatible client."""

    def __init__(self, settings=None):
        self.settings = settings or get_settings()
        if not self.settings.AZURE_FOUNDRY_PROJECT_ENDPOINT:
            raise FoundryError(
                "AZURE_FOUNDRY_PROJECT_ENDPOINT is not configured. "
                "Vision extraction needs a Foundry project (see docs/azure-setup.md).",
                code="FOUNDRY_NOT_CONFIGURED", status=500)
        self._client = None

    async def _get_client(self):
        if self._client is None:
            from azure.ai.projects.aio import AIProjectClient
            from azure.identity.aio import DefaultAzureCredential
            project = AIProjectClient(
                endpoint=self.settings.AZURE_FOUNDRY_PROJECT_ENDPOINT,
                credential=DefaultAzureCredential())
            self._client = await project.get_openai_client()
        return self._client

    async def _complete(self, content: list[dict], system: str) -> dict:
        client = await self._get_client()
        resp = await client.chat.completions.create(
            model=self.settings.AZURE_FOUNDRY_MODEL_DEPLOYMENT,
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": content}],
            response_format={"type": "json_object"}, temperature=0.1,
            timeout=self.settings.FOUNDRY_TIMEOUT_SECONDS)
        raw = (resp.choices[0].message.content or "").strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            raise FoundryError("Extraction model returned non-JSON output.",
                               code="FOUNDRY_BAD_OUTPUT") from e

    async def extract_image(self, image_data_uri: str, system: str) -> dict:
        return await self._complete(
            [{"type": "text", "text": "Extract the profile data from this screenshot."},
             {"type": "image_url", "image_url": {"url": image_data_uri}}], system)

    async def extract_text(self, text: str, system: str) -> dict:
        return await self._complete(
            [{"type": "text", "text": text[:15000]}], system)


_vision_backend: VisionBackend | None = None


def get_vision_backend() -> VisionBackend:
    global _vision_backend
    if _vision_backend is None:
        _vision_backend = FoundryVisionBackend()
    return _vision_backend


def set_vision_backend(backend: VisionBackend | None) -> None:
    global _vision_backend
    _vision_backend = backend


def pdf_to_text(data: bytes) -> str:
    """Extract text from a resume PDF. Raises FoundryError on unreadable files."""
    try:
        from pypdf import PdfReader  # type: ignore
        import io
        reader = PdfReader(io.BytesIO(data))
        pages = [(p.extract_text() or "") for p in reader.pages]
        text = "\n".join(pages).strip()
        if not text:
            raise FoundryError(
                "Resume PDF has no extractable text (scanned image?). "
                "Paste your skills manually or upload a text-based PDF.",
                code="RESUME_UNREADABLE", status=400)
        return text
    except FoundryError:
        raise
    except Exception as e:
        raise FoundryError(f"Could not read resume PDF: {e}",
                           code="RESUME_UNREADABLE", status=400) from e


def blob_path(blob_ref: str):
    """Resolve a local:// blob reference to a filesystem path (local fallback)."""
    from app.services.storage_service import _LOCAL_DIR
    if not blob_ref.startswith("local://"):
        raise FoundryError(f"Unsupported blob ref: {blob_ref}",
                           code="BLOB_NOT_FOUND", status=404)
    path = _LOCAL_DIR / blob_ref.split("local://", 1)[1]
    if not path.exists():
        raise FoundryError(f"Blob not found: {blob_ref}",
                           code="BLOB_NOT_FOUND", status=404)
    return path


async def extract_profile_screenshot(image_bytes: bytes, platform: str) -> dict:
    backend = get_vision_backend()
    b64 = base64.b64encode(image_bytes).decode()
    uri = f"data:image/png;base64,{b64}"
    return await backend.extract_image(uri, SCREENSHOT_SYSTEM)


async def extract_resume(resume_text: str) -> dict:
    backend = get_vision_backend()
    return await backend.extract_text(
        f"Resume:\n\n{resume_text[:15000]}", RESUME_SYSTEM)
