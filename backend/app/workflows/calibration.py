"""Calibration: 8-12 adaptive questions; difficulty follows last result."""
from app.agents.question_generator import mock_generate
from app.models import CalibrationRun
from app.services.mastery_engine import MasteryEngine

MAX_QUESTIONS = 10
TOPICS = ["sliding-window", "two-pointers", "dsu", "dbms-indexing", "os-paging",
          "oop", "cn", "graphs-bfs", "dp-knapsack", "sql-joins"]


def start_run(user_id: str) -> CalibrationRun:
    return CalibrationRun(user_id=user_id, status="active", current_index=0,
                          current_difficulty=2, questions=[], answers=[])


def next_question(run: CalibrationRun) -> dict:
    idx = run.current_index
    topic = TOPICS[idx % len(TOPICS)]
    diff = ["easy", "easy", "medium", "medium-hard", "hard"][min(4, max(0, run.current_difficulty - 1))]
    p = mock_generate(topic, topic, "medium" if diff in ("medium", "medium-hard") else diff)
    q = {"index": idx, "topic": topic, "difficulty": run.current_difficulty,
         "title": p.title, "statement": p.statement,
         "test_cases": p.test_cases, "expected_time": 600}
    qs = list(run.questions or [])
    qs.append(q)
    run.questions = qs
    return q


def answer(run: CalibrationRun, correct: bool, solve_time: float = 600) -> dict:
    ans = list(run.answers or [])
    ans.append({"index": run.current_index, "correct": correct, "solve_time": solve_time})
    run.answers = ans
    # Adaptive: correct -> harder, wrong -> easier (clamped 1..5).
    run.current_difficulty = min(5, max(1, run.current_difficulty + (1 if correct else -1)))
    run.current_index = run.current_index + 1
    done = run.current_index >= MAX_QUESTIONS
    if done:
        run.status = "completed"
    return {"done": done, "next_difficulty": run.current_difficulty}


def summarize(run: CalibrationRun) -> dict:
    """Per-topic signals -> caller persists via MasteryEngine."""
    signals = []
    for a, q in zip(run.answers or [], run.questions or []):
        r = MasteryEngine.update(0.5, 1.0 if a["correct"] else 0.0,
                                 a.get("solve_time", 600), 600, 0, 0.6)
        signals.append({"pattern": q.get("topic", ""), "correct": a["correct"],
                        "implied_mastery": r.new_score})
    return {"signals": signals, "total": len(signals)}
