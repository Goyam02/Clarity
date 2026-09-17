"""Deterministic MasteryEngine: pure/testable. LLM never writes the score directly.

update(): transparent weighted model over correctness, time, hints,
explanation quality. effective_mastery(): read-time decay without DB writes.
"""
import math
from dataclasses import dataclass


@dataclass(frozen=True)
class MasteryUpdateResult:
    new_score: float
    delta: float


class MasteryEngine:
    @staticmethod
    def update(
        current_mastery: float,
        correctness: float,
        solve_time_seconds: float = 600,
        expected_time_seconds: float = 600,
        hints_used: int = 0,
        confidence: float = 0.85,
        explanation_quality: float | None = None,
    ) -> MasteryUpdateResult:
        correctness = min(1.0, max(0.0, correctness))
        confidence = min(1.0, max(0.0, confidence))
        # Time factor: faster than expected boosts, slower dampens (0.7..1.1).
        ratio = solve_time_seconds / max(1.0, expected_time_seconds)
        time_factor = min(1.1, max(0.7, 1.15 - 0.25 * ratio))
        # Hints: each hint removes ~12% of the gain.
        hint_factor = max(0.4, 1.0 - 0.12 * max(0, hints_used))
        # Explanation quality blends in when provided.
        evidence = correctness
        if explanation_quality is not None:
            explanation_quality = min(1.0, max(0.0, explanation_quality))
            evidence = 0.7 * correctness + 0.3 * explanation_quality
        # Target implied by this attempt.
        target = min(1.0, max(0.0, evidence * time_factor * hint_factor))
        # Adaptive step: lower confidence in stored score -> bigger move.
        step = 0.25 + 0.35 * (1.0 - confidence)
        new_score = current_mastery + step * (target - current_mastery)
        new_score = min(1.0, max(0.0, new_score))
        return MasteryUpdateResult(new_score=round(new_score, 4), delta=round(new_score - current_mastery, 4))

    @staticmethod
    def effective_mastery(stored_mastery: float, days_since_seen: float, decay_rate: float = 0.02) -> float:
        """Exponential decay computed at read time; never writes to DB on read."""
        days_since_seen = max(0.0, days_since_seen)
        eff = stored_mastery * math.exp(-decay_rate * days_since_seen)
        return round(min(1.0, max(0.0, eff)), 4)

    @staticmethod
    def staleness(days_since_seen: float, decay_rate: float = 0.02) -> float:
        return round(1.0 - math.exp(-decay_rate * max(0.0, days_since_seen)), 4)
