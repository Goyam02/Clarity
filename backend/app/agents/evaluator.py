"""Evaluator: judge result + code + metadata -> structured EvaluationResult."""
from app.agents.base import ClarityAgent
from app.integrations.foundry.client import foundry
from app.integrations.foundry.shims import AGENT_SYSTEM_PROMPTS
from app.schemas import EvaluationResult


def mock_evaluate(judge: dict, hints_used: int = 0, pattern: str = "",
                  explanation: str = "") -> EvaluationResult:
    total = judge.get("total", 0) or 0
    passed = judge.get("passed", 0) or 0
    correctness = round(passed / total, 3) if total else 0.0
    err = None
    if correctness < 1.0:
        err = "edge_case" if correctness >= 0.5 else "wrong_approach"
    return EvaluationResult(
        correctness=correctness, error_type=err, approach_signature=pattern or "unknown",
        complexity_time="O(n)", complexity_space="O(1)",
        explanation_quality=0.7 if explanation else None,
        feedback=(f"Passed {passed}/{total} hidden tests."
                  if total else "No test results available."),
        mastery_signals=[{
            "pattern": pattern or "general", "correctness": correctness,
            "hints_used": hints_used, "solve_time_seconds": judge.get("runtime_ms", 0) / 1000.0 or 600,
            "expected_time_seconds": 600, "confidence": 0.85,
            "explanation_quality": 0.7 if explanation else None}])


class EvaluatorAgent(ClarityAgent):
    name = "evaluator"

    async def _execute(self, input_data: dict) -> dict:
        judge = input_data.get("judge_result", {})
        if foundry.mode == "mock":
            return mock_evaluate(judge, input_data.get("hints_used", 0),
                                 input_data.get("pattern", ""),
                                 input_data.get("explanation", "")).model_dump()
        data = await foundry.complete_structured(
            "evaluator", AGENT_SYSTEM_PROMPTS["evaluator"], str(input_data),
            fallback=mock_evaluate(judge, input_data.get("hints_used", 0),
                                   input_data.get("pattern", "")).model_dump())
        try:
            return EvaluationResult(**data).model_dump()
        except Exception:
            return mock_evaluate(judge).model_dump()
