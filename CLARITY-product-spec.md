# CLARITY — Full Product Specification

**One-line pitch:** *HackerRank, but the interviewer already knows you, the questions can't be found on Google, and it's the same coach that's been talking to you every day.*

**What it is:** A spaced-repetition engine that feeds a personalized, agent-generated HackerRank-style locked exam environment, which feeds a live AI mock-interviewer — all three surfaces reading and writing a single shared model of what one student actually knows, run by a coordinated team of AI agents instead of one chatbot.

**Origin story (use this in the pitch):** Built from a real moment — a student got a ServiceNow Online Assessment notification with ~14 hours' notice and had nothing but scattered notes and panic. CLARITY exists so that moment never happens to anyone again: whoever opens it on a normal Tuesday is the same person who can trust it at 10pm the night before an OA.

---

## 1. Core Philosophy

The single idea everything else derives from: **HackerRank and Anki both fail the same way — they treat "readiness" as static content delivery.** CLARITY treats readiness as a *live model of one student's brain* that three different surfaces read from and write to.

```
                         ┌───────────────────────────┐
                         │      MASTERY MODEL          │
                         │ topic → subtopic → pattern  │
                         │ each node: mastery score,   │
                         │ decay rate, last-seen,      │
                         │ error-type history          │
                         └─────────────┬───────────────┘
            ┌──────────────────────────┼───────────────────────────┐
            ▼                          ▼                           ▼
   PILLAR 1: DAILY MODE      PILLAR 2: CODE RED            PILLAR 3: MOCK
   (writes small, often)     (personalized locked OA)      INTERVIEW (voice)
                                                            (writes big, rare —
                                                             highest-signal input)
```

Direction of data flow matters:
- **Daily Mode** keeps the Mastery Model warm with high-frequency, low-signal updates.
- **Mock Interview** delivers rare, high-signal updates — one full session should move more graph nodes than a week of flashcards.
- **CODE RED** sits between the two: it *consumes* the graph (to personalize the crunch plan) and *produces* new signal (a full mock attempt is richer than one flashcard).

The Mastery Model is not itself an agent — it's the shared memory every agent reads and writes against. This is what makes "the thing you open every morning" and "the thing you trust on the day of the interview" the same product instead of two bolted-together tools.

---

## 2. The Agent Roster

Five agents, real handoffs, one shared state.

| Agent | Job | Reads | Writes |
|---|---|---|---|
| **Planner** | Generates the daily plan and the CODE RED time-boxed schedule | Mastery Model, mood input, time available, company profile | Today's queue / CODE RED checklist |
| **Question Generator** | Composes fresh, pattern-targeted, company-calibrated problems on demand | Target pattern, company style anchors (RAG) | New problem statement + test cases |
| **Evaluator / Grader** | Grades code submissions and voice transcripts | Submission, transcript | Mastery Model (score deltas), CLEAR SCORE |
| **Interviewer** (voice) | Conducts mock interviews — one calibrated persona, silent while candidate thinks, adaptive hinting | Problem, live transcript | Session transcript (short-term memory) |
| **Company-Intel Extractor** | Builds and updates company profiles | Onboarding input, post-session recaps, web research | Company profile store (RAG-backed) |

Design rule carried through the whole project: **build the handoff skeleton first, even with stub logic in each agent.** The multi-agent orchestration trace is the architectural claim the whole pitch rests on — it needs to exist and be demoable before anything else is polished.

---

## 3. Onboarding — "Maximum Real Signal" Flow

Design principle: self-report is *biased* (everyone over-rates their own level), so onboarding pairs self-report with sources that produce ground truth — a vision-based profile scan (no credentials needed) and an adaptive calibration quiz (measures actual level instead of asking someone to guess it).

**Explicit security decision:** CLARITY never asks for LeetCode/GFG session cookies or CSRF tokens. Asking a user to hand over an authenticated session is functionally the same pattern phishing tools use, violates those platforms' terms, and creates real account-security risk if the token or its storage ever leaked. This was deliberately designed out in favor of safer equivalents below.

### Screen 1 — Account
Email/password or Google sign-in. Nothing else on this screen.

### Screen 2 — Resume Upload
- Drag-and-drop PDF
- An extraction agent (multimodal model call) reads the resume directly
- Extracted skills/projects shown as editable chips for the user to confirm
- Free, reliable signal with zero platform dependency

### Screen 3 — Scan Your Coding Profiles
- Instead of connecting accounts, the user uploads a **screenshot** of their LeetCode/GFG profile page
- A vision-capable model reads solve counts, topic breakdown, and difficulty distribution directly off the image
- No login, no token, no credential risk — genuinely richer than a self-report guess, and safe

### Screen 4 — Real Platform Pulls (the two that are actually safe)
- **Codeforces handle** → pulled live via Codeforces' **official public API** (`user.status`, `user.info`) — no auth required at all, works reliably, and can be demoed live as a real data pull
- **GitHub username** → public repo languages/topics via GitHub's public API
- Both are the only "auto-connect" promises the product makes honestly

### Screen 5 — Quick Calibration Quiz (the centerpiece of onboarding)
- 8–12 questions across DSA + core CS (DBMS/OS/CN/OOPs)
- **Adaptive**: difficulty of the next question depends on whether the previous one was answered correctly and how fast — implemented as a branching workflow, not a static question bank
- Produces *measured* mastery scores instead of self-rated ones — this is the single biggest lever for making the graph "real" on day one instead of guessed
- Takes roughly 4 minutes

### Screen 6 — Current Focus + Targets
- "What are you currently studying?" (free text/topic picker)
- Target companies (1–5)
- Rough placement season timeline
- Triggers the Company-Intel Extractor to pre-fetch/prep those company profiles in the background before the user lands on Home

### Screen 7 — Graph Reveal
- "Building your graph…" transition (real computation happening, not a fake loader)
- User lands directly on a **populated, already-differentiated** Knowledge Graph — green nodes from calibration wins, yellow from resume/platform signal, red from calibration misses
- This is the payoff moment for the whole onboarding flow and should feel deliberate, not instant

---

## 4. Daily Mode (Home Page)

```
Good morning, [Name]                    [ CODE RED ⚡ ] ← always visible

Mood:  Light · Normal · Push            (Normal selected)

Today · 40 min
□ DSU revision — mastery dropped to 58%
□ Fresh problem: sliding window variant
□ DBMS: indexing — explain-it-back
□ OS: paging — quick flashcards

[ + log what I studied outside this ]

Your graph →  (small live thumbnail, tap to expand)
```

**Key design decisions:**
- **Mood toggle** (Light / Normal / Push) sits directly above the plan, not in Settings — it's a live input to the Planner agent's prompt, not a stored preference. Changing it regenerates the plan instantly, no confirmation dialog, no page reload.
  - *Light* → trims to pure revision, no new material
  - *Normal* → standard mix of decaying-mastery review + one stretch topic
  - *Push* → adds a timed stretch problem or drill
- **CODE RED button** is permanently in the header. The entire premise of the product is that this must be reachable in one tap during a real panic moment — it is never nested inside a menu.
- **Log intake**: primary path is manual (paste a problem name/link, or confirm auto-pulled Codeforces submissions) — this is the *reliable core*, since platform APIs can silently break. Every log write updates the Mastery Model immediately.
- **Graph thumbnail** is intentionally small on this page — a teaser that reflects live state, not the full interactive experience. Full interaction only happens on the dedicated Knowledge Graph page.

### Daily Practice Content Types
1. **In-editor code judge** for DSA — captures pass/fail, time-to-first-line, approach signature, hint count
2. **Explain-it-back concept cards** for DBMS/OS/CN/OOPs — graded by an agent on explanation quality, not keyword matching (deliberately verbal-leaning, since interviews are verbal)
3. **Fresh-variant problems** — Question Generator regenerates a new problem testing the same pattern each time a node comes up for review, so nothing can be memorized by rote

---

## 5. Knowledge Graph (Obsidian-Style Visual Layer)

Full-screen, dedicated page. This is the visual layer sitting directly on top of the Mastery Model — not a separate feature, but the Planner/Evaluator's output made spatial and explorable.

**Structure:**
- **Nodes** = topics/patterns (e.g., "Sliding Window," "DSU," "DBMS Indexing," "OS Paging") — never individual questions. Questions are instances; patterns are nodes.
- **Prerequisite edges** — static, curated once, solid line style. Give the graph its underlying shape (e.g., "Graph DFS" → "Topological Sort" → "Course Schedule problems").
- **Correlation edges** — dynamic, computed from the student's own logged history, dashed line style (e.g., "every time DP-on-Trees mastery dropped, Recursion mastery was also low that week"). This is what makes the graph feel alive rather than a static syllabus map.

**Visual encoding:**
| Property | Meaning |
|---|---|
| Node color | Mastery level (red → yellow → green gradient) |
| Node size | Importance (weighted by frequency in the student's target companies' OAs) |
| Node opacity / pulse | Staleness — dims visibly if untouched for N days, even if once mastered |

**Interaction:**
- Tap a node → side panel: mastery %, last-touched date, the specific problems/cards behind it
- One button in that panel: **"Revise this now"** → drops it straight into today's Home queue, panel closes
- Filter chips at the top: All / DSA / Core CS
- No manual editing of nodes or edges — this page is a navigate/read surface, the model manages itself

Recomputed and re-rendered after every logged session (daily log, CODE RED session, or mock interview) — this is the strongest single demo moment in the product, since it's spatial and visibly grows with real use rather than being a static chart.

---

## 6. CODE RED — Unified Crunch Feature (OA + Interview)

One engine, two endings — not two separate features. This is the direct answer to the original "14 hours before ServiceNow" problem.

### Entry Screen
```
CODE RED

Company:        [ ServiceNow            ]
Paste the JD:   [ ________________      ]
Time available: [ 5 hours  ▾ ]
Round:          ⦿ OA        ○ Interview

[ Generate my plan ]
```

Visually distinct from Home (darker theme) — deliberately signals "this is not a normal day."

**On submit:**
1. JD gets parsed — pulls role-specific signal (backend-heavy? SQL-heavy? system design mentioned?) that shapes prioritization beyond generic "DSA in general"
2. Company-Intel Extractor pulls/refreshes the target company's profile (RAG-backed, or a live research pass if stale)
3. Planner diffs the company's known pattern against the student's current Mastery Model
4. A short, real "building your plan…" transition (genuine computation, not faked)

### 6a. CODE RED — OA Flow
```
ServiceNow OA · 4h 52m remaining        CLEAR SCORE: 61% ↑

□ [weak] Redo: DSU problem you missed 3wks ago     12min
□ [company] Array + Hash — ServiceNow-style           15min
□ [core] SQL joins — quick revise                     10min
□ [weak] Graph BFS variant                            15min
...
[ Start Mock OA ]  ← unlocks once checklist budget is spent
```

- Every checklist item is tagged with *why* it's there: **weak spot** (personal gap), **company** (known standard question for this company, self-curated), or **core** (relevant core-subject revision triggered by the JD) — this labeling is what makes the checklist feel intelligent rather than generic
- Timer runs against the total time budget, auto-split across checklist items
- **CLEAR SCORE** — live predicted probability of clearing this specific OA, computed from (Mastery Model state) × (company's known bar) — visibly ticks upward as items are checked off. This is the number that should move live in any demo.
- **Start Mock OA** launches the Locked Environment (see §8) sized to whatever time remains, ends in a scored attempt

### 6b. CODE RED — Interview Flow
Same entry and checklist mechanics, but:
- Checklist skews toward explain-back concept cards + JD-specific prep instead of raw DSA volume
- Final button reads **"Start Mock Interview"**
- Session is split-screen: code editor + live voice channel, running **simultaneously** (not turn-based — this simultaneity is the actual point, since real interviews require thinking aloud while coding)

```
[ split screen ]
Code editor  |  ● Interviewer listening…
             |  "Walk me through your approach
             |   before you start coding."
```

- Interviewer agent introduces the problem verbally, stays silent while the candidate thinks, interjects with "why did you choose that approach" mid-solve, and only offers a hint after a calibrated stuck-time threshold — behaving like a real interviewer, not a narrating chatbot
- **Debrief screen** at session end: correctness, time-to-solve, communication clarity score pulled from the transcript, final CLEAR SCORE, and a few Knowledge Graph nodes visibly pulsing/updating color right there on the debrief screen — closes the loop in the same screen the session ended on, rather than making the user go find it on Home afterward

---

## 7. Weekly Rhythm (Non-Crunch Days)

- One weekly mock OA (locked environment)
- One weekly mock interview (voice)
- Same five-agent pipeline as CODE RED, just scheduled instead of crunch-triggered — not a separate build, a different trigger into the same system
- Both skippable/reschedulable in one tap — kept deliberately light-touch. A skipped weekly mock teaches the Mastery Model nothing, and a heavy obligation competing with the 40-minute daily habit will just get abandoned.

---

## 8. Locked Environment (Shared Infrastructure)

Used by both CODE RED and weekly mocks. Deliberately minimal — necessary infrastructure to *house* the agents, not itself an AI feature.

- Fullscreen lock
- Tab-switch / copy-paste detection
- Session timer matched to the actual round duration
- Framed internally as **distraction-blocking**, not anti-cheat theater — for a tool the student uses on themselves, the goal is focus, not surveillance. (A behavioral "suspicious vs. genuine struggle" classifier was considered and explicitly cut — unnecessary complexity for a self-use tool.)

---

## 9. Settings

Kept intentionally thin — this is not where the product lives.

```
Profile
  Name, email

Connected accounts
  Codeforces: [handle]  [disconnect]
  GitHub: [username]  [disconnect]
  LeetCode / GFG: (screenshot-based, re-upload anytime)

Target companies
  ServiceNow, [+ add]

Default mood
  Normal

Data
  [ Export my data ]   [ Delete account ]
```

No notification scheduler, no theme picker, no granular privacy toggles. Every field on this page either feeds an agent directly or protects the account — anything that does neither doesn't belong here.

---

## 10. Tier-1 Moonshot Features (Locked In)

| Feature | What it does | Why it's Tier 1 |
|---|---|---|
| **CLEAR SCORE** | Live predicted probability of clearing a specific company's OA/interview, computed from Mastery Model state × that company's known bar. Shown throughout CODE RED, updates in real time as checklist items are ticked. | Cheap to compute from data the system already has; the single number that makes the whole pipeline legible in a demo — turns a plan into a decision signal |
| **OUTCOME LOOP** | After a *real* (non-mock) interview/OA, the student logs the actual result — selected/rejected, round they fell at. | Closes the one loop no competitor closes (neither HackerRank nor Anki knows if prep actually worked). This becomes the ground truth that calibrates CLEAR SCORE over time — the most defensible long-term moat in the product. |
| **DRIFT DETECTOR** | A lightweight agent that periodically flags its own company-intel data as possibly stale ("last verified 3 months ago — has this company's OA format changed?") instead of silently serving outdated info. | Small to build, strong agentic narrative beat: the system knows what it doesn't know anymore. |

---

## 11. Foundry AI Pipeline Mapping

Mapping confirmed against Microsoft Foundry's current (2026) Agent Service feature set rather than stale assumptions.

| Feature | Agent(s) | Foundry tool/primitive | What's actually happening |
|---|---|---|---|
| Resume + profile-screenshot parsing | Extraction Agent | Multimodal model call (vision-capable model, model catalog) | Resume/screenshot goes directly into the model — no separate OCR step |
| Codeforces + GitHub pull | Extraction Agent | **OpenAPI tool** (function calling against each platform's official public REST API) | Safe, no scraping, no credentials — agent calls a defined schema against a real public API |
| Adaptive calibration quiz | Calibration Agent | **Foundry Workflows** (conditional branching per answer) + structured output for scoring | Each answer conditions the next question — a branching workflow, not a single static prompt |
| Onboarding sequencing (parallel extraction → convergent calibration) | Extraction Agent, Calibration Agent | **Foundry Workflows** — parallel steps converging into a sequential step | Independent extractions (resume, screenshots, Codeforces, GitHub) run in parallel; calibration start gates on their completion |
| Mastery Model / Knowledge Graph state | — (shared state) | **Managed memory** (long-term + procedural memory) | The Mastery Model lives here; every agent reads/writes against it instead of a hand-rolled database layer |
| Daily plan + mood-adjusted queue | Planner | Managed memory (read graph) + structured output (JSON plan) | Mood is injected as a constraint string into the same Planner call — not a separate pipeline |
| Daily / CODE RED / mock problem generation | Question Generator | **Foundry IQ** (RAG over a curated problem/pattern corpus) | Retrieves style/difficulty anchors, generates a genuinely fresh variant rather than reusing a bank item |
| Manual/auto log grading | Evaluator | **Code Interpreter tool** (executes submitted code) + memory write | Code is actually run and checked, not just pattern-matched |
| Company-Intel building/refresh | Company-Intel Extractor | **Deep Research tool** (`o3-deep-research` + Bing grounding) for fresh lookups; **Foundry IQ** for the persisted profile store | Deep Research handles "go find ServiceNow's current OA format"; Foundry IQ serves it fast on repeat without re-researching |
| CODE RED checklist + CLEAR SCORE | Planner, Evaluator | Managed memory (diff current graph vs. company profile) + structured output | CLEAR SCORE is a computed function over two memory reads — cheap, updates live as memory changes |
| Mock OA | Question Generator, Evaluator | Foundry IQ + Code Interpreter | Same generation/grading pipeline as daily mode, time-boxed and locked |
| Mock Interview (voice) | Interviewer | Real-time voice model (Agent Service) + short-term memory (session transcript) | Interviewer holds conversational state only for the session; final scores write to long-term memory at session end |
| Debrief screen | Evaluator | Structured output + memory write | Same grading agent, different output shape (adds clarity score) |
| Overall multi-agent orchestration | All agents | **Connected Agents** (primary orchestrator delegating to task-specific sub-agents) | The piece to visibly show in a demo trace — primary agent handing off to Planner → Question Generator → Evaluator |
| Demo/build credibility | — | **Tracing + Evaluation** tooling | Shows the real agent-handoff trace and a quality score across test runs — the detail that proves "agentic" rather than "LLM-wrapped" |

---

## 12. Team Split (5 people)

| Role | Owns | Notes |
|---|---|---|
| **Frontend Engineer** | All 6 pages: Landing, Onboarding (7 screens), Home, Knowledge Graph, CODE RED (both flows), Settings. Owns the graph visualization specifically. | Builds against mocked JSON contracts from day one — never blocked waiting on real agents |
| **Backend/AI Pipeline Lead (you)** | Connected Agents orchestration setup, Planner + Evaluator agents, Mastery Model schema in managed memory, CLEAR SCORE computation | The architectural spine everyone else's agents plug into — stub handoff trace working on day one |
| **Integrations & Onboarding Engineer** | Resume/screenshot vision extraction, Codeforces/GitHub OpenAPI pulls, Adaptive Calibration Quiz as a Foundry Workflow | Aligns on Mastery Model schema with the lead first — it's the one thing that must lock early |
| **Voice, Locked Environment & Grading Engineer** | Interviewer agent real-time voice integration, split-screen session state, fullscreen/tab-lock/timer mechanics, Code Interpreter integration for grading | Highest technical risk on the team (real-time voice + proctoring lock) — start first, check in most often |
| **RAG, Company-Intel & Eval Engineer** | Foundry IQ setup for company-profile store + problem corpus, Deep Research integration, seed data curation (company profiles, standard questions per target company), Tracing + Evaluation setup | Seed data curation is content work as much as engineering — don't underestimate the time it takes |

**Build order:**
1. Day 1: Mastery Model schema + API contracts defined and shared — unblocks Frontend, Integrations, and Voice/Grading simultaneously
2. Frontend builds against mocked data throughout — never waits on real agents
3. RAG/Company-Intel seed data curation starts immediately in parallel — needed before CODE RED can be demoed end-to-end
4. Voice + locked environment attempted first by that engineer, not last — most likely to eat unplanned time, most visible if it breaks on stage
5. Full integration checkpoint scheduled *before* the final day — orchestration + onboarding pipeline + voice/grading + RAG company-intel wired together early enough that contract mismatches surface with two days of runway, not two hours

---

## 13. Explicitly Cut / Descoped (with reasoning)

| Cut feature | Why |
|---|---|
| LeetCode/GFG CSRF token or session-cookie collection | Real account-security risk; equivalent to a phishing pattern; replaced with screenshot-based vision extraction |
| GFG / HackerRank live auto-pull | No reliable API path exists for either |
| Crowdsourced company-intel at scale | Solves a growth-stage problem the project doesn't have yet; self-curated seed data is sufficient for personal/hackathon use |
| Behavioral suspicion classifier in proctoring | Unneeded complexity for a self-use tool — reframed as distraction-blocking instead of anti-cheat |
| Multiple interviewer personas | Nice-to-have, not core utility — one calibrated persona for v1 |
| Vision/whiteboard sketch input during interviews | Not the actual pain point being solved; real build risk for no near-term payoff |
| Browser extension for passive activity tracking | Solves the auto-pull reliability problem better than fighting platform APIs, but is a project of its own — parked |
| Voice agent for daily briefings/chit-chat | Voice is scoped strictly to real interview sessions only — never ambient conversation |

## 14. Parked for Later (Vision-Slide Only, Not Built)

- **PANEL MODE** — simulated multi-persona interview panel (technical / system-design / HR) with live agent-to-agent handoff
- **GRILL MODE** — an agent that interrogates the student specifically on their own resume/projects, catching the "can't defend your own work under pressure" failure mode
- **CAMPUS PULSE** — anonymized, opt-in aggregate view for a placement cell showing cohort-wide strengths/weaknesses against target companies
- **LADDER MODE** — students targeting the same company matched into a lightweight ranked mock-OA ladder

---

## 15. Pitch Lines Worth Keeping

- *"It's HackerRank, except the questions can't be found on Google, the proctor is there to protect your focus rather than catch you cheating, and the interviewer already knows exactly where you're weak — because it's the same agent that's been coaching you every day."*
- *"One completed mock interview should visibly move more mastery-graph nodes than a week of flashcards — because it's the highest-signal data the product can capture."*
- *"It started as one student's panic button 14 hours before a ServiceNow OA. It became the tool the whole placement season runs on."*
