"""Storage + memory abstractions. Local fallback; Azure SDKs optional imports."""
import os
import uuid
from pathlib import Path

from app.core.config import get_settings

_LOCAL_DIR = Path(os.environ.get("CLARITY_LOCAL_BLOB_DIR", "/tmp/clarity_blobs"))
_LOCAL_DIR.mkdir(parents=True, exist_ok=True)


async def upload_blob(filename: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Returns a blob reference. Uses Azure SDK when configured, else local dir."""
    settings = get_settings()
    conn = settings.AZURE_STORAGE_CONNECTION_STRING
    if conn:
        try:  # optional dep; only required when actually using Azure storage
            from azure.storage.blob import BlobServiceClient  # type: ignore
            svc = BlobServiceClient.from_connection_string(conn)
            blob = f"{uuid.uuid4().hex[:12]}-{filename}"
            svc.get_blob_client(container=settings.AZURE_STORAGE_CONTAINER, blob=blob).upload_blob(
                data, overwrite=True, content_type=content_type)
            return f"azure://{settings.AZURE_STORAGE_CONTAINER}/{blob}"
        except Exception:
            pass
    ref = f"local://{uuid.uuid4().hex[:12]}-{filename}"
    (_LOCAL_DIR / ref.split("local://")[1]).write_bytes(data)
    return ref


class MemoryService:
    """Foundry Memory abstraction: agent long-term context only (NOT mastery state).

    Backed by in-memory dict locally; swap with Foundry Memory API when available.
    Mastery Model stays in PostgreSQL (see models/mastery).
    """

    def __init__(self):
        self._store: dict[str, list[dict]] = {}

    async def remember(self, user_id: str, agent: str, observation: str, kind: str = "observation") -> dict:
        entry = {"agent": agent, "kind": kind, "observation": observation}
        self._store.setdefault(user_id, []).append(entry)
        return entry

    async def recall(self, user_id: str, limit: int = 20) -> list[dict]:
        return self._store.get(user_id, [])[-limit:]


memory_service = MemoryService()
