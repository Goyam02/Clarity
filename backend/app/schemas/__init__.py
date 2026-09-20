"""Pydantic v2 request/response schemas (structured agent I/O + API contracts)."""
from typing import Literal
from pydantic import BaseModel, Field

Mood = Literal["light", "normal", "push"]


class PlannerTask(BaseModel):
    task_type: str
    node_id: str = ""
    problem_id: str = ""
    duration_minutes: int = 15
    reason: Literal["weak_spot", "company", "core"] = "weak_spot"
    title: str = ""


class PlannerInput(BaseModel):
    mastery_snapshot: list[dict] = Field(default_factory=list)
    mood: Mood = "normal"
    time_available: int = 40
    company: str | None = None
    job_description: str = ""
    recent_activity: list[dict] = Field(default_factory=list)


class PlannerOutput(BaseModel):
    tasks: list[PlannerTask]


class EvaluationMasterySignal(BaseModel):
    node_id: str = ""
    pattern: str = ""
    correctness: float = 0.0
    hints_used: int = 0
    solve_time_seconds: float = 600
    expected_time_seconds: float = 600
    confidence: float = 0.85
    explanation_quality: float | None = None


class EvaluationResult(BaseModel):
    correctness: float
    error_type: str | None = None
    approach_signature: str = ""
    complexity_time: str = ""
    complexity_space: str = ""
    explanation_quality: float | None = None
    communication_quality: float | None = None
    feedback: str = ""
    mastery_signals: list[EvaluationMasterySignal] = Field(default_factory=list)


class GeneratedProblem(BaseModel):
    title: str
    statement: str
    constraints: list[str] = Field(default_factory=list)
    examples: list[dict] = Field(default_factory=list)
    test_cases: list[dict] = Field(default_factory=list)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    topic_id: str = ""
    pattern: str = ""
    expected_complexity: dict = Field(default_factory=dict)


class CompanyProfileOut(BaseModel):
    company: str
    role: str = ""
    oa_patterns: list[str] = Field(default_factory=list)
    interview_patterns: list[str] = Field(default_factory=list)
    core_subjects: list[str] = Field(default_factory=list)
    difficulty: str = "medium"
    round_structure: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    last_verified: str = ""
    confidence: float = 0.5
    stale: bool = False


class DailyPlanRequest(BaseModel):
    mood: Mood = "normal"
    time_available: int = 40


class CodeRedRequest(BaseModel):
    company: str
    job_description: str = ""
    time_available_minutes: int = 300
    round_type: Literal["OA", "Interview"] = "OA"


class InterviewEventIn(BaseModel):
    event_type: str
    payload: dict = Field(default_factory=dict)


class OutcomeIn(BaseModel):
    company: str = ""
    role: str = ""
    round: str = ""
    result: str = ""
    notes: str = ""
    clear_score_at_time: int | None = None


class InterviewerOutput(BaseModel):
    utterance: str
    hint_given: bool = False


# --- Phase 1 additions (settings, daily, code-red v2, weekly) ------------

class ProfilePatch(BaseModel):
    name: str | None = None
    current_focus: str | None = None
    placement_timeline: str | None = None
    default_mood: Mood | None = None
    codeforces_handle: str | None = None
    github_username: str | None = None


class CompanyAddIn(BaseModel):
    name: str


class PlanTaskStatusIn(BaseModel):
    task_index: int
    status: Literal["pending", "done", "skipped"]


class DailyLogIn(BaseModel):
    topic_id: str = ""
    title: str = ""
    link: str = ""
    notes: str = ""
    correctness: float = 0.5
    minutes_spent: int = 20


class CodeforcesConfirmIn(BaseModel):
    handle: str
    submissions: list[dict] = Field(default_factory=list)  # [{id, problem, tags, topic_id?}]


class ConceptGradeIn(BaseModel):
    topic_id: str
    concept: str
    explanation: str


class CodeRedTaskStatusIn(BaseModel):
    status: Literal["pending", "done", "skipped"]


class MockEventIn(BaseModel):
    event_type: str
    payload: dict = Field(default_factory=dict)


class WeeklyRescheduleIn(BaseModel):
    scheduled_for: str  # ISO datetime
