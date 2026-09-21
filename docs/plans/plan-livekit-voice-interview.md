# Plan — Voice Interview (AI-first, tool-call editor reveal)

> **SUPERSEDED (Sep 2026): LiveKit is out; Gemini Live API is in.**
> Decision: run voice-to-voice **entirely in the frontend** with the
> `@google/genai` Live API (`ai.live.connect`) — mic PCM in, spoken audio +
> transcripts out, function-call tools for `show_editor` / `send_hint`.
> No SFU, no LiveKit Cloud project, no `livekit-agent/` worker container, no
> token-broker routes; the browser talks to Gemini directly with
> `VITE_GEMINI_API_KEY` (gitignored `frontend/.env.local`).
> Backend involvement is unchanged at the transcript layer: every spoken turn
> is POSTed to the existing `/interviews/{id}/events` route, so
> `/interviews/{id}/debrief` keeps working with zero backend changes.
> Implemented in `frontend/src/lib/geminiLive.ts` +
> `frontend/src/pages/codered/CodeRedInterviewPage.tsx`.
> Everything below the divider is the original LiveKit design, kept for
> reference.

Replaces the "no stable SDK" voice gap (`speech_available() = False` in
`integrations/azure_services.py`) with **LiveKit Agents**, and rebuilds the
CODE RED interview page around it: the screen is primarily a **voice
interviewer**; the code editor is hidden until the agent's tool call reveals
it with an animated transition.

## Architecture

```
Frontend (React SPA)                Backend (FastAPI)                 Separate worker
┌──────────────────────┐   HTTP    ┌───────────────────────────┐     ┌─────────────────────────┐
│ /code-red/interview  │──────────▶│ POST /interviews/live/start│    │ livekit-agent (python)  │
│ LiveKitRoom + mic    │◀──────────│ → creates room, dispatches │───▶│ livekit.agents Worker   │
│ VoiceAssistant UI    │  token+   │   agent job, returns JWT   │    │  + InterviewerAgent     │
│ editor (hidden)      │  room     │ POST /interviews/live/end  │    │  prompt from session    │
└──────────────────────┘           └───────────────────────────┘     └────────────┬────────────┘
        ▲  data channel (editor reveal, code sync, hint events)                  │
        └──────────────────────────────────────────────────────────────────────────┘
                                   LiveKit SFU (cloud or self-host) ─ WebRTC audio
```

Three deployables: FastAPI backend (already exists), **`livekit-agent/`** (new
python worker, separate container — agents are long-lived processes, not
request-scoped), LiveKit SFU (LiveKit Cloud free tier for dev; self-host
`livekit/livekit-server` later).

## Why LiveKit (researched Sep 2026)

- `livekit-agents` (Python) gives STT→LLM→TTS pipeline, turn detection,
  interruptions, and **`@function_tool`** — the LLM decides to call
  `show_editor`, and our handler pushes an event over the room's data channel
  that the frontend animates on. Exactly the trigger model requested.
- Frontend: `@livekit/components-react` `LiveKitRoom`/`useVoiceAssistant` +
  `livekit-client` token auth. `motion` (already a dependency) for the reveal
  animation — no new animation lib.
- Room-level data messages give sub-100ms code/hint sync without touching our
  REST API.

## New service: `livekit-agent/` (repo root)

```
livekit-agent/
  Dockerfile              # python:3.13-slim, runs `python -m agent.main start`
  requirements.txt        # livekit-agents>=1.0, livekit-plugins-{deepgram,openai,silero,cartesia}
  agent/
    main.py               # cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="clarity-interviewer"))
    interviewer.py        # InterviewerAgent(Agent) — see below
    session_context.py    # fetches interview brief from FastAPI, builds prompt
    tools.py              # @function_tool definitions (editor reveal, hints)
    bridges.py            # FastAPI/LiveKit data-channel message helpers
```

### The agent (`agent/interviewer.py`)

```python
class InterviewerAgent(Agent):
    def __init__(self, ctx: JobContext, brief: dict):
        self.brief = brief            # problem, mastery context, rubric
        self.stuck = StuckDetector()  # silence + code-activity heuristics
        super().__init__(instructions=build_system_prompt(brief))

    @function_tool
    async def show_editor(self, context: RunContext):
        """Call this when the candidate should start writing code for the
        current problem — after you have verbally introduced it and confirmed
        their approach."""
        await push_data(ctx.room, {"event": "editor.reveal", "problem": self.brief["problem"]})
        self.editor_visible = True
        return "Editor is now visible to the candidate."

    @function_tool
    async def send_hint(self, context: RunContext, hint: str):
        """Push a nudge/hint into the editor sidebar without speaking over
        the candidate. Use when they are struggling silently."""
        await push_data(ctx.room, {"event": "editor.hint", "hint": hint})
        return "Hint delivered."

    @function_tool
    async def run_code(self, context: RunContext, language: str, source: str):
        """Execute the candidate's code against the visible tests via the
        Clarity judge service and report results verbally."""
        res = await judge.submit(language, source)      # → Judge0, see plan-judge0
        await push_data(ctx.room, {"event": "judge.result", "result": res.summary()})
        return summarize_for_speech(res)
```

**Stuck-detection loop** (the "interviewer must ask questions while the
interviewee is writing code" requirement): every 45s while `editor_visible`,
the agent evaluates `editor_events` (keystroke rate via data-channel `editor.activity`
pings sent by the frontend, last-spoken-line, current cursor position) →
if keystrokes stalled >90s or error-dense edits → agent generates a targeted
question or hint via `session.generate_reply(instructions=...)`, one level
softer each nudge (question → hint → concrete pointer). Calibrated stuck-time
threshold matches spec §6b.

### Prompt comes from the backend, per session (requirement: long contextual prompt)

`POST /interviews/live/start` (backend) assembles the full interview brief and
stores it on the session row; the agent worker fetches it on job start
(`session_context.py` → `GET /internal/interview-brief/{session_id}` with
shared-secret header). Brief contents:

- **Problem**: statement, constraints, examples, test cases (from the CODE RED
  session's generated problem), expected complexity.
- **Candidate context**: mastery snapshot of the problem's topic nodes
  (strong/weak areas), hints they historically need, resume headline.
- **Interviewer rubric**: persona ("calibrated FAANG interviewer"), opening
  script, silence policy, hint-escalation ladder, question bank for
  mid-coding probes ("why this data structure?", "what's the complexity?"),
  debrief dimensions (correctness, communication, approach).
- **Session params**: time budget, round type, company profile notes.

`build_system_prompt(brief)` renders this into the agent's `instructions` —
the long, detailed prompt is fully backend-owned and per-session; the agent
worker holds no content of its own.

## Backend changes (FastAPI)

### 1. Config

```
LIVEKIT_URL: str = ""                    # wss://...
LIVEKIT_API_KEY: str = ""
LIVEKIT_API_SECRET: str = ""
INTERVIEW_AGENT_INTERNAL_SECRET: str = ""  # shared secret for brief fetch
```

### 2. Routes (`app/api/interviews_live.py`, new; mounted in `api/router.py`)

```
POST /interviews/live/start      # auth; creates MockSession(row type interview),
                                 # assembles brief, creates LiveKit room
                                 # (room name = session_id), agent dispatch
                                 # (explicit or auto via agent_name), returns
                                 # { session_id, livekit_url, livekit_token }
POST /interviews/live/{id}/end   # finalizes: pulls transcript + events from
                                 # agent via webhook/room close, runs debrief
POST /internal/interview-brief/{id}   # shared-secret auth (agent worker only)
```

LiveKit token minting with `livekit.api.AccessToken` (identity=user_id, grants:
room join, publish audio). Existing `/interviews/{id}/events`,
`/transcript`, `/debrief` routes are reused unchanged — the agent publishes
`InterviewEvent` rows (`event_type`: `transcript.delta`, `editor.reveal`,
`editor.hint`, `judge.result`, `stuck.nudge`) through the internal bridge.

### 3. Dispatch model

Simplest reliable path: **explicit dispatch** — backend calls the LiveKit
Cloud Agents dispatch API (or room-agent dispatch on self-host) when
`/live/start` is hit. No standby-agent cost while nobody interviews.

## Frontend changes

### `/code-red/interview/:sessionId` — rebuild (primary AI interviewer)

```
┌────────────────────────────────────────────────────────┐
│  ● Interviewer (voice orb, level-metered, speaking/    │
│    listening/thinking states via useVoiceAssistant)    │
│                                                        │
│         [ live transcript ticker, subtle ]             │
│                                                        │
│              (90% of the screen is this)               │
└────────────────────────────────────────────────────────┘
     ⇓ on agent tool call `editor.reveal` ⇓
┌───────────────────────────┬────────────────────────────┐
│  voice orb (compact)      │  CODE EDITOR (slides in    │
│  transcript ticker        │  from right, motion        │
│                           │  layout animation,         │
│                           │  spring 240ms)             │
│                           │  + hint drawer (stagger)   │
└───────────────────────────┴────────────────────────────┘
```

- `packages` to add: `@livekit/components-react`, `livekit-client`.
- `VoiceInterviewStage.tsx` — orb + states (`connecting | listening |
  thinking | speaking`), mic controls, time remaining.
- `EditorReveal.tsx` — `motion` `AnimatePresence` + `layout` animation:
  editor pane scales/slides in, voice stage compresses to a left rail. Hint
  drawer items animate in staggered on `editor.hint`.
- Data channel hooks: `room.onDataReceived` → reducer for
  `editor.reveal | editor.hint | judge.result | editor.activity` (the last is
  outbound — debounced keystroke pings for stuck-detection).
- Monaco stays as the editor component already used by mock-OA runtime; no
  new editor dependency.
- Session end → existing `/code-red/interview/:id/debrief` page unchanged
  (debrief route already reads `/interviews/{id}/debrief`).

### Landing/entry adjustments

- Mic permission preflight added to interview entry (reuse mock-OA preflight
  component patterns).

## Config & deployment

- **Dev**: LiveKit Cloud free project (URL/key/secret in `backend/.env`).
  `livekit-agent` runs via `python -m agent.main dev` (desktop terminal).
- **Prod**: agent worker as its own Container App (min 0 replicas, scale on
  agent jobs), LiveKit Cloud or self-hosted SFU on a separate node.
- Root `docker-compose.yml` gains an optional `--profile voice` service for
  the worker so local dev stays lightweight by default.

## Migration & rollout

1. `backend`: config + brief model/routes + internal brief endpoint (testable
   without LiveKit — unit tests on prompt assembly).
2. `livekit-agent/` scaffold; verify with LiveKit's Agents Playground first
   (join room manually, speak to it) before frontend exists.
3. Frontend: voice stage only (no editor) → editor reveal animation →
   stuck-detection loop → judge integration.
4. Tests:
   - Backend: brief assembly golden-file test (long prompt snapshot),
     token minting, event ingestion → InterviewEvent rows.
   - Agent: `build_system_prompt` unit tests, StuckDetector thresholds,
     tool handlers with a mocked room.
   - Frontend: vitest for the data-channel reducer; motion is visual, manual
     check.

## Risks / decisions to confirm

- **TTS/STT vendor**: plan assumes Deepgram STT + Cartesia/OpenAI TTS plugins
  (LiveKit defaults). Could swap to Azure Speech to keep the stack all-Azure —
  confirm preference before build.
- Latency budget: agent LLM = Foundry (route the agent's LLM calls to the
  existing Foundry project for a single-AI-touchpoint story) — adds ~300ms
  vs OpenAI direct; acceptable, but measure in week 1.
- The interviewer speaking while the candidate types is the spec §6b core
  behavior; interruption handling (candidate talks over) is built into
  LiveKit turn detection — needs tuning, not building.
