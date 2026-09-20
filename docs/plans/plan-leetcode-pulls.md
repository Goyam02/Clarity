# Plan — LeetCode Cookie Pulls, Persistence & Graph Building

> **Spec deviation note:** spec §13 explicitly cut LeetCode cookie collection
> ("equivalent to a phishing pattern"). This plan reintroduces it as an
> **explicit, user-initiated, user-owned** integration: the user pastes their
> own cookies into their own dashboard, tokens are encrypted at rest, never
> logged, never proxied to third parties, and can be wiped in one tap. It is
> the user instrumenting themselves, not us harvesting accounts. Decision
> recorded here; the spec's §3 security language should be updated to match.

## Goal

1. Onboarding/screen-4 gets two new fields: **LEETCODE_SESSION cookie** and
   **csrftoken cookie** (exactly the two tokens LeetCode's authenticated
   GraphQL endpoint requires; `Codeforces` handle already exists and stays
   as-is since it needs no auth).
2. A backend route pulls everything (profile stats + recent AC submissions
   with problem topics) using those tokens, **persists the profile into the
   DB**, and feeds the Mastery Model so graph building uses real ground truth.
3. Complete the graph building logic: nodes (seed + signal-updated) and edges
   (static prerequisites + dynamic correlations) — spec §5.

## How LeetCode auth works (researched Sep 2026)

- Endpoint: `POST https://leetcode.com/graphql` (JSON body, no SDK needed).
- Required headers for authenticated queries:
  - `Cookie: LEETCODE_SESSION=<value>; csrftoken=<value>`
  - `X-CSRFToken: <csrftoken value>`
  - `Referer: https://leetcode.com` (required or 403), `Content-Type: application/json`.
- Public (no-cookie) queries work for basic profile; **recent AC submission
  list** needs the session cookie. Two cookies = full access. Anything else
  (e.g. `X-Requested-With`) is optional.
- Session cookies expire (weeks–months). Plan handles 401-expiry explicitly.

## Backend changes

### 1. Config (`app/core/config.py`)

```
LEETCODE_GRAPHQL_URL: str = "https://leetcode.com/graphql"
LEETCODE_REQUEST_TIMEOUT: int = 20
```

No key material in config — tokens are per-user, stored encrypted.

### 2. Models (`app/models/__init__.py` + migration `0003_leetcode.py`)

```
Profile (extend):
    leetcode_session_encrypted: Text, default ""     # Fernet-encrypted
    leetcode_csrf_encrypted:    Text, default ""     # Fernet-encrypted
    leetcode_username:          String(64), default ""
    leetcode_synced_at:         DateTime, nullable   # last successful pull

PlatformSignal (new table) — one row per pulled fact, source of truth for graph:
    id, user_id (idx), platform ("leetcode"|"codeforces"|"github"),
    signal_type ("solved_count"|"topic_solved"|"difficulty_split"|"recent_ac"|
                 "rating"|"streak"),
    topic_id (String(64), default "")    # maps to topics.id when applicable
    value: JSON                          # {"count": 12} or {"problem": ..., "date": ...}
    observed_at: DateTime
    unique constraint (user_id, platform, signal_type, topic_id)
```

`MasteryHistory.source_type` gains `"PLATFORM_SIGNAL"` (existing column is
String(32) — fits).

### 3. Secret encryption (`app/services/secret_box.py`, new)

- `fernet.encrypt()/decrypt()` over a key derived from `JWT_SECRET`
  (`SECRET_BOX_KEY` env overrides; rotate = re-enter cookies).
- Never logged; scrubbed from all `repr`s. DB dump alone must not leak
  live LeetCode sessions.

### 4. LeetCode service (`app/services/leetcode_service.py`, new)

httpx client mirroring `codeforces_service.py` style. Functions:

- `async fetch_recent_ac(submission_limit=20) -> list[dict]`
  GraphQL query `recentAcSubmissionList(limit: 20)` →
  `{id, title, titleSlug, timestamp}` per item.
- `async fetch_profile() -> dict` — `matchedUser` →
  `submitStatsGlobal {acSubmissionNum {difficulty count}}`,
  `tagProblemCounts` (advanced/intermediate + fundamental topics → topic
  counts), `profile {ranking}`.
- Each maps `titleSlug`/topic names → internal `topics.id` via a slug map
  (`two-sum → two-pointers`-style mapping table in
  `app/services/topic_map.py`, shared with Codeforces tags mapping).
- Errors: `LeetCodeError` (subclass of `ClarityError` codes:
  `LEETCODE_AUTH_EXPIRED` 401, `LEETCODE_UNREACHABLE` 502) — loud, never
  silently skip.

### 5. API route (`app/api/onboarding.py` + `app/api/users.py`)

```
POST /onboarding/platform-pull        # onboarding screen 4
  body: { codeforces_handle, github_username,
          leetcode_session, leetcode_csrf }        # plaintext, TLS-only
  -> pulls all three platforms concurrently (asyncio.gather),
     encrypts + persists cookies on Profile,
     upserts PlatformSignal rows,
     returns { leetcode: {...}, codeforces: {...}, github: {...} }

POST /users/connections/leetcode      # settings page re-sync
  body: { leetcode_session, leetcode_csrf }        -> same persist + pull

POST /users/connections/leetcode/refresh   # cron/manual, uses stored cookies
POST /users/connections/leetcode/disconnect # wipes cookies + signals? (signals stay; cookies gone)
```

### 6. Persistence → Mastery Model bridge (`app/workflows/platform_signals.py`, new)

`ingest_platform_signals(db, user_id, leetcode=None, codeforces=None)`:

- For each `signal_type=topic_solved` row: find user's `MasteryNode` by
  `topic_id` (creating from `topics` seed if missing).
- Blend measured signal into stored mastery via existing **MasteryEngine**
  (never a raw overwrite — signal counts as high-confidence evidence):
  `MasteryEngine.update(current, correctness=signal_correctness, hints_used=0,
  confidence=0.85)`, where `correctness` is calibrated per topic:
  `min(1.0, solved_on_topic / expected_solved_for_level)`.
- `last_seen` bumped only when the pull shows recent activity on that topic.
- Every node write gets a `MasteryHistory` row with
  `source_type="PLATFORM_SIGNAL"`, `source_id=signal_row.id`,
  `reason="leetcode pull: N solved in <topic>"` — graph provenance stays
  auditable.
- Correlation-usable: returns the topic → signal map for edge computation.

### 7. Graph building — completing nodes + edges (`app/services/graph_builder.py`, new; spec §5)

Currently `init_mastery` seeds 10 nodes and nothing computes edges. Complete:

**Nodes** (already exist; formalize building):
- Seed set: `SEED_TOPICS` + calibration + platform signals create nodes on
  demand (topic ids from `topics` table).
- Node color/size/opacity inputs all exist: `mastery_score` +
  `effective_mastery` (color), `importance_weight` (size — already boosted by
  target-company frequency), `staleness` (opacity). No model change needed.

**Edges — new `MasteryEdge` model + migration:**

```
MasteryEdge (new table):
    id, user_id ("" = global/static), src_topic_id, dst_topic_id,
    kind ("prerequisite"|"correlation"), weight (0..1),
    created_at
    unique (user_id, src_topic_id, dst_topic_id, kind)
```

- **Prerequisite edges (static, curated):** new
  `data/prerequisite_edges.csv` (repo-level seed, ~25 edges over the seed
  topics, e.g. `two-pointers → sliding-window`, `graphs-bfs → dp-on-trees`,
  `sql-joins → dbms-indexing`). Loaded by `graph_builder.ensure_static_edges`
  (idempotent upsert, `user_id=""`). This is content, not logic — extensible
  CSV, no code change to add more.
- **Correlation edges (dynamic, per-user):**
  `graph_builder.compute_correlations(db, user_id)`:
  - Input: `MasteryHistory` deltas per topic per week (bucket by ISO week).
  - For each topic pair with ≥4 co-observed weeks: Pearson correlation of
    weekly deltas. |r| ≥ 0.55 → upsert a `correlation` edge with `weight=|r|`
    (sign recorded in weight metadata column `extra`).
  - Runtime cost is trivial (≤ #topics² with ≤ 26 weeks) — runs synchronously
    at graph read, cached in `MasteryEdge`, recomputed after each
    submission/calibration/signal-ingest (hook at the same call sites that
    already write `MasteryHistory`).
- `GET /mastery/graph` extended to return `{nodes, edges_prerequisite,
  edges_correlation}` (solid vs dashed on the frontend matches existing spec).

## Frontend changes

### Onboarding screen 4 ("Real Platform Pulls")

- Two new inputs below Codeforces/GitHub:
  - `LEETCODE_SESSION` cookie (password-type field, paste)
  - `csrftoken` cookie (password-type field, paste)
- Helper link "How to get these" (popover: DevTools → Application → Cookies →
  leetcode.com → copy both values). Copy states clearly: stored encrypted,
  only used to read *your own* data, wipe anytime in Settings.
- Both fields optional — Codeforces/GitHub path unchanged if blank.
- After submit, show pulled summary chips (solved counts per topic) before
  continuing, so the user sees real signal landed.

### Settings (§9 "Connected accounts")

- LeetCode row: connected state (username + last synced), Refresh button,
  Disconnect (calls wipe route). Re-entering cookies = same screen-4 fields.

### API client (`src/lib/api/endpoints.ts`)

- `onboardingApi.platformPull(...)` typed with new request/response.
- `usersApi.leetcodeConnect/Refresh/Disconnect`.
- No other frontend flow changes — the graph page already renders nodes;
  add rendering of the two edge arrays with distinct styling (solid vs
  dashed) — the D3 force graph already accepts edge lists.

## Migration & rollout

1. `alembic revision --autogenerate -m "leetcode signals + mastery edges"` →
   review → `0003_platform_signals.py`.
2. Rollout order: models+migration → secret_box → leetcode_service →
   ingest bridge → routes → frontend fields → graph edges.
3. Tests:
   - `tests/test_leetcode_pull.py` — httpx mock transport: happy path,
     401 → `LEETCODE_AUTH_EXPIRED`, cookie encryption roundtrip, signal
     upsert idempotency, MasteryEngine blend, graph edge computation
     (fixture histories → expected correlations).
   - Update `tests/test_auth_users.py` for new profile fields.

## Security checklist

- [ ] Cookies encrypted at rest (Fernet); plaintext never logged, never in
      `agent_runs.input_summary`.
- [ ] Only outbound calls to `leetcode.com/graphql` with those cookies.
- [ ] Disconnect wipes ciphertext; signals already ingested remain (they're
      derived facts, not credentials).
- [ ] HTTPS enforced in prod (Container Apps terminates TLS).
- [ ] Rate limit refresh endpoint (1/hour/user) — LeetCode rate-limits
      aggressively.
