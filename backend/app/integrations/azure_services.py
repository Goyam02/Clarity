"""Azure service shims: storage/search/speech. Optional SDK imports only."""
from app.integrations.foundry.client import foundry


async def search_company(query: str) -> list[dict]:
    from app.integrations.foundry.shims import iq_retrieve
    return await iq_retrieve(query)


def speech_available() -> bool:
    """Voice Live: no stable SDK in this env -> interface reserved."""
    return False
