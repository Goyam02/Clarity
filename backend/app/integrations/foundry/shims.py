"""Foundry sub-module shims: agents/workflows/memory/iq/tracing.

Each exposes a typed interface with mock behavior now and a documented
azure path later. Routes/services must import these, never raw Azure SDKs.
"""
from app.integrations.foundry.client import foundry

# agents.py surface
AGENT_SYSTEM_PROMPTS = {
    "planner": "You are CLARITY Planner. Emit JSON {tasks:[{task_type,node_id,duration_minutes,reason}]}.",
    "question_generator": "You are CLARITY Question Generator. Emit a fresh problem as JSON.",
    "evaluator": "You are CLARITY Evaluator. Emit JSON {correctness,error_type,feedback,mastery_signals}.",
    "interviewer": "You are CLARITY Interviewer. One calibrated persona; concise verbal prompts.",
    "company_intel": "You are CLARITY Company Intel. Emit JSON company profile.",
}

# workflows.py surface: Foundry Workflows not in installed SDK -> local orchestration.
# memory.py surface: durable agent context only (mastery stays in Postgres).
# iq.py surface: retrieval over curated corpus; mock returns seed anchors.
# tracing.py surface: agent_run rows + App Insights when configured.

SEED_COMPANY_PROFILES = {
    "servicenow": {
        "oa_patterns": ["array+hash", "sliding-window", "intervals"],
        "interview_patterns": ["explain approach aloud", "follow-up complexity"],
        "core_subjects": ["DBMS: indexing, joins", "OS: paging"],
        "difficulty": "medium",
        "round_structure": ["OA (2 DSA)", "technical interview", "HR"],
        "sources": ["seed-curated"],
        "confidence": 0.6,
    }
}


async def iq_retrieve(query: str, top_k: int = 3) -> list[dict]:
    """Azure path: Azure AI Search (AZURE_SEARCH_ENDPOINT/INDEX). Mock: seed anchors."""
    settings = foundry.settings
    if foundry.mode == "azure" and settings.AZURE_SEARCH_ENDPOINT:
        try:
            from azure.search.documents import SearchClient  # type: ignore
            from azure.core.credentials import AzureKeyCredential  # type: ignore
            client = SearchClient(settings.AZURE_SEARCH_ENDPOINT, settings.AZURE_SEARCH_INDEX,
                                  AzureKeyCredential(settings.AZURE_SEARCH_API_KEY))
            results = client.search(query, top=top_k)
            return [{"content": r.get("content", ""), "score": r.get("@search.score", 0)}
                    for r in results]
        except Exception:
            pass
    q = query.lower()
    for name, profile in SEED_COMPANY_PROFILES.items():
        if name in q:
            return [{"content": str(profile), "score": 0.9, "source": "seed"}]
    return [{"content": "generic DSA pattern anchor", "score": 0.3, "source": "seed"}]


def emit_trace(agent_name: str, workflow: str, trace_id: str, status: str, latency_ms: int):
    """App Insights when configured; no-op otherwise (never mandatory locally)."""
    conn = foundry.settings.APPLICATIONINSIGHTS_CONNECTION_STRING
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
