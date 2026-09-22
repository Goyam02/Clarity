"""Real practice links from the company corpus, with small curated topic sets."""
from urllib.parse import urlparse

from app.services.company_corpus import company_anchor_problems

# Core-CS entries are related implementation exercises, not claims that
# LeetCode tests OS/networking theory. The UI labels these as applications.
CURATED = {
    "sliding-window": [("Longest Substring Without Repeating Characters", "longest-substring-without-repeating-characters", "Medium"),
                       ("Minimum Size Subarray Sum", "minimum-size-subarray-sum", "Medium")],
    "two-pointers": [("Valid Palindrome", "valid-palindrome", "Easy"),
                     ("3Sum", "3sum", "Medium")],
    "dsu": [("Redundant Connection", "redundant-connection", "Medium"),
            ("Accounts Merge", "accounts-merge", "Medium")],
    "graphs-bfs": [("Number of Islands", "number-of-islands", "Medium"),
                   ("Rotting Oranges", "rotting-oranges", "Medium")],
    "dp-knapsack": [("Partition Equal Subset Sum", "partition-equal-subset-sum", "Medium"),
                    ("Target Sum", "target-sum", "Medium")],
    "sql-joins": [("Combine Two Tables", "combine-two-tables", "Easy"),
                  ("Customers Who Never Order", "customers-who-never-order", "Easy")],
    "dbms-indexing": [("Rank Scores", "rank-scores", "Medium"),
                      ("Department Top Three Salaries", "department-top-three-salaries", "Hard")],
    "os-paging": [("LRU Cache", "lru-cache", "Medium"), ("LFU Cache", "lfu-cache", "Hard")],
    "oop": [("Design Parking System", "design-parking-system", "Easy"),
            ("Design HashMap", "design-hashmap", "Easy")],
    "cn": [("Validate IP Address", "validate-ip-address", "Medium"),
           ("Network Delay Time", "network-delay-time", "Medium")],
}

CONCEPTS = {
    "dbms-indexing": "Explain B-tree indexes, composite-index ordering, and when a query planner chooses a table scan. These SQL exercises complement the theory.",
    "os-paging": "Explain virtual memory, page faults, and replacement policies. Cache exercises below practice related eviction strategies.",
    "oop": "Explain encapsulation, interfaces, composition, and inheritance. Use the design exercises to put those ideas into practice.",
    "cn": "Explain DNS, TCP versus UDP, and what happens when you open a URL. These exercises apply related addressing and graph concepts.",
}


def practice_problems(topic_id: str, company: str = "", limit: int = 8) -> list[dict]:
    candidates = [{**p, "source": "company_corpus"} for p in
                  company_anchor_problems(company, [topic_id], limit=limit)]
    candidates += [{"title": title, "url": f"https://leetcode.com/problems/{slug}/",
                    "difficulty": difficulty, "source": "curated", "patterns": [topic_id]}
                   for title, slug, difficulty in CURATED.get(topic_id, [])]
    out, seen = [], set()
    for p in candidates:
        url = urlparse(p.get("url", ""))
        if url.scheme != "https" or url.hostname not in {"leetcode.com", "www.leetcode.com"}:
            continue
        if not url.path.startswith("/problems/"):
            continue
        canonical = f"https://leetcode.com{url.path.rstrip('/')}/"
        if canonical in seen:
            continue
        seen.add(canonical)
        out.append({"title": p["title"], "url": canonical,
                    "difficulty": p["difficulty"].capitalize(), "source": p["source"],
                    "topic_id": topic_id})
        if len(out) >= limit:
            break
    return out
