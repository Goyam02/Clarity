"""Question Generator: target pattern + company anchors -> fresh problem.

All problem content is model-generated. Code only validates: schema shape,
required fields, test-case presence, expected complexity. Invalid output gets
one repair attempt; persistently invalid output raises instead of serving a
malformed problem.
"""
from app.agents.base import ClarityAgent
from app.core.config import get_settings
from app.integrations.foundry.shims import iq_retrieve
from app.schemas import GeneratedProblem

SYSTEM = """You are the CLARITY Question Generator, an expert competitive-programming
problem setter.
Given a target pattern/topic, difficulty, and optional company style anchors,
compose a FRESH problem testing that pattern — a new variant, never a copy of
a known LeetCode/Codeforces problem.

Requirements:
- title: concise, original.
- statement: complete and unambiguous, with input/output format described so
  the problem is solvable reading stdin and writing stdout.
- constraints: list of strings (e.g. "1 <= n <= 10^5").
- examples: at least 1 {input, output} pair as STRINGS in stdin/stdout form.
- test_cases: at least 2 hidden {input, output} pairs as STRINGS, covering a
  normal case and an edge case.
- difficulty: easy, medium, or hard as requested.
- expected_complexity: {"time": "O(...)", "space": "O(...)"} for the intended
  solution.
- echo back topic_id and pattern as given.
Return ONLY JSON matching the problem schema."""


def validate_problem(p: GeneratedProblem) -> list[str]:
    errors = []
    if not p.title.strip():
        errors.append("missing title")
    if len(p.statement.strip()) < 20:
        errors.append("statement too short")
    if not p.test_cases:
        errors.append("no test cases")
    if not p.expected_complexity:
        errors.append("missing expected complexity")
    return errors


class QuestionGeneratorAgent(ClarityAgent):
    name = "question_generator"
    system_prompt = SYSTEM
    output_model = GeneratedProblem

    def __init__(self, llm=None):
        super().__init__(llm)
        self.foundry_agent = get_settings().QUESTION_GENERATOR_AGENT

    async def run(self, input_data, user_id="", workflow="", db=None):
        anchors = await iq_retrieve(
            f"{input_data.get('pattern', '')} {input_data.get('company', '')}".strip()
            or "data structures algorithms")
        return await super().run({**input_data, "anchors": anchors[:3]},
                                 user_id=user_id, workflow=workflow, db=db)

    def build_prompt(self, input_data: dict) -> str:
        return ("Write a fresh interview-style problem.\n"
                f"Pattern: {input_data.get('pattern', 'general')}\n"
                f"Topic id: {input_data.get('topic_id', '')}\n"
                f"Difficulty: {input_data.get('difficulty', 'medium')}\n"
                f"Company style: {input_data.get('company', 'none')}\n"
                f"Retrieved style anchors: {input_data.get('anchors', [])}\n"
                "Return ONLY the problem JSON.")

    def post_validate(self, data: GeneratedProblem, input_data: dict) -> GeneratedProblem:
        errors = validate_problem(data)
        if errors:
            from pydantic import ValidationError as VE
            raise VE.from_exception_data(
                "GeneratedProblem",
                [{"type": "value_error", "loc": ("problem",),
                  "msg": f"validation failed: {errors}", "input": {}}])
        return data
