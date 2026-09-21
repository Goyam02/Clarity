import { MockOASessionData, SupportedLanguage, ProblemSubmissionStatus, AssessmentOutcome, MockOAProblem, MockOAViolation } from './types';

export type MachineState = 'idle' | 'preflight' | 'active' | 'submitting' | 'finished';

export const SESSION_STORAGE_KEY = 'clarity_mock_oa_session';
export const MACHINE_STATE_KEY = 'clarity_mock_oa_machine_state';

/**
 * Valid state transitions for the Mock OA state machine
 */
const VALID_TRANSITIONS: Record<MachineState, MachineState[]> = {
  idle: ['preflight'],
  preflight: ['idle', 'active'],
  active: ['submitting', 'finished'],
  submitting: ['active', 'finished'],
  finished: ['idle'],
};

export function canTransition(from: MachineState, to: MachineState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getStoredState(): MachineState {
  if (typeof window === 'undefined') return 'idle';
  try {
    const raw = sessionStorage.getItem(MACHINE_STATE_KEY);
    if (raw && ['idle', 'preflight', 'active', 'submitting', 'finished'].includes(raw)) {
      return raw as MachineState;
    }
  } catch {
    // ignore
  }
  return 'idle';
}

export function setStoredState(state: MachineState): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(MACHINE_STATE_KEY, state);
  } catch {
    // ignore
  }
}

export function getStoredSession(): MockOASessionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveStoredSession(session: MockOASessionData | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (session) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function clearMockOASession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(MACHINE_STATE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Initializes a new session with absolute endsAt
 */
export function initializeSession(
  assessmentId: string,
  durationMinutes: number,
  problems: MockOAProblem[]
): MockOASessionData {
  const now = Date.now();
  const endsAt = now + durationMinutes * 60 * 1000;

  const selectedLanguages: Record<string, SupportedLanguage> = {};
  const timeSpentSeconds: Record<string, number> = {};
  const statuses: Record<string, ProblemSubmissionStatus> = {};

  problems.forEach((p) => {
    selectedLanguages[p.id] = 'python';
    timeSpentSeconds[p.id] = 0;
    statuses[p.id] = 'not_attempted';
  });

  const session: MockOASessionData = {
    assessmentId,
    startedAt: now,
    endsAt,
    currentProblemId: problems[0]?.id || '',
    selectedLanguages,
    timeSpentSeconds,
    statuses,
    violations: [],
    active: true,
  };

  saveStoredSession(session);
  setStoredState('active');
  return session;
}
