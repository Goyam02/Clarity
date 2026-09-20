# CLARITY Frontend Architecture

Single-page app in `frontend/` (Vite + React 19 + TypeScript + Tailwind v4 +
react-router v7), wired to the FastAPI backend under `backend/`. The former
`frontend/Clarity_Frontend/` tree (Next-flavored, Express/Prisma auth server)
was merged in and deleted after the port verified green.

## Routes

| Route | Page | Spec |
|---|---|---|
| `/` | Landing (hero, pillar marquee, testimonials) | §2 |
| `/login`, `/signup` | Auth (FastAPI `/auth/*`, JWT) | §3 screen 1 |
| `/onboarding` | 7-screen "Maximum Real Signal" flow | §3 |
| `/dashboard` | Daily readiness + OA sandbox sections | §4 |
| `/dashboard/graph` | Obsidian-style force-directed Knowledge Graph | §5 |
| `/code-red` | Entry: company + JD + time + round (dark theme) | §6 |
| `/code-red/:sessionId` | Live checklist + CLEAR SCORE + why-tags | §6a |
| `/code-red/interview` | Split-screen code + interviewer channel | §6b |
| `/code-red/interview/:id/debrief` | Correctness/communication + graph CTA | §6b |
| `/mock-oa{,/session,/result}` | Proctored locked environment | §8 |
| `/settings` | Profile, accounts, targets, mood, data | §9 |
| `/dashboard-demo`, `/graph-demo` | Demo sandboxes | — |

## Onboarding (spec §3, 7 screens)

Account (route 1) → Resume upload (vision) → Profile screenshot scan (vision) →
Real platform pulls (Codeforces/GitHub public APIs via `/onboarding/signals`) →
Adaptive calibration quiz (`/onboarding/calibration/*`) → Skill-confidence
sliders → Focus & targets (`/onboarding/focus`) → Graph reveal.
Self-report is deliberately paired with ground-truth signals; every optional
signal can be skipped without blocking.

## Backend wiring

- `src/lib/api/client.ts` — typed fetch wrapper: base URL
  `VITE_API_BASE_URL` (default `http://localhost:8000`), `Authorization:
  Bearer <jwt>` with `X-User-Id` dev fallback, errors normalized to `ApiError
  {status, code, message, request_id}` from the backend's error envelope.
- `src/lib/api/endpoints.ts` — typed wrappers for auth, onboarding/calibration,
  users/settings, daily plan, mastery graph, CODE RED (create/get/toggle/
  clear-score/mock-oa), companies (CSV+web corpus, drift), interviews
  (events/transcript/debrief), outcomes.
- `AuthContext` verifies the stored token against `GET /auth/me` and keeps a
  graceful local fallback when the backend is unreachable (guest mode remains
  available unless `NEXT_PUBLIC_ENFORCE_AUTH=true`).

## Structure

```
frontend/src/
  pages/            route-level pages (Landing, Dashboard, Graph, Settings, MockOA*, codered/)
  components/       auth/, dashboard/, graph/, mock-oa/ (+ Logos, Testimonials)
  onboarding/       7-screen wizard, steps/, components/, data/
  hooks/            useDashboard (fetch + focus refetch + error/retry)
  lib/
    api/            client.ts (transport) + endpoints.ts (typed surface)
    dashboard/      contract types, runtime validator, mock payloads
    graph/          catalog (31 topics), deterministic generator, theme
    mock-oa/        session machine, hardcoded Google OA, runtime, reference solves
    proctor/        browser proctor + recording store
    coddy/          embed URL builder
    auth/           zod validation, AuthContext, guest/enforce flags
```

Server-side pieces of the old tree (Express `server.ts`, Prisma `db.ts`,
PBKDF2 password hashing, session cookies, Google OAuth callback routes) were
**dropped, not ported** — the FastAPI backend owns all of that (`/auth`,
`/uploads`, JWT issuing, Google OAuth server-side).

## Commands

```
npm run dev      # vite on :3000
npm run lint     # tsc --noEmit (also the typecheck gate)
npm test         # vitest (graph generation unit tests)
npm run build    # production bundle -> dist/
```

Dev proxying: the SPA calls the API directly at `VITE_API_BASE_URL`; set
`VITE_API_BASE_URL=http://localhost:8000` in `.env.local` (CORS on the backend
allows all origins in development).
