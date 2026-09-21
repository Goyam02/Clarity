"""All SQLAlchemy models (PostgreSQL authoritative; SQLite-compatible for local/tests)."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uid() -> str:
    return uuid.uuid4().hex[:12]


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    password_hash: Mapped[str] = mapped_column(String(255), default="")
    google_sub: Mapped[str] = mapped_column(String(64), default="", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Profile(Base):
    __tablename__ = "profiles"
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), primary_key=True)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    projects: Mapped[list] = mapped_column(JSON, default=list)
    current_focus: Mapped[str] = mapped_column(Text, default="")
    placement_timeline: Mapped[str] = mapped_column(String(255), default="")
    default_mood: Mapped[str] = mapped_column(String(16), default="normal")
    codeforces_handle: Mapped[str] = mapped_column(String(64), default="")
    github_username: Mapped[str] = mapped_column(String(64), default="")
    resume_blob_ref: Mapped[str] = mapped_column(String(512), default="")
    target_companies: Mapped[list] = mapped_column(JSON, default=list)
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    # LeetCode cookie pulls (docs/plans/plan-leetcode-pulls.md). Cookies are
    # Fernet-encrypted at rest (services/secret_box.py); plaintext never stored.
    leetcode_session_encrypted: Mapped[str] = mapped_column(Text, default="")
    leetcode_csrf_encrypted: Mapped[str] = mapped_column(Text, default="")
    leetcode_username: Mapped[str] = mapped_column(String(64), default="")
    leetcode_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)
    # Last LeetCode error code (e.g. LEETCODE_AUTH_EXPIRED) — surfaces
    # "cookies expired, re-enter them" in Settings. Cleared on success.
    leetcode_last_error: Mapped[str] = mapped_column(String(64), default="")
    # Codeforces public pulls have no tokens; only last successful sync time.
    codeforces_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)


class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(32), default="DSA")  # DSA|DBMS|OS|CN|OOP|SYSTEM_DESIGN|OTHER
    description: Mapped[str] = mapped_column(Text, default="")
    importance: Mapped[float] = mapped_column(Float, default=0.5)


class MasteryNode(Base):
    __tablename__ = "mastery_nodes"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    topic_id: Mapped[str] = mapped_column(String(64), ForeignKey("topics.id"), index=True)
    pattern: Mapped[str] = mapped_column(String(128), default="")
    mastery_score: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    decay_rate: Mapped[float] = mapped_column(Float, default=0.02)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    times_attempted: Mapped[int] = mapped_column(Integer, default=0)
    times_correct: Mapped[int] = mapped_column(Integer, default=0)
    average_solve_time: Mapped[float] = mapped_column(Float, default=0.0)
    hint_count: Mapped[int] = mapped_column(Integer, default=0)
    importance_weight: Mapped[float] = mapped_column(Float, default=0.5)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class MasteryHistory(Base):
    __tablename__ = "mastery_history"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    mastery_node_id: Mapped[str] = mapped_column(String(32), ForeignKey("mastery_nodes.id"), index=True)
    previous_score: Mapped[float] = mapped_column(Float, default=0.0)
    new_score: Mapped[float] = mapped_column(Float, default=0.0)
    delta: Mapped[float] = mapped_column(Float, default=0.0)
    source_type: Mapped[str] = mapped_column(String(32), default="MANUAL_LOG")
    source_id: Mapped[str] = mapped_column(String(64), default="")
    reason: Mapped[str] = mapped_column(Text, default="")
    extra: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Problem(Base):
    __tablename__ = "problems"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    title: Mapped[str] = mapped_column(String(255))
    statement: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(String(16), default="medium")
    topic_id: Mapped[str] = mapped_column(String(64), ForeignKey("topics.id"), default="")
    pattern: Mapped[str] = mapped_column(String(128), default="")
    company_id: Mapped[str] = mapped_column(String(32), default="")
    source_type: Mapped[str] = mapped_column(String(32), default="generated")
    constraints: Mapped[list] = mapped_column(JSON, default=list)
    examples: Mapped[list] = mapped_column(JSON, default=list)
    test_cases: Mapped[list] = mapped_column(JSON, default=list)
    expected_complexity: Mapped[dict] = mapped_column(JSON, default=dict)
    validation_status: Mapped[str] = mapped_column(String(16), default="valid")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ProblemAttempt(Base):
    __tablename__ = "problem_attempts"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    problem_id: Mapped[str] = mapped_column(String(32), ForeignKey("problems.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="started")
    runtime_ms: Mapped[int] = mapped_column(Integer, default=0)
    memory_kb: Mapped[int] = mapped_column(Integer, default=0)
    hints_used: Mapped[int] = mapped_column(Integer, default=0)
    time_to_first_line: Mapped[int] = mapped_column(Integer, default=0)
    approach_signature: Mapped[str] = mapped_column(String(128), default="")


class Submission(Base):
    __tablename__ = "submissions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    attempt_id: Mapped[str] = mapped_column(String(32), ForeignKey("problem_attempts.id"), index=True)
    language: Mapped[str] = mapped_column(String(16), default="python")
    source_code: Mapped[str] = mapped_column(Text)
    compile_status: Mapped[str] = mapped_column(String(16), default="pending")
    test_results: Mapped[list] = mapped_column(JSON, default=list)
    runtime_ms: Mapped[int] = mapped_column(Integer, default=0)
    memory_kb: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Company(Base):
    __tablename__ = "companies"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    domain: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class CompanyProfile(Base):
    __tablename__ = "company_profiles"
    company_id: Mapped[str] = mapped_column(String(32), ForeignKey("companies.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String(255), default="")
    oa_patterns: Mapped[list] = mapped_column(JSON, default=list)
    interview_patterns: Mapped[list] = mapped_column(JSON, default=list)
    core_subjects: Mapped[list] = mapped_column(JSON, default=list)
    difficulty: Mapped[str] = mapped_column(String(16), default="medium")
    round_structure: Mapped[list] = mapped_column(JSON, default=list)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    last_verified: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    # Web-researched, source-cited question findings (Grounding with Bing Search),
    # persisted + TTL-gated by services/web_corpus.ensure_web_research.
    web_problems: Mapped[list] = mapped_column(JSON, default=list)
    web_interview_questions: Mapped[list] = mapped_column(JSON, default=list)
    web_researched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DailyPlan(Base):
    __tablename__ = "daily_plans"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    date: Mapped[str] = mapped_column(String(16), index=True)
    mood: Mapped[str] = mapped_column(String(16), default="normal")
    time_available: Mapped[int] = mapped_column(Integer, default=40)
    tasks: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class CodeRedSession(Base):
    __tablename__ = "code_red_sessions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    company_id: Mapped[str] = mapped_column(String(32), ForeignKey("companies.id"))
    round_type: Mapped[str] = mapped_column(String(16), default="OA")
    job_description: Mapped[str] = mapped_column(Text, default="")
    time_budget: Mapped[int] = mapped_column(Integer, default=300)
    remaining_time: Mapped[int] = mapped_column(Integer, default=300)
    status: Mapped[str] = mapped_column(String(16), default="active")
    clear_score: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class CodeRedTask(Base):
    __tablename__ = "code_red_tasks"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    session_id: Mapped[str] = mapped_column(String(32), ForeignKey("code_red_sessions.id"), index=True)
    type: Mapped[str] = mapped_column(String(32), default="problem")
    title: Mapped[str] = mapped_column(String(500), default="")
    node_id: Mapped[str] = mapped_column(String(32), default="")
    problem_id: Mapped[str] = mapped_column(String(32), default="")
    duration_minutes: Mapped[int] = mapped_column(Integer, default=15)
    reason: Mapped[str] = mapped_column(String(16), default="weak_spot")
    priority: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    detail: Mapped[dict] = mapped_column(JSON, default=dict)  # title, url, source, etc.


class MockSession(Base):
    __tablename__ = "mock_sessions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    company_id: Mapped[str] = mapped_column(String(32), default="")
    round_type: Mapped[str] = mapped_column(String(32), default="OA")
    problem_ids: Mapped[list] = mapped_column(JSON, default=list)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")


class InterviewEvent(Base):
    __tablename__ = "interview_events"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    session_id: Mapped[str] = mapped_column(String(32), ForeignKey("mock_sessions.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    event_type: Mapped[str] = mapped_column(String(32), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class Outcome(Base):
    __tablename__ = "outcomes"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    company_id: Mapped[str] = mapped_column(String(32), default="")
    role: Mapped[str] = mapped_column(String(255), default="")
    round: Mapped[str] = mapped_column(String(64), default="")
    result: Mapped[str] = mapped_column(String(32), default="")
    clear_score_at_time: Mapped[int] = mapped_column(Integer, default=0)
    mastery_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AgentRun(Base):
    __tablename__ = "agent_runs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    agent_name: Mapped[str] = mapped_column(String(64), index=True)
    workflow_name: Mapped[str] = mapped_column(String(64), default="")
    user_id: Mapped[str] = mapped_column(String(32), default="", index=True)
    input_summary: Mapped[dict] = mapped_column(JSON, default=dict)
    output_summary: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="ok")
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str] = mapped_column(Text, default="")
    trace_id: Mapped[str] = mapped_column(String(32), default="", index=True)
    parent_run_id: Mapped[str] = mapped_column(String(32), default="")
    handoffs: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class CalibrationRun(Base):
    __tablename__ = "calibration_runs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="active")
    current_index: Mapped[int] = mapped_column(Integer, default=0)
    current_difficulty: Mapped[int] = mapped_column(Integer, default=2)  # 1..5
    questions: Mapped[list] = mapped_column(JSON, default=list)
    answers: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class WeeklyMock(Base):
    __tablename__ = "weekly_mocks"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16), default="OA")  # OA | Interview
    week_start: Mapped[str] = mapped_column(String(10), index=True)  # ISO date of Monday
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    status: Mapped[str] = mapped_column(String(16), default="scheduled")  # scheduled|skipped|completed|rescheduled
    session_id: Mapped[str] = mapped_column(String(32), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class PlatformSignal(Base):
    """One pulled fact from an external coding platform (LeetCode/Codeforces/
    GitHub). Source of truth feeding the Mastery Model — every row is a real,
    timestamped observation, never self-report."""
    __tablename__ = "platform_signals"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    platform: Mapped[str] = mapped_column(String(16), index=True)  # leetcode|codeforces|github
    signal_type: Mapped[str] = mapped_column(String(32))  # solved_count|topic_solved|difficulty_split|recent_ac|rating|profile
    topic_id: Mapped[str] = mapped_column(String(64), default="", index=True)  # topics.id when applicable
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class MasteryEdge(Base):
    """Knowledge-graph edges (spec §5): curated prerequisites (global, user_id="")
    plus per-user correlation edges computed from co-movement in mastery history."""
    __tablename__ = "mastery_edges"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(String(32), default="", index=True)
    src_topic_id: Mapped[str] = mapped_column(String(64), index=True)
    dst_topic_id: Mapped[str] = mapped_column(String(64), index=True)
    kind: Mapped[str] = mapped_column(String(16))  # prerequisite|correlation
    weight: Mapped[float] = mapped_column(Float, default=0.5)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
