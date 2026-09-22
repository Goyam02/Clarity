/** Typed endpoints for every FastAPI surface the SPA uses. */
import { api } from './client';

// --- shared shapes ----------------------------------------------------------

export interface AuthIssue {
  user_id: string;
  email: string;
  token: string;
}

export interface BackendUser {
  user_id: string;
  email: string;
  name: string;
  has_password?: boolean;
  google_linked?: boolean;
}

// --- auth -------------------------------------------------------------------

export const authApi = {
  register: (email: string, name: string, password: string) =>
    api.post<AuthIssue>('/auth/register', { email, name, password }),
  login: (email: string, password: string) =>
    api.post<AuthIssue>('/auth/login', { email, password }),
  me: () => api.get<BackendUser>('/auth/me'),
};

// --- onboarding -------------------------------------------------------------

export interface CalibrationQuestion {
  index: number;
  topic: string;
  difficulty: number;
  title: string;
  statement: string;
  test_cases: { input: string; output: string }[];
  expected_time: number;
}

export interface CalibrationSummary {
  signals: { pattern: string; correct: boolean; implied_mastery: number }[];
  total: number;
}

export const onboardingApi = {
  initialize: () => api.post<{ initialized_nodes: number }>('/onboarding/initialize'),  signals: (
    codeforces_handle: string,
    github_username: string,
    leetcode?: { session: string; csrf: string; username?: string },
    leetcode_profile?: string,
  ) =>
    api.post<{
      codeforces: unknown;
      github: unknown;
      resume: unknown;
      leetcode?: {
        connected: boolean;
        username: string;
        total_solved: number;
        signals: number;
        blended: { topic_id: string; solved: number; created: boolean;
                   previous: number; new: number; delta: number }[];
      } | null;
    }>(
      '/onboarding/signals', {
        codeforces_handle,
        github_username,
        resume_blob_ref: '',
        leetcode_session: leetcode?.session || '',
        leetcode_csrf: leetcode?.csrf || '',
        leetcode_username: leetcode?.username || '',
        leetcode_profile: leetcode_profile || '',
      }),
  focus: (body: {
    current_focus: string;
    target_companies: string[];
    placement_timeline: string;
    default_mood?: string;
    codeforces_handle?: string;
    github_username?: string;
    leetcode_profile?: string;
  }) => api.post<{ saved: boolean; preloaded: { company: string; patterns: string[] }[] }>(
      '/onboarding/focus', body),
  calibrationStart: () =>
    api.post<{ run_id: string; question: CalibrationQuestion }>('/onboarding/calibration/start'),
  calibrationAnswer: (run_id: string, correct: boolean, solve_time: number) =>
    api.post<{ done: boolean; question?: CalibrationQuestion; summary?: CalibrationSummary }>(
      '/onboarding/calibration/answer', { run_id, correct, solve_time }),
};

// --- users / settings (spec §9) ---------------------------------------------

export interface UserSettings {
  user_id: string;
  email: string;
  name: string;
  current_focus: string | null;
  placement_timeline: string | null;
  default_mood: string;
  codeforces_handle: string | null;
  github_username: string | null;
  resume_blob_ref: string | null;
  target_companies: string[];
  onboarding_complete: boolean;
  google_linked: boolean;
  has_password: boolean;
  leetcode?: LeetCodeStatus;
  skills: string[];
  projects: string[];
  created_at: string | null;
}

export interface CompanyRef {
  name: string;
  in_corpus: boolean;
  top_patterns: string[];
}

export interface LeetCodeStatus {
  connected: boolean;
  username: string | null;
  last_synced: string | null;
  last_error?: string | null;
  expired?: boolean;
}

export interface PlatformActivityItem {
  platform: string;
  slug: string;
  title: string;
  solved_at: string;
}

export interface PlatformSyncResult {
  synced_at: string;
  results: Record<string, { ok: boolean; error?: string; skipped?: string;
                           signals?: number; new_ac?: number }>;
  leetcode: LeetCodeStatus;
  activity: PlatformActivityItem[];
}

export interface LeetCodeConnectResult extends LeetCodeStatus {
  signals: number;
  total_solved?: number;
  blended?: { topic_id: string; solved: number; created: boolean;
              previous: number; new: number; delta: number }[];
}

export const usersApi = {
  me: () => api.get<UserSettings>('/users/me'),
  overview: () => api.get<ProfileOverview>('/users/me/overview'),
  updateSettings: (patch: Partial<Pick<UserSettings,
    'name' | 'current_focus' | 'placement_timeline' | 'default_mood' |
    'codeforces_handle' | 'github_username' | 'skills' | 'projects'>>) =>
    api.patch<UserSettings>('/users/me/settings', patch),
  companies: () => api.get<{ companies: CompanyRef[] }>('/users/me/companies'),
  addCompany: (name: string) =>
    api.post<{ companies: string[] }>('/users/me/companies', { name }),
  removeCompany: (name: string) =>
    api.delete<{ companies: string[] }>(`/users/me/companies/${encodeURIComponent(name)}`),
  exportData: () => api.get<Record<string, unknown>>('/users/me/export'),
  deleteAccount: () => api.delete<{ deleted: boolean }>('/users/me'),
  // LeetCode cookie pulls (docs/plans/plan-leetcode-pulls.md)
  leetcodeStatus: () => api.get<LeetCodeStatus>('/users/me/leetcode'),
  leetcodeConnect: (leetcode_session: string, leetcode_csrf: string,
                    leetcode_username = '') =>
    api.post<LeetCodeConnectResult>('/users/me/leetcode',
      { leetcode_session, leetcode_csrf, leetcode_username }),
  leetcodeRefresh: () =>
    api.post<LeetCodeConnectResult>('/users/me/leetcode/refresh'),
  leetcodeDisconnect: () =>
    api.delete<{ disconnected: boolean }>('/users/me/leetcode'),
  // Daily platform refresh + solved-problem feed (dashboard open)
  platformsSync: () => api.post<PlatformSyncResult>('/users/me/platforms/sync'),
  platformsActivity: () =>
    api.get<{ activity: PlatformActivityItem[]; leetcode: LeetCodeStatus;
              codeforces_synced_at: string | null }>('/users/me/platforms/activity'),
};

export interface ProfileOverview {
  profile: UserSettings;
  stats: { topics: number; strong_topics: number; practice_updates: number; interviews: number; assessments: number };
  strengths: { id: string; name: string; effective_mastery: number }[];
  recent_interviews: { session_id: string; completed_at: string; topic: string;
    company: string; correctness: number | null; feedback: string }[];
}

export const uploadsApi = {
  resume: (file: File) => {
    const formData = new FormData(); formData.append('file', file);
    return api.post<{ blob_ref: string; skills: string[]; projects: string[]; summary: string }>(
      '/uploads/resume', undefined, { formData });
  },
};

// --- daily plan (Home) -------------------------------------------------------

export interface PlanTask {
  id?: string;
  task_type: string;
  node_id: string;
  duration_minutes: number;
  title: string;
  detail?: Record<string, unknown>;
  status?: string;
}

export interface DailyPlan {
  plan_id: string;
  date: string;
  mood: string;
  time_available: number;
  tasks: PlanTask[];
}

export const dailyApi = {
  revision: (topicId: string) => api.get<RevisionSet>(`/daily/revision/${encodeURIComponent(topicId)}`),
  generatePlan: (mood: 'light' | 'normal' | 'push', time_available: number) =>
    api.post<{ plan_id: string; tasks: PlanTask[]; trace_id: string }>('/daily/plan',
      { mood, time_available }),
  todayPlan: () => api.get<{ plan: DailyPlan | null }>('/daily/plan'),
  setTaskStatus: (planId: string, taskIndex: number, status: string) =>
    api.patch<unknown>(`/daily/plan/${planId}/task`, { task_index: taskIndex, status }),
  logManual: (topic_id: string, title: string, link: string, notes: string,
              correctness: number, minutes_spent: number) =>
    api.post<unknown>('/daily/logs',
      { topic_id, title, link, notes, correctness, minutes_spent }),
};

export interface RevisionSet {
  topic_id: string;
  title: string;
  category: string;
  company: string;
  concept: string;
  problems: { title: string; url: string; difficulty: string;
              source: 'company_corpus' | 'curated'; topic_id: string }[];
}

// --- mastery / knowledge graph ------------------------------------------------

export interface MasteryNodeDto {
  id: string;
  topic_id: string;
  pattern: string;
  mastery_score: number;
  effective_mastery?: number;
  confidence: number;
  importance_weight: number;
  times_attempted: number;
  last_seen: string | null;
}

export interface MasteryEdgeDto {
  source: string;
  target: string;
  kind: string;
}

export const masteryApi = {
  nodes: () => api.get<{ nodes: MasteryNodeDto[] }>('/mastery/nodes'),
  graph: () => api.get<{ nodes: MasteryNodeDto[]; edges: MasteryEdgeDto[] }>('/mastery/graph'),
};

// --- CODE RED (spec §6) --------------------------------------------------------

export type CodeRedTaskSource = 'company_corpus' | 'web' | 'jd_profile' | 'mastery_diff' | 'planner';

export interface CodeRedTask {
  id: string;
  type: string;
  node_id: string;
  title: string;
  reason: string;
  duration_minutes: number;
  status: string;
  detail: {
    source?: CodeRedTaskSource;
    citation?: string;
    question_type?: string;
    [key: string]: unknown;
  };
}

export interface ClearScoreComponents {
  target_mastery: number;
  recent_performance: number;
  company_alignment: number;
  timed_performance: number;
  core_cs: number;
}

export interface CodeRedState {
  session_id: string;
  company: string;
  round_type: string;
  time_available_minutes: number;
  tasks: CodeRedTask[];
  clear_score: { score: number; components: ClearScoreComponents };
  drift?: { stale: boolean; last_verified: string; message: string };
}

export interface CompanyProfileDto {
  company: string;
  oa_patterns: string[];
  interview_patterns: string[];
  core_subjects: string[];
  difficulty: string;
  round_structure: string[];
  sources: string[];
  confidence: number;
  last_verified: string;
  drift: { stale: boolean; last_verified: string; message: string };
  problems: {
    title: string;
    url: string;
    difficulty: string;
    frequency: number;
    patterns: string[];
    origin: 'company_corpus' | 'web';
    source?: string;
    source_date?: string;
  }[];
  interview_questions: {
    question: string;
    type: string;
    round: string;
    url: string;
    origin: 'company_corpus' | 'web';
  }[];
  web_researched_at: string;
}

export const codeRedApi = {
  create: (company: string, job_description: string, time_available_minutes: number,
           round_type: 'OA' | 'Interview') =>
    api.post<CodeRedState>('/code-red',
      { company, job_description, time_available_minutes, round_type }),
  get: (sessionId: string) =>
    api.get<CodeRedState>(`/code-red/${sessionId}`),
  setTaskStatus: (sessionId: string, taskId: string, status: string) =>
    api.patch<CodeRedState>(`/code-red/${sessionId}/tasks/${taskId}`, { status }),
  clearScore: (sessionId: string) =>
    api.get<{ session_id: string; company: string; score: number;
              components: ClearScoreComponents }>(`/code-red/${sessionId}/clear-score`),
  startMockOA: (sessionId: string) =>
    api.post<{ session_id: string }>(`/code-red/${sessionId}/mock-oa`),
};

export const companiesApi = {
  lookup: (name: string) =>
    api.get<CompanyProfileDto>(`/companies/${encodeURIComponent(name)}`),
  drift: (name: string) =>
    api.get<{ stale: boolean; last_verified: string; message: string }>(
      `/companies/${encodeURIComponent(name)}/drift`),
};

// --- mock interviews -----------------------------------------------------------

export const interviewsApi = {
  create: () => api.post<{ session_id: string; status: string }>('/interviews'),
  postEvent: (sessionId: string, event_type: string, payload: Record<string, unknown>,
              response_mode: 'generate' | 'record_only' = 'generate') =>
    api.post<{ recorded: boolean; interviewer?: { utterance: string; hint_given: boolean } | null }>(
      `/interviews/${sessionId}/events`, { event_type, payload, response_mode }),
  transcript: (sessionId: string) =>
    api.get<{ session_id: string; transcript: { type: string; payload: Record<string, unknown> }[] }>(
      `/interviews/${sessionId}/transcript`),
  debrief: (sessionId: string) =>
    api.get<InterviewDebrief>(`/interviews/${sessionId}/debrief`),
};

export interface InterviewDebrief {
  session_id: string;
  correctness: number | null;
  communication_quality: number | null;
  feedback: string;
  mastery_deltas: { node: string; delta: number }[];
  answers: number;
  events: number;
  topic: string;
  company: string;
  mode: string;
}

// --- dashboard (Home page read model) ---------------------------------------

export const dashboardApi = {
  get: () => api.get<import('../dashboard/types').DashboardPayload>('/dashboard'),
};

// --- mock OA (locked environment, spec §8) -----------------------------------

export interface MockOAAssessmentProblem {
  id: string;
  title: string;
  difficulty: string;
  topicIds: string[];
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  examples: { input: string; output: string; explanation?: string }[];
  starter: { python: string; java: string; cpp: string };
  sampleStdin: string;
}

export interface MockOAAssessment {
  id: string;
  company: string;
  year: number;
  durationMinutes: number;
  status: string;
  problems: MockOAAssessmentProblem[];
}

export const mockOAApi = {
  start: (company = '', code_red_session_id = '') =>
    api.post<{ session_id: string; duration_minutes: number;
               problems: { problem_id: string; title: string }[] }>(
      '/mock-oa/start', { company, code_red_session_id }),
  assessment: (sessionId: string) =>
    api.get<MockOAAssessment>(`/mock-oa/assessments/${sessionId}`),
  event: (sessionId: string, event_type: string, payload: Record<string, unknown> = {}) =>
    api.post<{ recorded: boolean }>(`/mock-oa/${sessionId}/events`, { event_type, payload }),
  linkAttempt: (sessionId: string, attempt_id: string) =>
    api.post<{ linked: boolean }>(`/mock-oa/${sessionId}/link-attempt`,
      { event_type: 'SUBMISSION_LINKED', payload: { attempt_id } }),
  end: (sessionId: string) =>
    api.post<{ session_id: string; correctness: number; tests_passed: number;
               tests_total: number; distraction_events: number; problems: string[] }>(
      `/mock-oa/${sessionId}/end`),
};

// --- outcomes (OUTCOME LOOP) -----------------------------------------------------

export const outcomesApi = {
  log: (body: { company?: string; role?: string; round?: string;
                result: string; clear_score_at_time?: number; notes?: string }) =>
    api.post<{ outcome_id: string }>('/outcomes', body),
  list: () =>
    api.get<{ outcomes: { id: string; role: string; round: string; result: string;
                          clear_score_at_time: number }[] }>('/outcomes'),
};
