# CLARITY API Contracts (v1)

Base: `http://localhost:8000/api/v1`. Auth: `Authorization: Bearer <jwt>`
(from `POST /auth/register`) or `X-User-Id` (local dev only). All errors:
`{"error": {"code", "message", "request_id"}}`.

| Method & Path | Req | Resp |
|---|---|---|
| `POST /auth/register` `{email,name}` | — | `{user_id,email,token}` |
| `GET /users/me`, `GET /health`, `GET /api/v1/health` | auth | status objects |
| `POST /onboarding/signals` `{codeforces_handle,github_username,resume_blob_ref,leetcode_profile?,leetcode_session?,leetcode_csrf?,leetcode_username?}` | auth | `{codeforces,github,resume,leetcode?,codeforces_ingested}` (parallel; LeetCode cookies verified, persisted encrypted, blended into mastery) |
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
| `POST /submissions` `{attempt_id,language,source_code,explanation?}` | auth | `{judge,evaluation,mastery,trace_id}` — judge is Judge0 CE (self-hosted compose service; Python/Java/C++/SQL) when `JUDGE0_BASE_URL` set, else LocalJudge subprocess |
| `GET /users/me/leetcode` | auth | `{connected,username,last_synced,last_error?,expired?}` |
| `POST /users/me/leetcode` `{leetcode_session,leetcode_csrf,leetcode_username?}` | auth | connect: verify + store encrypted + pull + ingest |
| `POST /users/me/leetcode/refresh` | auth | re-pull with stored cookies (rate-limited 1/hr/user) |
| `DELETE /users/me/leetcode` | auth | wipe stored cookies (signals stay) |
| `POST /users/me/platforms/sync` | auth | `{synced_at,results{},leetcode,activity[]}` daily refresh (LeetCode + Codeforces) |
| `GET /users/me/platforms/activity` | auth | `{activity[],leetcode,codeforces_synced_at}` solved-problem feed |
| `POST /code-red` `{company,job_description,time_available_minutes,round_type}` | auth | `{session_id,tasks[],clear_score,drift}`; tasks carry `title`, and `detail.source` ∈ `company_corpus\|web\|jd_profile\|mastery_diff\|planner` (Interview rounds add web-sourced `explain_back` items) |
| `GET /code-red/{id}/clear-score` | auth | `{score,components{target_mastery,recent_performance,company_alignment,timed_performance,core_cs}}` |
| `GET /companies/{name}` | auth | company profile + `drift` + `problems[]` (CSV + web-researched, each with `origin`: `company_corpus\|web`, web items carry `source`/`source_date` citations) + `interview_questions[]` (web-researched) + `web_researched_at` |
| `GET /companies/{name}/drift` | auth | `{stale,last_verified,message}` |
| `POST /interviews` | auth | `{session_id,status}` |
| `POST /interviews/{id}/events` `{event_type,payload}` | auth | `{recorded,interviewer?}` — the Gemini voice interview (frontend) mirrors `SESSION_STARTED`, `INTERVIEWER_SPEECH`, `CANDIDATE_SPEECH`, `HINT_GIVEN` here; `CANDIDATE_SPEECH`/`HINT_REQUESTED`/`CODE_CHANGED` also trigger a backend interviewer turn |
| `GET /interviews/{id}/transcript` | auth | `{transcript[]}` |
| `GET /interviews/{id}/debrief` | auth | `{correctness,communication_quality,mastery_deltas[]}` |
| `POST /outcomes`, `GET /outcomes` | auth | outcome loop (calibrates future CLEAR SCORE) |
| `GET /dashboard` | auth | Home read model: `{user,target,clearScore,today,sandbox}` — computed from the Mastery Model + company research; topics rank nodes by urgency (mastery × importance × staleness); no client-side mock fallback |
| `POST /mock-oa/start` `{company?,code_red_session_id?}` | auth | `{session_id,duration_minutes,problems[]}` — Question Generator builds a fresh assessment; sized to the CODE RED budget when linked |
| `GET /mock-oa/assessments/{id}` | auth | full locked-environment payload: `{id,company,year,durationMinutes,status,problems[{statement,inputFormat,outputFormat,constraints,examples,starter,sampleStdin}]}` (user-scoped) |
| `POST /mock-oa/{id}/end` | auth | `{correctness,tests_passed,tests_total,distraction_events}` — 409 on double-end |

Status codes: 200 ok, 401 missing/invalid auth, 404 unknown entity
(`TOPIC_NOT_FOUND`, `SESSION_NOT_FOUND`, `ATTEMPT_NOT_FOUND`), 500
`INTERNAL_ERROR` / `FOUNDRY_NOT_CONFIGURED` (Azure env missing — see
`docs/azure-setup.md`), 502 `FOUNDRY_UNAVAILABLE` / `AGENT_FAILED` (real
service call failed; message says why, no content is fabricated), 502
`JUDGE_UNAVAILABLE` / 504 `JUDGE_TIMEOUT` (Judge0 unreachable or over budget).
Agent-backed endpoints require a configured Foundry project; pure
state/judge endpoints (mastery graph, submissions judging, platform pulls)
work regardless.
