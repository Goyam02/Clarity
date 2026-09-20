import { MockOAPayload, MockOASessionData } from './types';
import { HARDCODED_GOOGLE_MOCK_OA } from './hardcoded';

/**
 * Data seam for Mock OA.
 * Currently returns the hardcoded Google 2026 assessment.
 * When backend endpoints are integrated, only this file needs to be updated.
 */
export async function fetchMockOA(_id: string = 'google-oa-2026'): Promise<MockOAPayload> {
  // Simulating async load for architecture readiness
  return Promise.resolve(HARDCODED_GOOGLE_MOCK_OA);
}

/**
 * Submits Mock OA results.
 * Stubbed to persist locally and return a success record.
 */
export async function submitMockOA(
  sessionData: MockOASessionData
): Promise<{ success: boolean; sessionId: string }> {
  try {
    sessionStorage.setItem('clarity_mock_oa_last_submission', JSON.stringify(sessionData));
  } catch {
    // ignore
  }
  return Promise.resolve({ success: true, sessionId: sessionData.assessmentId });
}
