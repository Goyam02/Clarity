"""Drift detector: flags stale company intel without triggering research."""
from datetime import datetime, timezone

STALE_AFTER_DAYS = 90


def drift_status(last_verified: datetime | None) -> dict:
    now = datetime.now(timezone.utc)
    if last_verified is None:
        return {"stale": True, "last_verified": None,
                "message": "Company intelligence has never been verified."}
    lv = last_verified if last_verified.tzinfo else last_verified.replace(tzinfo=timezone.utc)
    days = (now - lv).days
    stale = days > STALE_AFTER_DAYS
    iso = lv.date().isoformat()
    return {
        "stale": stale,
        "last_verified": iso,
        "message": ("Company intelligence should be refreshed." if stale
                    else "Company intelligence is fresh."),
    }
