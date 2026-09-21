/**
 * Type definitions for the Mock Online Assessment module.
 */

export type SupportedLanguage = 'python' | 'java' | 'cpp';

export type ProblemSubmissionStatus = 'solved' | 'partially_solved' | 'not_attempted';

export type AssessmentOutcome = 'completed' | 'timeout' | 'violation_limit';

export interface MockOAExample {
  input: string;
  output: string;
  explanation: string;
}

export interface MockOAProblem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topicIds: string[];
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  examples: MockOAExample[];
  starter: {
    python: string;
    java: string;
    cpp: string;
  };
  sampleStdin: string;
}

export interface MockOAPayload {
  id: string;
  company: string;
  year: number;
  durationMinutes: number;
  problems: MockOAProblem[];
}

export interface MockOAViolation {
  id: string;
  timestamp: number;
  type: 'TAB_HIDDEN' | 'FULLSCREEN_EXIT' | 'SHARE_STOPPED' | 'PAGE_RELOAD';
  message: string;
}

export interface MockOASessionData {
  assessmentId: string;
  startedAt: number;
  endsAt: number;
  currentProblemId: string;
  selectedLanguages: Record<string, SupportedLanguage>;
  timeSpentSeconds: Record<string, number>;
  statuses: Record<string, ProblemSubmissionStatus>;
  violations: MockOAViolation[];
  active: boolean;
  outcome?: AssessmentOutcome;
  finishedAt?: number;
}
