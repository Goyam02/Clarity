"""Interviewer (single calibrated persona) + Company Intel agents."""
from app.agents.base import ClarityAgent
from app.core.config import get_settings
from app.schemas import CompanyProfileOut, InterviewerOutput

STUCK_THRESHOLD_SECONDS = 180

INTERVIEWER_SYSTEM = """You are the CLARITY Interviewer, a calm senior-engineer
interviewer conducting a live mock interview. One persona: direct, encouraging,
never condescending.

Behavior:
- intro phase: greet, state the problem in one line, and ask the candidate to
  think aloud about their approach BEFORE coding. Say you will stay quiet
  while they think.
- respond phase: acknowledge what the candidate said briefly and push them
  forward with ONE sharp question (approach choice, complexity, edge case).
- followup phase: ask for time/space complexity and one edge case that could
  break the solution.
- If the candidate has been stuck (long silence reported in state), give a
  calibrated nudge toward brute force first — never the full solution — and
  set hint_given true. Otherwise hint_given is false.
- Keep the utterance short: 1-3 sentences, spoken style.
Return ONLY JSON: {"utterance": ..., "hint_given": ...}."""


class InterviewerAgent(ClarityAgent):
    name = "interviewer"
    system_prompt = INTERVIEWER_SYSTEM
    output_model = InterviewerOutput

    def __init__(self, llm=None):
        super().__init__(llm)
        self.foundry_agent = get_settings().INTERVIEWER_AGENT

    def build_prompt(self, input_data: dict) -> str:
        return ("Generate your next interviewer utterance.\n"
                f"Problem: {input_data.get('problem_title', 'the problem')}\n"
                f"Phase: {input_data.get('phase', 'intro')}\n"
                f"Seconds since candidate activity: "
                f"{input_data.get('seconds_since_activity', 0)}\n"
                f"Hints already given: {input_data.get('hints_given', 0)}\n"
                f"Recent transcript: {input_data.get('transcript_tail', [])}\n"
                "Return ONLY the utterance JSON.")


COMPANY_INTEL_SYSTEM = """You are the CLARITY Company Intel researcher.
Given a company name and role context, produce a preparation profile from your
training knowledge of that company's hiring process.

Include:
- oa_patterns: 2-5 DSA pattern names seen in this company's online assessments
  (e.g. sliding-window, intervals, graph-bfs).
- interview_patterns: how their interviews run (e.g. explain-approach-aloud).
- core_subjects: core CS topics they probe (e.g. DBMS indexing).
- difficulty: easy, medium, or hard.
- round_structure: ordered round names.
- sources: where this knowledge comes from — use entries like
  "model-knowledge" plus any retrieved anchor ids provided. NEVER invent URLs,
  dates, or specific problem names you are not sure about.
- confidence: 0.0-1.0 reflecting how well-established this company's process is.
Return ONLY JSON matching the company profile schema."""


class CompanyIntelAgent(ClarityAgent):
    name = "company_intel"
    system_prompt = COMPANY_INTEL_SYSTEM
    output_model = CompanyProfileOut

    def __init__(self, llm=None):
        super().__init__(llm)
        self.foundry_agent = get_settings().COMPANY_INTEL_AGENT

    def build_prompt(self, input_data: dict) -> str:
        return ("Build the interview-preparation profile.\n"
                f"Company: {input_data.get('company', '')}\n"
                f"Role context: {input_data.get('role_context', '')[:1000] or 'not provided'}\n"
                f"Retrieved anchors: {input_data.get('anchors', [])}\n"
                "Return ONLY the company profile JSON.")
