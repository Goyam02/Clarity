"""LeetCode → internal topic mapping.

LeetCode exposes topic tags (slug-style, e.g. "sliding-window") that closely
match our `topics.id` seeds; a small alias table covers the rest. Unknown tags
are kept as slugs so new topics still land as signals (they create nodes only
if a matching topic exists — see ingest).

Also used for Codeforces tag names (space-separated → slugged the same way).
"""

# LeetCode tag slug -> clarity topic id (identity matches need no entry).
ALIASES: dict[str, str] = {
    "array": "two-pointers",
    "hash-table": "sql-joins",          # closest seed: key-value lookup family
    "string": "oop",                    # no string seed; keep signal under OOP basics
    "dynamic-programming": "dp-knapsack",
    "graph": "graphs-bfs",
    "breadth-first-search": "graphs-bfs",
    "depth-first-search": "graphs-bfs",
    "union-find": "dsu",
    "tree": "graphs-bfs",
    "binary-search": "two-pointers",
    "stack": "oop",
    "queue": "oop",
    "database": "sql-joins",
    "sql": "sql-joins",
    "design": "oop",
    "greedy": "sliding-window",
    "heap-priority-queue": "graphs-bfs",
    "backtracking": "graphs-bfs",
    "memoization": "dp-knapsack",
    "prefix-sum": "sliding-window",
    "two-pointers": "two-pointers",
    "sliding-window": "sliding-window",
    "disjoint-set-union": "dsu",
}


def topic_id_for_lc_slug(slug: str) -> str:
    """Map a LeetCode tag slug to a clarity topic id (identity fallback)."""
    s = (slug or "").strip().lower()
    return ALIASES.get(s, s)


def topic_id_for_cf_tag(tag: str) -> str:
    """Map a Codeforces tag ("dp", "data structures", "two pointers") to a
    clarity topic id."""
    slug = (tag or "").strip().lower().replace(" ", "-")
    cf_aliases = {
        "dp": "dp-knapsack",
        "data-structures": "two-pointers",
        "graphs": "graphs-bfs",
        "dfs-and-similar": "graphs-bfs",
        "trees": "graphs-bfs",
        "dsu": "dsu",
        "binary-search": "two-pointers",
        "greedy": "sliding-window",
        "two-pointers": "two-pointers",
        "strings": "oop",
        "math": "oop",
        "implementation": "oop",
    }
    return cf_aliases.get(slug, slug)
