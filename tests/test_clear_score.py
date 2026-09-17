"""CLEAR SCORE bounds, determinism, sensitivity."""
from app.services.clear_score import compute_clear_score


def test_bounds():
    assert compute_clear_score().score in range(0, 101)
    assert compute_clear_score(1, 1, 1, 1, 1).score == 100
    assert compute_clear_score(0, 0, 0, 0, 0).score == 0


def test_deterministic():
    a = compute_clear_score(0.78, 0.71, 0.68, 0.75, 0.64)
    b = compute_clear_score(0.78, 0.71, 0.68, 0.75, 0.64)
    assert a == b and set(a.components) == {
        "target_mastery", "recent_performance", "company_alignment",
        "timed_performance", "core_cs"}


def test_weakness_and_alignment_move_score():
    base = compute_clear_score(0.7, 0.7, 0.7, 0.7, 0.7).score
    assert compute_clear_score(0.3, 0.7, 0.7, 0.7, 0.7).score < base
    assert compute_clear_score(0.7, 0.7, 0.2, 0.7, 0.7).score < base
