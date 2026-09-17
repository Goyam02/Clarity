"""Planner agent: mastery snapshot + mood + time -> task list.

The task content comes from the model. Code only enforces constraints:
total time stays within budget, and LIGHT mood drops anything that is not
revision. These are request-time constraints, not canned content.
"""
from app.agents.base import ClarityAgent
from app.core.config import get_settings
from app.schemas import PlannerInput, PlannerOutput

SYSTEM = """You are the CLARITY Planner, an expert interview-prep coach.
Given a student's mastery snapshot (lower effective_mastery = weaker),
a mood, and a time budget in minutes, produce a study plan.

Rules:
- Prioritize the weakest nodes (lowest effective_mastery first).
- Respect the mood strictly:
  - light: revision tasks ONLY, no new problems or challenges.
  - normal: revision of weak spots plus ONE stretch problem on an important node.
  - push: revision plus stretch problem(s) plus one timed_challenge.
- task_type is one of: revision, problem, explain_back, timed_challenge.
- reason is one of: weak_spot (student is weak here), company (matches target
  company patterns), core (core CS subject revision).
- Keep duration_minutes realistic (revision 5-12, problem 10-20,
  timed_challenge 10-20). Total may slightly exceed the budget; it is clamped.
- node_id must be an id from the mastery snapshot, or a company pattern name.
- Every task needs a short human-readable title.
Return ONLY JSON matching the plan schema."""


def enforce_budget(tasks: list, budget: int) -> list:
    """Scale durations proportionally; drop tail tasks if the plan still
    exceeds the budget after per-task minimums."""
    total = sum(t.duration_minutes for t in tasks)
    if total > budget and tasks:
        factor = budget / total
        for t in tasks:
            t.duration_minutes = max(5, int(t.duration_minutes * factor))
    while sum(t.duration_minutes for t in tasks) > budget and len(tasks) > 1:
        tasks.pop()
    if tasks and sum(t.duration_minutes for t in tasks) > budget:
        tasks[0].duration_minutes = budget
    return tasks


class PlannerAgent(ClarityAgent):
    name = "planner"
    system_prompt = SYSTEM
    output_model = PlannerOutput

    def __init__(self, llm=None):
        super().__init__(llm)
        self.foundry_agent = get_settings().PLANNER_AGENT

    def build_prompt(self, input_data: dict) -> str:
        inp = PlannerInput(**input_data)
        return ("Plan a study session.\n"
                f"Mood: {inp.mood}\n"
                f"Time available (minutes): {inp.time_available}\n"
                f"Target company: {inp.company or 'none'}\n"
                f"Job description: {inp.job_description[:1000] or 'none'}\n"
                f"Mastery snapshot (id, name, category, effective_mastery 0-1, "
                f"importance 0-1): {inp.mastery_snapshot}\n"
                f"Recent activity: {inp.recent_activity}\n"
                "Return ONLY JSON: "
                '{"tasks": [{"task_type": ..., "node_id": ..., "duration_minutes": ..., '
                '"reason": ..., "title": ...}]}')

    def post_validate(self, data: PlannerOutput, input_data: dict) -> PlannerOutput:
        inp = PlannerInput(**input_data)
        tasks = data.tasks
        if inp.mood == "light":
            tasks = [t for t in tasks if t.task_type == "revision"]
        tasks = enforce_budget(tasks, max(5, inp.time_available))
        return PlannerOutput(tasks=tasks)
