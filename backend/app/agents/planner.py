"""Planner agent: mastery snapshot + mood + time -> validated task list.

Mood is a request-time constraint: light=revision only, normal=+stretch,
push=+timed challenge. Deterministic mock; azure path via Foundry structured call.
"""
from app.agents.base import ClarityAgent
from app.integrations.foundry.client import foundry
from app.integrations.foundry.shims import AGENT_SYSTEM_PROMPTS
from app.schemas import PlannerInput, PlannerOutput, PlannerTask


def plan_deterministic(inp: PlannerInput) -> PlannerOutput:
    nodes = sorted(inp.mastery_snapshot, key=lambda n: n.get("effective_mastery", 1.0))
    budget = max(5, inp.time_available)
    tasks: list[PlannerTask] = []
    used = 0

    def add(task_type, node, minutes, reason, title=""):
        nonlocal used
        if used + minutes > budget:
            return
        tasks.append(PlannerTask(task_type=task_type,
                                 node_id=(node.get("id") if node else None),
                                 duration_minutes=minutes, reason=reason, title=title))
        used += minutes

    if inp.mood == "light":
        for n in nodes[:4]:
            add("revision", n, 8, "weak_spot", f"Revise {n.get('name', n.get('id', ''))}")
    elif inp.mood == "normal":
        for n in nodes[:3]:
            add("revision", n, 8, "weak_spot", f"Revise {n.get('name', n.get('id', ''))}")
        rest = [n for n in inp.mastery_snapshot if n not in nodes[:3]]
        stretch = min(rest, key=lambda n: n.get("importance", 0.5)) if rest else (nodes[-1] if nodes else None)
        if stretch:
            add("problem", stretch, 12, "company", f"Stretch: {stretch.get('name', '')}")
    else:  # push
        for n in nodes[:2]:
            add("revision", n, 8, "weak_spot", f"Revise {n.get('name', n.get('id', ''))}")
        mid = nodes[2:4] if len(nodes) > 2 else nodes
        for n in mid:
            add("problem", n, 12, "company", f"Stretch: {n.get('name', n.get('id', ''))}")
        if used + 12 <= budget:
            add("timed_challenge", nodes[-1] if nodes else None, 12, "core", "Timed challenge")
    if not tasks and nodes:
        add("revision", nodes[0], min(8, budget), "weak_spot", "Quick revision")
    return PlannerOutput(tasks=tasks)


class PlannerAgent(ClarityAgent):
    name = "planner"

    async def _execute(self, input_data: dict) -> dict:
        inp = PlannerInput(**input_data)
        if foundry.mode == "mock":
            return plan_deterministic(inp).model_dump()
        data = await foundry.complete_structured(
            "planner", AGENT_SYSTEM_PROMPTS["planner"], PlannerInput(**input_data).model_dump_json(),
            fallback=plan_deterministic(inp).model_dump())
        try:
            return PlannerOutput(**data).model_dump()
        except Exception:
            return plan_deterministic(inp).model_dump()
