"""Foundry supporting surfaces: retrieval (IQ) + tracing.

Retrieval augments agent prompts with corpus hits. It is optional by design:
agents work without it, and it never fabricates content — empty index means
no anchors, not canned answers.
"""
from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


async def iq_retrieve(query: str, top_k: int = 3) -> list[dict]:
    """Azure AI Search over the curated corpus. Returns [] when unconfigured."""
    settings = get_settings()
    if not settings.AZURE_SEARCH_ENDPOINT:
        return []
    try:
        from azure.search.documents import SearchClient  # type: ignore
        from azure.core.credentials import AzureKeyCredential  # type: ignore
        from azure.identity import DefaultAzureCredential  # type: ignore
        credential = (AzureKeyCredential(settings.AZURE_SEARCH_API_KEY)
                      if settings.AZURE_SEARCH_API_KEY else DefaultAzureCredential())
        client = SearchClient(settings.AZURE_SEARCH_ENDPOINT,
                              settings.AZURE_SEARCH_INDEX, credential)
        return [{"content": r.get("content", ""), "score": r.get("@search.score", 0)}
                for r in client.search(query, top=top_k)]
    except Exception as e:
        log.info(f"iq retrieve failed: {e}")
        return []


def emit_trace(agent_name: str, workflow: str, trace_id: str, status: str,
               latency_ms: int):
    """App Insights when configured; no-op otherwise."""
    conn = get_settings().APPLICATIONINSIGHTS_CONNECTION_STRING
    if not conn:
        return
    try:
        from applicationinsights import TelemetryClient  # type: ignore
        tc = TelemetryClient(conn)
        tc.track_event(f"{workflow}.{agent_name}",
                       properties={"trace_id": trace_id, "status": status})
        tc.track_metric(f"{agent_name}_latency_ms", latency_ms)
        tc.flush()
    except Exception:
        pass
