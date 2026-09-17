"""CLEAR SCORE: 0-100 weighted readiness index (NOT a calibrated probability yet).

Components: target_mastery, recent_performance, company_alignment,
timed_performance, core_cs. Deterministic and explainable.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class ClearScoreResult:
    score: int
    components: dict


WEIGHTS = {
    "target_mastery": 0.30,
    "recent_performance": 0.25,
    "company_alignment": 0.20,
    "timed_performance": 0.15,
    "core_cs": 0.10,
}


def compute_clear_score(
    target_mastery: float = 0.5,
    recent_performance: float = 0.5,
    company_alignment: float = 0.5,
    timed_performance: float = 0.5,
    core_cs: float = 0.5,
) -> ClearScoreResult:
    comps = {
        k: round(min(1.0, max(0.0, v)), 4)
        for k, v in {
            "target_mastery": target_mastery,
            "recent_performance": recent_performance,
            "company_alignment": company_alignment,
            "timed_performance": timed_performance,
            "core_cs": core_cs,
        }.items()
    }
    score = round(sum(comps[k] * w for k, w in WEIGHTS.items()) * 100)
    return ClearScoreResult(score=max(0, min(100, score)), components=comps)
