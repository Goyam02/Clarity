import { DashboardPayload, RevisionTopic, AdaptiveProblem, Band, Reason } from './types';
import { createMockDashboardPayload } from './mock';

const VALID_BANDS: Set<Band> = new Set(['weak', 'developing', 'strong']);
const VALID_REASONS: Set<Reason> = new Set([
  'revision_due',
  'needs_practice',
  'unmet_prerequisite',
  'past_mistakes',
  'partial_mastery',
]);

/**
 * Hand-written type guard to strictly validate DashboardPayload at runtime
 */
export function isDashboardPayload(data: unknown): data is DashboardPayload {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  // Check user
  if (!obj.user || typeof obj.user !== 'object') return false;
  if (typeof (obj.user as Record<string, unknown>).name !== 'string') return false;

  // Check target
  if (!obj.target || typeof obj.target !== 'object') return false;
  const target = obj.target as Record<string, unknown>;
  if (typeof target.company !== 'string') return false;
  if (typeof target.oaDate !== 'string') return false;
  if (typeof target.daysLeft !== 'number') return false;

  // Check clearScore
  if (!obj.clearScore || typeof obj.clearScore !== 'object') return false;
  const clearScore = obj.clearScore as Record<string, unknown>;
  if (typeof clearScore.value !== 'number') return false;
  if (typeof clearScore.label !== 'string') return false;

  // Check today
  if (!obj.today || typeof obj.today !== 'object') return false;
  const today = obj.today as Record<string, unknown>;
  if (typeof today.generatedAt !== 'string') return false;
  if (typeof today.totalMinutes !== 'number') return false;
  if (!Array.isArray(today.topics)) return false;
  if (!Array.isArray(today.adaptiveSet)) return false;

  // Validate topics
  for (const t of today.topics) {
    if (!t || typeof t !== 'object') return false;
    const topic = t as Record<string, unknown>;
    if (typeof topic.id !== 'string') return false;
    if (typeof topic.label !== 'string') return false;
    if (typeof topic.subject !== 'string') return false;
    if (!VALID_BANDS.has(topic.band as Band)) return false;
    if (typeof topic.rating !== 'number') return false;
    if (typeof topic.ratingMax !== 'number') return false;
    if (!['High', 'Medium', 'Low'].includes(topic.priority as string)) return false;
    if (!Array.isArray(topic.reasons)) return false;
    if (!Array.isArray(topic.subtopics)) return false;
    if (typeof topic.whySelected !== 'string') return false;
    if (typeof topic.learningGoal !== 'string') return false;
    if (typeof topic.estimatedMinutes !== 'number') return false;
    if (!Array.isArray(topic.actions)) return false;

    // oaRelevance is either null or { askedCount: number, sampleSize: number }
    if (topic.oaRelevance !== null) {
      if (!topic.oaRelevance || typeof topic.oaRelevance !== 'object') return false;
      const oar = topic.oaRelevance as Record<string, unknown>;
      if (typeof oar.askedCount !== 'number' || typeof oar.sampleSize !== 'number') return false;
    }
  }

  // Validate adaptiveSet
  for (const p of today.adaptiveSet) {
    if (!p || typeof p !== 'object') return false;
    const prob = p as Record<string, unknown>;
    if (typeof prob.id !== 'string') return false;
    if (typeof prob.title !== 'string') return false;
    if (!['Easy', 'Medium', 'Hard'].includes(prob.difficulty as string)) return false;
    if (typeof prob.topicId !== 'string') return false;
    if (typeof prob.url !== 'string') return false;
  }

  // Check sandbox
  if (!obj.sandbox || typeof obj.sandbox !== 'object') return false;
  const sandbox = obj.sandbox as Record<string, unknown>;
  if (typeof sandbox.poolTitle !== 'string') return false;
  if (typeof sandbox.verifiedQuestions !== 'number') return false;
  if (typeof sandbox.recurrenceNote !== 'string') return false;
  if (typeof sandbox.durationMinutes !== 'number') return false;
  if (typeof sandbox.proctored !== 'boolean') return false;
  if (!Array.isArray(sandbox.expect)) return false;
  if (typeof sandbox.launchUrl !== 'string') return false;

  return true;
}

/**
 * Fetch dashboard data from the backend API, with fallback to mock data when
 * NEXT_PUBLIC_USE_MOCKS is enabled or when no backend is available.
 */
export async function fetchDashboard(): Promise<DashboardPayload> {
  const isMockMode =
    typeof process !== 'undefined' &&
    (process.env?.NEXT_PUBLIC_USE_MOCKS === 'true' || process.env?.VITE_USE_MOCKS === 'true');

  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : null;
  const useMocks =
    isMockMode ||
    metaEnv?.NEXT_PUBLIC_USE_MOCKS === 'true' ||
    metaEnv?.VITE_USE_MOCKS === 'true';

  const apiBaseUrl =
    (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_API_BASE_URL || process.env?.VITE_API_BASE_URL)) ||
    metaEnv?.NEXT_PUBLIC_API_BASE_URL ||
    metaEnv?.VITE_API_BASE_URL ||
    '';

  // If explicit mock mode or no api base url configured, return verified mock payload
  if (useMocks || !apiBaseUrl) {
    // Return mock payload created from user's onboarding state
    return createMockDashboardPayload();
  }

  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('clarity_auth_token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/dashboard`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Dashboard API responded with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!isDashboardPayload(data)) {
      throw new Error('Dashboard API returned an invalid response schema violating the typed contract.');
    }

    return data;
  } catch (err) {
    // If running in development and API is not reachable, fall back to mock data
    if (metaEnv?.DEV || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production')) {
      console.warn('Backend API unreachable; falling back to local onboarding-derived mock data:', err);
      return createMockDashboardPayload();
    }
    throw err;
  }
}
