# CLARITY API Contracts (v1)

Base: `http://localhost:8000/api/v1`. Auth: `Authorization: Bearer <jwt>`
(from `POST /auth/register`) or `X-User-Id` (local dev only). All errors:
`{"error": {"code", "message", "request_id"}}`.

| Method & Path | Req | Resp |
|---|---|---|
| `POST /auth/register` `{email,name}` | — | `{user_id,email,token}` |
| `GET /users/me`, `GET /health`, `GET /api/v1/health` | auth | status objects |
| `POST /onboarding/signals` `{codeforces_handle,github_username,resume_blob_ref}` | auth | `{codeforces,github,resume}` (parallel) |
| `POST /onboarding/initialize` | auth | `{initialized_nodes}` |
| `POST /onboarding/focus` `{current_focus,target_companies[],...}` | auth | `{saved,preloaded[]}` |
| `POST /onboarding/calibration/start` | auth | `{run_id,question}` |
| `POST /onboarding/calibration/answer` `{run_id,correct,solve_time}` | auth | `{done,question?\|summary?}` |
| `GET /mastery/nodes` | auth | `{nodes[]}` (with `effective_mastery`) |
| `GET /mastery/graph` | auth | `{nodes[],edges[]}` read-only |
| `POST /mastery/update` `{topic_id,correctness,...}` | auth | `{node_id,previous,new,delta}` |
| `GET /mastery/history/{node_id}` | auth | `{history[]}` |
| `POST /daily/plan` `{mood:light\|normal\|push,time_available}` | auth | `{plan_id,tasks[],trace_id}` |
| `POST /problems/generate` `{pattern,topic_id,difficulty,company}` | auth | problem + `test_cases` + `validation` |
| `GET /problems`, `GET /problems/{id}` | auth | list / detail |
| `POST /submissions/attempts` `{problem_id}` | auth | `{attempt_id}` |
| `POST /submissions` `{attempt_id,language,source_code,explanation?}` | auth | `{judge,evaluation,mastery,trace_id}` |
| `POST /code-red` `{company,job_description,time_available_minutes,round_type}` | auth | `{session_id,tasks[],clear_score,drift}` |
| `GET /code-red/{id}/clear-score` | auth | `{score,components{target_mastery,recent_performance,company_alignment,timed_performance,core_cs}}` |
| `GET /companies/{name}` | auth | company profile + `drift` |
| `GET /companies/{name}/drift` | auth | `{stale,last_verified,message}` |
| `POST /interviews` | auth | `{session_id,status}` |
| `POST /interviews/{id}/events` `{event_type,payload}` | auth | `{recorded,interviewer?}` |
| `GET /interviews/{id}/transcript` | auth | `{transcript[]}` |
| `GET /interviews/{id}/debrief` | auth | `{correctness,communication_quality,mastery_deltas[]}` |
| `POST /outcomes`, `GET /outcomes` | auth | outcome loop (calibrates future CLEAR SCORE) |

Status codes: 200 ok, 401 missing/invalid auth, 404 unknown entity
(`TOPIC_NOT_FOUND`, `SESSION_NOT_FOUND`, `ATTEMPT_NOT_FOUND`), 500 `INTERNAL_ERROR`.
Frontend can build fully against `CLARITY_AI_MODE=mock` without Azure.
