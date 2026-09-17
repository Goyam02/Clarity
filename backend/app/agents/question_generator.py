"""Question Generator: target node + company anchors -> validated problem."""
from app.agents.base import ClarityAgent
from app.integrations.foundry.client import foundry
from app.integrations.foundry.shims import AGENT_SYSTEM_PROMPTS, iq_retrieve
from app.schemas import GeneratedProblem

BANK = {
    "sliding-window": ("Longest Substring Without Repeating Characters (Variant)",
                       "Given a string s and integer k, find the length of the longest substring with at most k distinct characters.",
                       ["1 <= len(s) <= 10^5"], [{"input": "s=eccba,k=2", "output": "4"}],
                       [{"input": "eceba\n2", "output": "3"}, {"input": "aa\n1", "output": "2"}]),
    "two-pointers": ("Pair Sum Sorted (Variant)",
                     "Given a sorted array nums and target t, return 1-indexed indices of two numbers summing to t.",
                     ["2 <= n <= 10^5"], [{"input": "nums=[2,7,11,15],t=9", "output": "[1,2]"}],
                     [{"input": "2 7 11 15\n9", "output": "1 2"}]),
    "dsu": ("Merge Communities (Variant)",
            "Given n people and friendship pairs, output the size of the largest community after all unions.",
            ["1 <= n <= 10^5"], [{"input": "n=4,pairs=[[0,1],[2,3]]", "output": "2"}],
            [{"input": "4\n0 1\n2 3", "output": "2"}]),
}


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


def mock_generate(pattern: str, topic_id: str, difficulty: str, company: str = "") -> GeneratedProblem:
    key = (pattern or "").lower()
    title, stmt, cons, ex, tc = BANK.get(key, (
        f"{pattern or 'DSA'} Practice: Fresh Variant",
        f"Solve a fresh variant targeting the '{pattern or 'general'}' pattern. Read input from stdin, write the answer to stdout.",
        ["Constraints per statement"], [{"input": "sample", "output": "sample"}],
        [{"input": "1", "output": "1"}, {"input": "2", "output": "2"}]))
    suffix = f" (in the style of {company})" if company else ""
    return GeneratedProblem(title=title + suffix, statement=stmt, constraints=cons,
                            examples=ex, test_cases=tc, difficulty=difficulty,
                            topic_id=topic_id, pattern=pattern or "general",
                            expected_complexity={"time": "O(n)", "space": "O(1)"})


class QuestionGeneratorAgent(ClarityAgent):
    name = "question_generator"

    async def _execute(self, input_data: dict) -> dict:
        pattern = input_data.get("pattern", "")
        topic_id = input_data.get("topic_id", "")
        difficulty = input_data.get("difficulty", "medium")
        company = input_data.get("company", "")
        anchors = await iq_retrieve(f"{pattern} {company}".strip() or "dsa")
        if foundry.mode == "mock":
            p = mock_generate(pattern, topic_id, difficulty, company)
        else:
            data = await foundry.complete_structured(
                "question_generator", AGENT_SYSTEM_PROMPTS["question_generator"] +
                f" Retrieval anchors: {anchors[:2]}", str(input_data),
                fallback=mock_generate(pattern, topic_id, difficulty, company).model_dump())
            try:
                p = GeneratedProblem(**data)
            except Exception:
                p = mock_generate(pattern, topic_id, difficulty, company)
        errors = validate_problem(p)
        if errors:
            p = mock_generate(pattern, topic_id, difficulty, company)
            errors = []
        out = p.model_dump()
        out["validation"] = {"valid": not errors, "errors": errors, "anchors_used": len(anchors)}
        return out
