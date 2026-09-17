"""Interviewer (single calibrated persona) + Company Intel agents."""
import time

from app.agents.base import ClarityAgent
from app.integrations.foundry.client import foundry
from app.integrations.foundry.shims import AGENT_SYSTEM_PROMPTS, SEED_COMPANY_PROFILES

STUCK_THRESHOLD_SECONDS = 180


class InterviewerAgent(ClarityAgent):
    name = "interviewer"
    # Session short-term state is passed in per call (Redis in prod); durable
    # signals are written to Postgres/memory only at session end.

    async def _execute(self, input_data: dict) -> dict:
        phase = input_data.get("phase", "intro")
        stuck = input_data.get("seconds_since_activity", 0) >= STUCK_THRESHOLD_SECONDS
        hints = input_data.get("hints_given", 0)
        problem = input_data.get("problem_title", "the problem")
        if phase == "intro":
            utter = (f"Hi, let's work through '{problem}'. Please walk me through your "
                     "approach before you start coding — I'll stay quiet while you think.")
        elif stuck and hints < 2:
            utter = ("You've been quiet for a bit — what's the main thing you're stuck on? "
                     "Think about what a brute force would look like first.")
        elif phase == "followup":
            utter = "Good. Now what's the time complexity, and can you find an edge case that breaks it?"
        else:
            utter = "Got it — keep going, I'm following."
        if foundry.mode == "azure":
            data = await foundry.complete_structured(
                "interviewer", AGENT_SYSTEM_PROMPTS["interviewer"], str(input_data),
                fallback={"utterance": utter, "hint_given": bool(stuck and hints < 2)})
            return {"utterance": data.get("utterance", utter),
                    "hint_given": bool(data.get("hint_given", stuck and hints < 2))}
        return {"utterance": utter, "hint_given": bool(stuck and hints < 2)}


class CompanyIntelAgent(ClarityAgent):
    name = "company_intel"

    async def _execute(self, input_data: dict) -> dict:
        company = (input_data.get("company") or "").lower()
        seed = SEED_COMPANY_PROFILES.get(company, {
            "oa_patterns": ["array+hash", "two-pointers"],
            "interview_patterns": ["core CS explain-back"],
            "core_subjects": ["DBMS", "OS"],
            "difficulty": "medium",
            "round_structure": ["OA", "technical interview"],
            "sources": ["seed-curated"],
            "confidence": 0.5})
        out = {"company": input_data.get("company", ""), **seed,
               "last_verified": time.strftime("%Y-%m-%d"), "stale": False}
        if foundry.mode == "azure":
            data = await foundry.complete_structured(
                "company_intel", AGENT_SYSTEM_PROMPTS["company_intel"], str(input_data),
                fallback=out)
            return {"company": out["company"], **{k: data.get(k, v) for k, v in seed.items()},
                    "last_verified": out["last_verified"], "stale": False}
        return out
