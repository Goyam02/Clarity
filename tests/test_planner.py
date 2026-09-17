"""Planner mood behavior + budget."""
from app.schemas import PlannerInput
from app.agents.planner import plan_deterministic

SNAP = [{"id": f"n{i}", "name": f"N{i}", "effective_mastery": 0.2 + i * 0.1,
         "importance": 0.5} for i in range(6)]


def test_light_revision_only():
    out = plan_deterministic(PlannerInput(mastery_snapshot=SNAP, mood="light",
                                          time_available=40))
    assert out.tasks and all(t.task_type == "revision" for t in out.tasks)


def test_normal_mix():
    out = plan_deterministic(PlannerInput(mastery_snapshot=SNAP, mood="normal",
                                          time_available=40))
    types = {t.task_type for t in out.tasks}
    assert "revision" in types and "problem" in types


def test_push_has_stretch():
    out = plan_deterministic(PlannerInput(mastery_snapshot=SNAP, mood="push",
                                          time_available=60))
    assert any(t.task_type == "timed_challenge" for t in out.tasks)


def test_budget_respected():
    out = plan_deterministic(PlannerInput(mastery_snapshot=SNAP, mood="push",
                                          time_available=25))
    assert sum(t.duration_minutes for t in out.tasks) <= 25
