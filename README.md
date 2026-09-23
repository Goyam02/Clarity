# CLARITY — Turn Practice Into Readiness

**CLARITY is an AI-assisted technical interview preparation platform that connects daily revision, company-focused preparation, coding assessments, and spoken mock interviews through one shared Mastery Model.** It combines platform activity, practice results, and interview feedback to help learners understand their weak spots and decide what to work on next.

<!-- Replace the CI and license badges when a workflow and project license are established. -->
![CI: Not configured](https://img.shields.io/badge/CI-not_configured-lightgrey)
![Application version: 1.0.0](https://img.shields.io/badge/version-1.0.0-blue)
![License: Not specified](https://img.shields.io/badge/license-not_specified-lightgrey)
![Python: 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![React: 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)

> **Know what needs work. Practice with purpose. Prepare for the next opportunity.**

[Problem Statement](#problem-statement) · [The Solution](#the-solution) · [Screenshots](#screenshots) · [Tech Stack](#tech-stack) · [Pipelines & Architecture](#pipelines--architecture) · [Getting Started](#getting-started) · [Collaborations / Contributing](#collaborations--contributing)

## Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <img src="pics/landing.png" alt="Landing page" width="100%"/>
      <br/>
      <sub><b>Landing Page</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="pics/inter.png" alt="Spoken mock interview" width="100%"/>
      <br/>
      <sub><b>Spoken Mock Interview</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="pics/oa.png" alt="CODE RED preparation" width="100%"/>
      <br/>
      <sub><b>CODE RED Preparation</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="pics/graph.png" alt="Knowledge graph" width="100%"/>
      <br/>
      <sub><b>Knowledge Graph</b></sub>
    </td>
  </tr>
</table>

## Problem Statement

Technical interview preparation is often fragmented across problem lists, revision notes, coding platforms, and occasional mock interviews. Each tool captures part of the picture, but learners still have to answer the hardest questions themselves:

- **What should I study today?** A growing collection of resources rarely becomes a clear, realistic plan.
- **What do I still understand?** Solving a topic once does not mean that knowledge remains fresh.
- **How should I prepare for a specific company?** Generic practice lists miss the intersection of company patterns, role requirements, and personal weaknesses.
- **Can I explain my reasoning under pressure?** Accepted code and a convincing spoken approach are different skills.
- **Is my practice producing progress?** Activity counts alone do not explain changes in readiness.

CLARITY’s product concept grew from a short-notice online assessment: an opportunity arrived with roughly 14 hours to prepare, leaving little time to turn scattered notes into a focused plan.

The project addresses that gap by connecting everyday preparation with the same knowledge model used during time-sensitive interview preparation.

## The Solution

CLARITY organizes preparation around a **persistent, topic-level Mastery Model**. Daily plans, platform imports, coding submissions, and interview reviews contribute to a shared view of the learner’s progress.

### Core experiences

| Experience | What it provides |
|---|---|
| **Signal-first onboarding** | Resume extraction, Codeforces and GitHub profile pulls, LeetCode statistics, an adaptive calibration flow, skill-confidence inputs, and preparation goals. |
| **Daily Mode** | Personalized study plans based on mastery, recent activity, available time, and a **Light / Normal / Push** mood setting. |
| **Knowledge Graph** | An interactive, force-directed view of topics, prerequisite relationships, mastery, importance, and staleness, with a **“Revise this now”** action. |
| **CODE RED** | Company-focused preparation using a job description, round type, time budget, company problem data, and the learner’s weak spots. Checklist items explain their purpose through `weak_spot`, `company`, and `core` tags. |
| **Mock Online Assessments** | Generated coding problems, timed sessions, an editor interface, browser distraction monitoring, and submission-based results. |
| **Spoken Mock Interviews** | Gemini Live voice conversations focused on reasoning, complexity, trade-offs, and communication, with structured question cards and hints. |
| **Progress and profile management** | Practice logs, mastery history, connected-platform activity, editable skills and projects, and saved interview reviews. |

### An explainable model of progress

The backend’s deterministic `MasteryEngine` converts practice evidence into bounded score updates. Its inputs include correctness, solve time, hints, confidence, and explanation quality when available.

Knowledge freshness is calculated at read time using exponential decay:

```text
effective_mastery = stored_mastery × exp(-decay_rate × days_since_seen)
```

This allows older knowledge to become a revision priority without rewriting stored scores every time the dashboard loads.

**CLEAR SCORE** summarizes readiness on a 0–100 scale using five weighted components:

| Component | Weight |
|---|---:|
| Target mastery | 30% |
| Recent performance | 25% |
| Company alignment | 20% |
| Timed performance | 15% |
| Core computer science | 10% |

> CLEAR SCORE is a weighted readiness index. Its components describe preparation signals; it is not a calibrated probability of passing an interview.

### Practice informed by real activity

- **LeetCode:** Public profile statistics through a username or profile URL, with optional user-supplied session cookies for authenticated pulls.
- **Codeforces:** Public profile and submission data mapped into topic evidence.
- **GitHub:** Public repository languages and topics collected during onboarding.
- **Platform Pulse:** A dashboard feed of recent solved problems, supported by platform synchronization and manual refresh controls.
- **Company corpus:** Local CSV problem-frequency data, optionally augmented with source-cited web research through Foundry’s Grounding with Bing Search tool.

Stored LeetCode cookies are encrypted with Fernet and can be removed through the account settings.

## Tech Stack

| Layer | Technologies | Role |
|---|---|---|
| **Frontend** | TypeScript, React 19, Vite 8, React Router 7 | Single-page application and client-side navigation |
| **Styling and interaction** | Tailwind CSS 4, Motion, Lucide React | Styling, animation, and iconography |
| **Graph visualization** | `react-force-graph-2d`, D3 Force | Interactive topic and mastery visualization |
| **Client validation** | Zod, typed API wrappers | Form validation and API integration |
| **Backend** | Python, FastAPI, Uvicorn | Versioned HTTP API and application orchestration |
| **Schemas and configuration** | Pydantic 2, Pydantic Settings | Structured inputs, agent-output validation, and environment configuration |
| **Persistence** | PostgreSQL 16, SQLAlchemy 2, Alembic | Application state, relational models, and schema migrations |
| **Test database** | SQLite | Isolated backend test execution |
| **Agent integration** | Microsoft Foundry, Azure AI Projects SDK, OpenAI SDK, Azure Identity | Deployed-agent invocation and model-backed extraction |
| **Voice interviews** | Gemini Live API, `@google/genai`, browser audio APIs | Browser-to-model speech streaming and transcription |
| **Code execution** | Judge0 CE | Sandboxed Python, Java, C++, and SQL execution |
| **Platform integrations** | HTTPX, LeetCode GraphQL, Codeforces API, GitHub API | External profile and activity ingestion |
| **File processing** | `pypdf`, local file storage, optional Azure Blob Storage | Resume text extraction and upload storage |
| **Infrastructure** | Docker Compose, nginx, Redis 7 | Local service orchestration, frontend serving, and supporting infrastructure |
| **Testing** | pytest, pytest-asyncio, Vitest | Backend, integration-boundary, graph, and voice-client tests |

Redis is provisioned in the application stack; application-level cache and session integration remains limited. Judge0 uses its own separate PostgreSQL and Redis services.

Azure AI Search, Blob Storage, and Application Insights integrations are optional. Blob Storage and Application Insights use optional Python packages that are not included in the base requirements file.

## Pipelines & Architecture

### High-level architecture

CLARITY uses a **FastAPI modular monolith** with separate modules for HTTP routes, workflows, AI agents, and deterministic services.

```mermaid
flowchart TB
    Browser["React application"]
    API["FastAPI · /api/v1"]
    Workflows["Application workflows"]
    Services["Deterministic services<br/>MasteryEngine · CLEAR SCORE · corpus"]
    Agents["Agent layer<br/>Prompting · validation · repair"]
    DB[("PostgreSQL<br/>Authoritative application state")]
    Foundry["Microsoft Foundry<br/>Deployed agents"]
    Judge["Judge0 CE<br/>Code execution"]
    Platforms["LeetCode · Codeforces · GitHub"]
    Gemini["Gemini Live<br/>Voice interview"]
    Search["Azure AI Search<br/>Optional retrieval"]

    Browser --> API
    API --> Workflows
    Workflows --> Services
    Workflows --> Agents
    Services <--> DB
    Workflows <--> DB
    Agents --> Foundry
    Agents --> Search
    API --> Judge
    API --> Platforms
    Browser <--> Gemini
    Browser -->|"Interview events and completed turns"| API
```

**PostgreSQL owns persistent application state:** profiles, mastery nodes and history, plans, problems, submissions, company profiles, preparation sessions, and interview events.

Model outputs provide content and evaluation evidence. Deterministic application code validates those outputs and applies mastery updates.

### Agent responsibilities

Backend agents share a common prompting and validation interface.

| Agent | Default Foundry name | Responsibility |
|---|---|---|
| Planner | `planner` | Produces daily and company-focused preparation tasks |
| Question Generator | `question-generator` | Generates topic-targeted problems, examples, constraints, and test cases |
| Evaluator | `evaluator` | Produces feedback and structured evidence from submissions or recorded explanations |
| Interviewer | `interviewer` | Generates turns for the backend text-interview flow |
| Company Intel | `company-intel` | Builds company preparation profiles and supports configured web research |

Foundry agent calls use the project-scoped **Responses API** with an `agent_reference`. Each deployed agent supplies its own model and tool configuration.

The integration includes bounded transport retries, JSON-format repair, and Pydantic schema validation. Agent-run records capture status, latency, errors, and trace identifiers where database auditing is supplied.

The browser’s live voice interviewer uses **Gemini Live**. Completed interview turns are saved through the backend event API, and the Foundry Evaluator produces the persisted debrief.

### Application pipelines

#### 1. Onboarding and platform signals

```text
Account
  → Resume / platform inputs
  → Profile extraction and topic mapping
  → Adaptive calibration
  → Focus and target companies
  → Mastery initialization and recorded signals
```

Resume PDFs are converted to text with `pypdf` before model-backed extraction. Platform data is normalized into persisted signals and, where applicable, blended into mastery with history records.

Calibration generates ten questions across a rotating set of DSA and core-CS topics. Difficulty adapts to the reported correctness of the preceding answer.

#### 2. Daily preparation

```text
Mastery snapshot + recent activity + mood + time budget
  → Planner
  → Schema validation and task constraints
  → Saved daily plan
  → Revision, concept practice, or manual study logs
  → Updated mastery history
```

Light mode is constrained to revision tasks. Budget enforcement happens in application code after generation.

#### 3. CODE RED and company research

```text
Company + job description + round + time budget
  → Company profile lookup or refresh
  → CSV corpus + optional web research
  → Role signals and mastery comparison
  → Reason-tagged preparation checklist
  → Updated checklist state and CLEAR SCORE
```

The corpus merge preserves local CSV entries first, then appends web findings that are not already present. Web research is TTL-gated, with a default refresh interval of 14 days.

#### 4. Coding practice and mock assessments

```text
Generated problem
  → Candidate attempt
  → Judge0 execution against test cases
  → Evaluator feedback
  → Deterministic mastery update
  → Submission history and assessment results
```

Mock assessments add session timing and browser events such as tab switches and fullscreen exits. When `JUDGE0_BASE_URL` is empty, a local Python-only subprocess judge is available for development.

The complete submission endpoint also invokes the Evaluator, so end-to-end submission feedback requires Foundry configuration.

#### 5. Spoken interview review

```text
Browser microphone
  ↔ Gemini Live interviewer
  → Question cards, hints, and completed transcript turns
  → Backend interview events
  → Evaluator
  → Saved debrief and mastery deltas
```

Debriefs are persisted and reused on subsequent requests, preventing a page refresh from regrading the same interview.

### Repository layout

```text
.
├── backend/
│   ├── app/
│   │   ├── agents/                 # Agent prompts and output validation
│   │   ├── api/                    # Versioned HTTP endpoints
│   │   ├── core/                   # Configuration, errors, security, logging
│   │   ├── db/
│   │   │   └── migrations/         # Alembic migrations
│   │   ├── integrations/
│   │   │   └── foundry/            # Agent, extraction, retrieval, research clients
│   │   ├── models/                 # SQLAlchemy models
│   │   ├── schemas/                # Pydantic contracts
│   │   ├── services/               # Mastery, judging, platforms, corpus, storage
│   │   └── workflows/              # Daily, calibration, CODE RED, interviews, OA
│   ├── .env.example
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/             # Reusable interface components
│   │   ├── hooks/                  # Dashboard and platform data hooks
│   │   ├── lib/                    # API, auth, voice, graph, assessment utilities
│   │   ├── onboarding/             # Signal collection and calibration wizard
│   │   └── pages/                  # Route-level screens
│   ├── .env.example
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── data/company-corpus/companies/  # Company-specific problem CSVs
├── docs/                          # Specifications, architecture, setup, plans
├── scripts/                       # Integration utilities
├── tests/                         # Backend test suite
├── docker-compose.yml             # Full local stack
└── pytest.ini
```

### Build and deployment pipeline

The root Compose configuration assembles the local deployment:

1. **PostgreSQL and Redis** start with health checks.
2. **Judge0 server and worker** start with their own database and Redis instance.
3. **Backend image** installs Python dependencies and copies the application and company corpus.
4. **Backend startup** runs `alembic upgrade head`, then starts Uvicorn.
5. **Frontend image** runs `npm ci` and `npm run build` in a Node build stage.
6. **nginx** serves the compiled SPA and exposes an `/api/` proxy to the backend.

Judge0 containers use privileged mode for their isolate-based execution environment.

**CI/CD status:** No automated CI workflow or deployment pipeline is currently checked in. The repository provides executable test commands, Dockerfiles, and Compose orchestration for local verification and deployment.

## Getting Started

### Prerequisites

For the full Docker stack:

- Git
- Docker Engine or Docker Desktop with Docker Compose v2
- A configured Microsoft Foundry project for agent-backed features

For local development servers:

- **Python 3.11+**
- **Node.js 22.12+** and npm
- PostgreSQL, either locally installed or provided by Compose
- Azure CLI when using local Entra ID authentication

Voice interviews additionally require a Gemini API key and browser microphone access.

### 1. Clone and create configuration files

Replace the repository URL with your fork or project URL:

```bash
git clone <repository-url> clarity
cd clarity

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Create these files on a fresh checkout; preserve existing local configuration when updating an installation.

### 2. Configure Microsoft Foundry

Edit `backend/.env`:

```dotenv
AZURE_FOUNDRY_PROJECT_ENDPOINT=https://YOUR_RESOURCE.services.ai.azure.com/api/projects/YOUR_PROJECT
AZURE_FOUNDRY_MODEL_DEPLOYMENT=YOUR_MODEL_DEPLOYMENT

PLANNER_AGENT=planner
QUESTION_GENERATOR_AGENT=question-generator
EVALUATOR_AGENT=evaluator
INTERVIEWER_AGENT=interviewer
COMPANY_INTEL_AGENT=company-intel

FOUNDRY_TIMEOUT_SECONDS=60
FOUNDRY_MAX_RETRIES=3
```

Create and deploy the five named agents in Foundry, assigning their models and tools there.

`AZURE_FOUNDRY_MODEL_DEPLOYMENT` selects the deployment used by direct resume and screenshot extraction. Deployed-agent calls use each agent’s configured model.

Choose the authentication method appropriate to your environment:

| Environment | Configuration |
|---|---|
| **Local backend using Entra ID** | Run `az login` with an identity authorized to access the project |
| **API-key authentication** | Set `AZURE_FOUNDRY_API_KEY` when a supported project key is available |
| **Container service principal** | Supply `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_CLIENT_SECRET` |
| **Azure-hosted managed identity** | Assign the identity appropriate access to the Foundry project |

Host `az login` credentials are not automatically available inside Docker containers.

For optional web research, attach **Grounding with Bing Search** to the agent named by `WEB_RESEARCH_AGENT`. Set `WEB_RESEARCH_AGENT=` to disable that augmentation.

See [Azure setup](docs/azure-setup.md) for further configuration details.

> The API can serve non-agent features without Foundry. To run in that state, clear the example Foundry endpoint rather than leaving its placeholder URL configured. Generation, calibration, model-backed extraction, and evaluation require the corresponding live services.

### 3. Run with Docker Compose

From the repository root:

```bash
docker compose up --build
```

| Service | Local address |
|---|---|
| Web application | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Interactive API documentation | http://localhost:8000/docs |
| Health endpoint | http://localhost:8000/health |
| Judge0 | http://localhost:2358 |
| PostgreSQL | `localhost:5432` |
| Application Redis | `localhost:6379` |

The default PostgreSQL database, username, and password are all `clarity`.

Compose supplies container-network database and judge URLs. Explicit values in its `environment` blocks take precedence over `backend/.env`; Compose substitutions are controlled through the shell or a root `.env` file.

The frontend currently defaults to `http://localhost:8000` for API requests. nginx also exposes the API through `http://localhost:3000/api/`.

Useful commands:

```bash
# Inspect service state
docker compose ps

# Follow backend logs
docker compose logs -f backend

# Stop and remove containers while retaining named volumes
docker compose down
```

### 4. Run local development servers

#### Start supporting services

From the repository root:

```bash
docker compose up -d postgres redis judge0-server judge0-worker
```

Update these values in `backend/.env` so the host-run backend reaches exposed ports:

```dotenv
DATABASE_URL=postgresql+psycopg2://clarity:clarity@localhost:5432/clarity
REDIS_URL=redis://localhost:6379/0
JUDGE0_BASE_URL=http://localhost:2358
```

For Python-only local judging, set `JUDGE0_BASE_URL=` and start only `postgres redis`.

#### Start the backend

In a terminal at the repository root:

```bash
cd backend

python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Run backend commands from `backend/` so its `.env` file is loaded.

#### Start the frontend

In another terminal at the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000.

### 5. Enable voice interviews

Edit `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
VITE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# Optional model override:
# VITE_GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025
```

Restart Vite after changing environment variables.

The voice session connects directly from the browser to Gemini. Foundry is still required for model-backed interview debriefs.

**Use the local Vite workflow for voice development:** the current frontend Dockerfile does not copy `.env.local` or expose `VITE_*` build arguments. A containerized voice build needs those values supplied during the frontend build stage.

### 6. Verify the installation

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status":"ok"}
```

Then:

1. Open the application and create an account.
2. Complete onboarding, optionally importing a resume and platform signals.
3. Generate a daily plan to exercise the Foundry integration.
4. Open the Knowledge Graph to inspect your initialized topics.
5. Start CODE RED, a mock assessment, or a spoken interview.

A successful health response verifies API availability; generating a plan verifies the configured agent path.

### 7. Run checks

After installing local backend and frontend dependencies, run the backend suite from the repository root:

```bash
backend/.venv/bin/python -m pytest tests -q
```

The backend test harness uses SQLite and injected model backends, so Foundry credentials are not required.

Run frontend checks from `frontend/`:

```bash
npm run lint
npm test
npm run build
```

`npm run lint` performs a TypeScript type check through `tsc --noEmit`.

### Configuration reference

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLAlchemy database connection |
| `JWT_SECRET` | JWT signing configuration |
| `DEV_AUTH_ALLOW_HEADER` | Enables the development `X-User-Id` authentication path |
| `AZURE_FOUNDRY_PROJECT_ENDPOINT` | Foundry project endpoint |
| `AZURE_FOUNDRY_API_KEY` | Optional API-key authentication |
| `AZURE_FOUNDRY_MODEL_DEPLOYMENT` | Direct extraction model deployment |
| `WEB_RESEARCH_AGENT` | Agent used for optional company web research |
| `AZURE_SEARCH_ENDPOINT` / `AZURE_SEARCH_INDEX` | Optional retrieval index |
| `AZURE_STORAGE_CONNECTION_STRING` | Optional Azure upload storage |
| `SECRET_BOX_KEY` | Key material for stored platform-token encryption |
| `LEETCODE_REFRESH_MIN_INTERVAL` | Per-user platform refresh interval; defaults to 3,600 seconds |
| `JUDGE0_BASE_URL` | Judge0 address; empty selects the local Python judge |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google sign-in |
| `COMPANY_CORPUS_DIR` | Company CSV corpus location |
| `VITE_API_BASE_URL` | Frontend backend-origin override |
| `VITE_GEMINI_API_KEY` | Browser voice-interview configuration |

### Troubleshooting

| Symptom | What to check |
|---|---|
| `FOUNDRY_NOT_CONFIGURED` | Configure the project endpoint and the required deployment or agent names. |
| `FOUNDRY_AUTH_FAILED` | Verify the identity or key available to the actual backend process, particularly inside Docker. |
| `FOUNDRY_AGENT_NOT_FOUND` | Confirm the project endpoint, agent name, and deployed agent version. |
| `FOUNDRY_BAD_OUTPUT` / `AGENT_FAILED` | Inspect the reported parsing or schema error and the deployed agent instructions. The agent path includes bounded format and schema-repair handling. |
| `JUDGE_UNAVAILABLE` | Check Judge0 service health and use `localhost:2358` from a host-run backend or `judge0-server:2358` inside Compose. |
| Voice interview reports a missing key | Set `VITE_GEMINI_API_KEY` in `frontend/.env.local` and restart Vite. |
| Host-run backend cannot reach PostgreSQL | Replace the Compose-only hostname `postgres` with `localhost` in the local backend configuration. |

Additional documentation:

- [Product specification](docs/CLARITY-product-spec.md)
- [Backend architecture](docs/backend-architecture.md)
- [Frontend architecture](docs/frontend-architecture.md)
- [API contracts](docs/api-contracts.md)
- [Azure setup](docs/azure-setup.md)
- [Agent pipeline diagrams](docs/pipelines/)

The specification and planning documents provide product context; running code and generated OpenAPI documentation establish the current implementation.

## Collaborations / Contributing

Contributions are welcome across the stack—from improving a confusing setup instruction to refining the preparation experience or strengthening an integration.

### Ways to contribute

- **Improve the learning experience:** revision flows, onboarding, accessibility, graph interactions, and interview feedback.
- **Strengthen integrations:** Foundry response handling, platform imports, Judge0 execution, and voice-session reliability.
- **Improve data quality:** company corpus entries, topic mappings, source attribution, and research normalization.
- **Expand verification:** meaningful regression tests, full-stack scenarios, and automated CI workflows.
- **Improve documentation:** reproducible setup guides, architectural explanations, and clear troubleshooting examples.

### Submit a pull request

1. Fork the repository and create a focused branch.
2. Read the relevant module and documentation before making changes.
3. Follow the existing separation between routes, workflows, agents, and deterministic services.
4. Add regression coverage when changing behavior, and update documentation or environment examples when needed.
5. Run the relevant backend tests, frontend type checks, tests, and build.
6. Open a pull request describing:
   - The problem being solved.
   - The implementation and important trade-offs.
   - How the change was verified.
   - Screenshots or recordings for interface changes.
   - Any migration or configuration requirements.

For agent-related changes, keep output contracts explicit and use dependency injection to test behavior without live provider credentials.

### Report an issue

A useful issue includes:

- A concise description of the expected and actual behavior.
- Reproduction steps.
- Whether the application is running through Compose or local development servers.
- Relevant runtime versions.
- Error codes, request identifiers, and sanitized logs.
- Screenshots when the issue affects the interface.

For larger features or architectural changes, start a discussion in an issue so contributors can align on scope and fit.

**Every contribution that makes preparation more focused, understandable, and reliable helps move CLARITY forward.**
