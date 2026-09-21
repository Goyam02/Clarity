# CLARITY API Contracts (v1)

Base: `http://localhost:8000/api/v1`. OpenAPI/Swagger at `/docs` (generated).

## Auth

- `POST /api/v1/auth/register` `{email, name}` → `{user_id, email, token}`.
  Idempotent by email; also creates the empty `Profile`.
- Per-request: `Authorization: Bearer <token>` (HS256 JWT, 24h), or
  `X-User-Id: <id>` when `DEV_AUTH_ALLOW_HEADER=True` (local dev only —
  disable in production).
- Every user-scoped query filters by the authenticated `user_id`; users can
  never see each other's data. All errors share the envelope
  `{"error": {"code", "message", "request_id"}}` (never stack traces/secrets).

## Endpoints

† = needs a configured Foundry project (else `FOUNDRY_NOT_CONFIGURED`).

| Method & Path | Req | Resp |
|---|---|---|
| `GET /health`, `GET /api/v1/health` | — | `{status: ok}` |
| `POST /auth/register` | `{email,name}` | `{user_id,email,token}` |
| `GET /users/me` | auth | `{user_id,email,name}` |
| `POST /onboarding/signals` †-free (external APIs) | `{codeforces_handle,github_username,resume_blob_ref}` | `{codeforces,github,resume}` — fetched concurrently; each degrades to `{error,...}` independently |
| `POST /onboarding/initialize` | auth | `{initialized_nodes}` — seeds 10 topic nodes at 0.5 mastery |
| `POST /onboarding/focus` † | `{current_focus,target_companies[],placement_timeline,default_mood,codeforces_handle,github_username}` | `{saved,preloaded[]}` |
| `POST /onboarding/calibration/start` † | auth | `{run_id,question{index,topic,difficulty,title,statement,test_cases}}` |
| `POST /onboarding/calibration/answer` † | `{run_id,correct,solve_time}` | `{done:false,question}` ×9 → `{done:true,summary{signals[]}}`; completion writes mastery nodes (`CALIBRATION`) |
| `GET /mastery/nodes` | auth | `{nodes[{id,name,category,mastery,effective_mastery,importance,staleness}]}` |
| `GET /mastery/graph` | auth | `{nodes[],edges[{from,to,type:PREREQUISITE}]}` — read-only |
| `POST /mastery/update` | `{topic_id,correctness,solve_time_seconds,expected_time_seconds,hints_used,source_type,explanation_quality?}` | `{node_id,previous,new,delta}` + history row |
| `GET /mastery/history/{node_id}` | auth | `{history[{previous,new,delta,source,at}]}` (latest 50) |
| `POST /daily/plan` † | `{mood: light\|normal\|push, time_available}` | `{plan_id,tasks[{task_type,node_id,duration_minutes,reason,title}],trace_id}` |
| `POST /problems/generate` † | `{pattern,topic_id,difficulty,company?}` | problem `{problem_id,title,statement,constraints,examples,test_cases,expected_complexity,validation,trace_id}` |
| `GET /problems` / `GET /problems/{id}` | auth | list (latest 50) / detail |
| `POST /submissions/attempts` | `{problem_id}` | `{attempt_id}` |
| `POST /submissions` † (evaluator) | `{attempt_id,language: python\|java,source_code,explanation?}` | `{submission_id,judge{status,passed,total,test_results},evaluation,mastery{node,previous,new,delta}\|null,trace_id}` |
| `POST /code-red` † | `{company,job_description,time_available_minutes,round_type: OA\|Interview}` | `{session_id,company,tasks[{type,node_id,duration_minutes,reason,title}],clear_score{score,components},drift{stale,last_verified,message}}` |
| `GET /code-red/{id}/clear-score` | auth | `{session_id,company,score,components{target_mastery,recent_performance,company_alignment,timed_performance,core_cs}}` |
| `GET /companies/{name}` † (first build) | auth | profile `{oa_patterns,interview_patterns,core_subjects,difficulty,round_structure,sources,confidence,last_verified,drift}` |
| `GET /companies/{name}/drift` | auth | `{stale,last_verified,message}` |
| `POST /interviews` | auth | `{session_id,status}` |
| `POST /interviews/{id}/events` † (interviewer reply) | `{event_type,payload}` — types: `PROBLEM_STARTED, CANDIDATE_SPEECH, INTERVIEWER_SPEECH, CODE_CHANGED, HINT_REQUESTED, HINT_GIVEN, SUBMISSION, TEST_RESULT, FOLLOWUP, SESSION_ENDED` | `{recorded,interviewer{utterance,hint_given}\|null}` |
| `GET /interviews/{id}/transcript` | auth | `{session_id,transcript[{type,payload,at}]}` |
| `GET /interviews/{id}/debrief` † | auth | `{correctness,communication_quality,feedback,mastery_deltas[],events}` |
| `POST /outcomes` | `{company,role,round,result,notes}` — snapshots mastery at log time | `{outcome_id}` |
| `GET /outcomes` | auth | `{outcomes[{id,role,round,result}]}` |

Mood semantics (`POST /daily/plan`): `light` → revision only; `normal` →
revision + one stretch problem; `push` → revision + stretch + timed challenge.
Total time always fits `time_available` (scaled, tail tasks dropped).

## Status codes

| Code | Meaning |
|---|---|
| 200 | ok |
| 401 | missing/invalid credentials |
| 404 | `TOPIC_NOT_FOUND`, `SESSION_NOT_FOUND`, `ATTEMPT_NOT_FOUND` |
| 500 | `INTERNAL_ERROR`; `FOUNDRY_NOT_CONFIGURED` (set `AZURE_FOUNDRY_PROJECT_ENDPOINT` / `AZURE_FOUNDRY_MODEL_DEPLOYMENT` — see `docs/azure-setup.md`) |
| 502 | `FOUNDRY_UNAVAILABLE`, `FOUNDRY_CALL_FAILED`, `AGENT_FAILED`, `FOUNDRY_BAD_OUTPUT` — real service call failed; message says why, nothing is fabricated |

Pure state/judge endpoints (mastery graph, problem detail, judging part of
submissions) work without Azure; agent-backed ones (†) require it.
