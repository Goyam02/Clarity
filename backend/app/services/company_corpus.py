"""Per-company problem-frequency corpus (data/company-corpus/companies/*.csv).

Spec: checklist items tagged [company] are "known standard question for this
company, self-curated", and node importance is "weighted by frequency in the
student's target companies' OAs". This loader serves that seed data locally —
no Azure dependency. Azure AI Search (Foundry IQ) remains the primary anchor
store when configured; this corpus is the deterministic local store.

CSV columns: ID,URL,Title,Difficulty,Acceptance %,Frequency %,Topics,Timeframe
"""
import csv
import os
import re
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

# LeetCode topic tag -> internal pattern/topic id (best-effort mapping).
TOPIC_MAP = {
    "sliding window": "sliding-window",
    "two pointers": "two-pointers",
    "union find": "dsu",
    "depth-first search": "graphs-bfs",
    "breadth-first search": "graphs-bfs",
    "graph theory": "graphs-bfs",
    "dynamic programming": "dp-knapsack",
    "hash table": "array-hash",
    "hashmap": "array-hash",
    "stack": "stack",
    "monotonic stack": "stack",
    "queue": "stack",
    "heap (priority queue)": "heap",
    "binary search": "binary-search",
    "linked list": "linked-list",
    "tree": "graphs-bfs",
    "binary tree": "graphs-bfs",
    "matrix": "graphs-bfs",
    "greedy": "greedy",
    "backtracking": "backtracking",
    "sorting": "sorting",
    "string": "strings",
    "math": "math",
    "design": "design",
}

# Coarse topic id -> DBMS/OS/CN/OOP core-subject buckets for importance weights.
_CORE_HINTS = {"dbms": "DBMS", "sql": "DBMS", "os": "OS", "network": "CN",
               "oop": "OOP"}


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _map_topics(raw: str) -> list[str]:
    out = []
    for tag in (t.strip() for t in (raw or "").split(",")):
        mapped = TOPIC_MAP.get(tag.lower())
        if mapped and mapped not in out:
            out.append(mapped)
    return out or ["array-hash"]


@lru_cache(maxsize=512)
def _corpus_base() -> Path | None:
    """Corpus dir: configured path first, then repo-root fallback (tests/IDEs
    run from the repo root, uvicorn runs from backend/)."""
    settings = get_settings()
    base = Path(settings.COMPANY_CORPUS_DIR)
    if base.exists():
        return base
    repo_root = Path(__file__).resolve().parents[3]
    alt = repo_root / "data" / "company-corpus" / "companies"
    return alt if alt.exists() else None


@lru_cache(maxsize=512)
def _load_company(slug: str) -> tuple | None:
    """(problems, patterns, importance) for one company slug, or None."""
    base = _corpus_base()
    if base is None:
        return None
    path = base / f"{slug}.csv"
    if not path.exists():
        return None
    problems: list[dict] = []
    pattern_weight: dict[str, float] = {}
    try:
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                try:
                    freq = float(str(row.get("Frequency %", "0")).rstrip("%") or 0) / 100.0
                except ValueError:
                    freq = 0.0
                topics = _map_topics(row.get("Topics", ""))
                problems.append({
                    "title": row.get("Title", ""),
                    "url": row.get("URL", ""),
                    "difficulty": (row.get("Difficulty") or "medium").lower(),
                    "frequency": round(freq, 4),
                    "patterns": topics,
                })
                for p in topics:
                    pattern_weight[p] = max(pattern_weight.get(p, 0.0), freq)
    except Exception as e:  # malformed row / unreadable file -> skip company
        log.info(f"company corpus parse failed for {slug}: {e}")
        return None
    if not problems:
        return None
    patterns = sorted(pattern_weight, key=pattern_weight.get, reverse=True)[:8]
    importance = {p: round(min(1.0, w * 2), 4) for p, w in pattern_weight.items()}
    return problems, patterns, importance


def company_anchor_patterns(company: str) -> list[str]:
    """Top patterns for a company by problem frequency ([] when unknown)."""
    hit = _load_company(_slugify(company or ""))
    return list(hit[1]) if hit else []


def company_anchor_problems(company: str, patterns: list[str] | None = None,
                            limit: int = 10) -> list[dict]:
    """Highest-frequency problems, optionally filtered to given patterns."""
    hit = _load_company(_slugify(company or ""))
    if not hit:
        return []
    problems = hit[0]
    if patterns:
        wanted = set(patterns)
        problems = [p for p in problems if wanted & set(p["patterns"])]
    return sorted(problems, key=lambda p: -p["frequency"])[:limit]


def company_importance(company: str) -> dict[str, float]:
    """Pattern -> importance weight (0..1) from this company's OA frequency."""
    hit = _load_company(_slugify(company or ""))
    return dict(hit[2]) if hit else {}


def known_company(slug: str) -> bool:
    return _load_company(_slugify(slug or "")) is not None


def boost_importance(base_importance: float, target_companies: list[str],
                      topic_id: str) -> float:
    """Spec: node size = importance weighted by frequency in target companies' OAs."""
    if not target_companies:
        return base_importance
    best = base_importance
    for c in target_companies:
        hit = _load_company(_slugify(c))
        if hit:
            best = max(best, hit[2].get(topic_id, 0.0))
    return round(min(1.0, best), 4)


def core_subjects_from_jd(jd: str) -> list[str]:
    """Detect core-CS emphasis in a job description (spec §6 step 1)."""
    text = (jd or "").lower()
    found = []
    for hint, bucket in _CORE_HINTS.items():
        if hint in text and bucket not in found:
            found.append(bucket)
    return found
