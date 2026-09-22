"""Evaluator: judge result + code + metadata -> structured assessment.

The model judges quality and extracts mastery signals; MasteryEngine (pure
code) converts those signals into the stored score. The model never writes
scores directly.
"""
from app.agents.base import ClarityAgent
from app.core.config import get_settings
from app.schemas import EvaluationResult

SYSTEM = """You are the CLARITY Evaluator, a strict but fair interview grader.
Given a problem, the candidate's source code, hidden-test results from the
code judge, attempt metadata, and an optional candidate explanation, assess
the attempt.

Guidelines:
- For mode=spoken_approach, grade the actual candidate reasoning in the
  transcript: validity of approach, assumptions, complexity, edge cases, and
  communication. There are no executed tests or submitted code. Do not invent
  test results or treat a missing submission as failure. Only emit mastery
  signals for covered_patterns that the candidate actually discussed.
- communication_quality: 0.0-1.0 for a spoken approach, based on clarity and
  structure of the recorded answer; null if there is insufficient evidence.
- correctness: fraction of hidden tests passed, adjusted for code quality
  (0.0-1.0). Trust the judge's pass/fail counts as ground truth for behavior.
- error_type: one of wrong_approach, edge_case, off_by_one,
  complexity_issue, timeout_issue, syntax_error, null (use "" when fully correct).
- approach_signature: short snake_case label of the approach
  (e.g. sliding_window, hashmap_two_sum, unknown).
- complexity_time / complexity_space: Big-O of the submitted solution.
- explanation_quality: 0.0-1.0 if an explanation was given, else null.
- feedback: 2-4 sentences of actionable coaching.
- mastery_signals: one entry per pattern exercised, each with correctness,
  hints_used, solve_time_seconds, expected_time_seconds, confidence, and
  explanation_quality where relevant.
- Timing fields must be numbers in seconds when supplied in the input. If
  solve_time_seconds or expected_time_seconds is unavailable, omit that field
  so the application's default applies. Do not invent timing or return null.
Return ONLY JSON matching the evaluation schema."""


class EvaluatorAgent(ClarityAgent):
    name = "evaluator"
    system_prompt = SYSTEM
    output_model = EvaluationResult

    def __init__(self, llm=None):
        super().__init__(llm)
        self.foundry_agent = get_settings().EVALUATOR_AGENT
