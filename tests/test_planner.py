"""Planner: constraint enforcement + prompt contract (content comes from LLM)."""
import pytest

from app.agents.planner import PlannerAgent, enforce_budget
from app.schemas import PlannerTask


def _task(t="revision", m=10):
    return PlannerTask(task_type=t, node_id="n1", duration_minutes=m,
                       reason="weak_spot", title="x")


def test_enforce_budget_scales_down():
    tasks = enforce_budget([_task(m=20), _task(m=20)], 25)
    assert sum(t.duration_minutes for t in tasks) <= 25


def test_enforce_budget_untouched_when_fits():
    tasks = enforce_budget([_task(m=8)], 40)
    assert tasks[0].duration_minutes == 8


@pytest.mark.asyncio
async def test_light_filters_to_revision_only(stub):
    stub.calls.clear()
    # Planner stub returns revision + problem; light mood must drop the problem.
    out = await PlannerAgent(llm=stub).run(
        {"mastery_snapshot": [], "mood": "light", "time_available": 40})
    types = {t["task_type"] for t in out["output"]["tasks"]}
    assert types == {"revision"}


@pytest.mark.asyncio
async def test_plan_budget_respected(stub):
    out = await PlannerAgent(llm=stub).run(
        {"mastery_snapshot": [], "mood": "normal", "time_available": 10})
    assert sum(t["duration_minutes"] for t in out["output"]["tasks"]) <= 10


def test_prompt_carries_mood_and_budget():
    agent = PlannerAgent.__new__(PlannerAgent)  # no backend needed for prompt building
    prompt = agent.build_prompt(
        {"mastery_snapshot": [], "mood": "push", "time_available": 45})
    assert "push" in prompt and "45" in prompt
