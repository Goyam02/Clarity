import { MockOAPayload } from './types';
import { mockOAApi, MockOAAssessment } from '../api/endpoints';

/**
 * Data seam for Mock OA — everything comes from the backend:
 * - POST /mock-oa/start generates a fresh assessment (Question Generator agent)
 *   and stores it as a MockSession for the signed-in user.
 * - GET /mock-oa/assessments/{id} returns the problems, formats, and starters.
 *
 * `backendSessionId` is set when CODE RED launches a sized session; otherwise a
 * new standalone assessment is generated on entry.
 */
export async function fetchMockOA(backendSessionId?: string): Promise<MockOAPayload> {
  const sessionId = backendSessionId && backendSessionId.trim() !== ''
    ? backendSessionId
    : (await mockOAApi.start('', '')).session_id;
  return toPayload(await mockOAApi.assessment(sessionId));
}

/** Map the backend assessment shape onto the locked-environment payload. */
export function toPayload(a: MockOAAssessment): MockOAPayload {
  return {
    id: a.id,
    company: a.company || 'Practice',
    year: a.year || new Date().getFullYear(),
    durationMinutes: a.durationMinutes || 45,
    problems: (a.problems || []).map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: (p.difficulty === 'Easy' || p.difficulty === 'Hard'
        ? p.difficulty : 'Medium') as 'Easy' | 'Medium' | 'Hard',
      topicIds: p.topicIds?.length ? p.topicIds : ['algorithms'],
      statement: p.statement || '',
      inputFormat: p.inputFormat || 'Read from stdin.',
      outputFormat: p.outputFormat || 'Print to stdout.',
      constraints: p.constraints || [],
      examples: (p.examples || []).map((e) => ({
        input: String(e.input ?? ''),
        output: String(e.output ?? ''),
        explanation: String(e.explanation ?? ''),
      })),
      starter: {
        python: p.starter?.python || '',
        java: p.starter?.java || '',
        cpp: p.starter?.cpp || '',
      },
      sampleStdin: p.sampleStdin || ((p.examples || [])[0]?.input ?? ''),
    })),
  };
}

/**
 * Submits Mock OA results: closes the backend session (scored from submissions
 * + proctor events) and mirrors the session summary for the result page.
 */
export async function submitMockOA(
  sessionData: import('./types').MockOASessionData
): Promise<{ success: boolean; sessionId: string }> {
  try {
    sessionStorage.setItem('clarity_mock_oa_last_submission', JSON.stringify(sessionData));
  } catch {
    // ignore
  }
  try {
    await mockOAApi.end(sessionData.assessmentId);
  } catch {
    // The session may already be closed (timeout/double-submit); the result
    // page renders from the local summary either way.
  }
  return { success: true, sessionId: sessionData.assessmentId };
}
