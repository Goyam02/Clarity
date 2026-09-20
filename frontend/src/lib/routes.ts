/**
 * Application route constants.
 */

/**
 * Target route when user skips registration on the personal details (signup) page.
 * Directly opens step 1 (Coding Profiles) of the original onboarding wizard.
 */
export const SKIP_SIGNUP_TARGET = '/onboarding';

/**
 * Proctored Mock Online Assessment route.
 */
export const MOCK_OA_ROUTE = '/mock-oa';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  ONBOARDING: '/onboarding',
  DASHBOARD: '/dashboard',
  DASHBOARD_GRAPH: '/dashboard/graph',
  MOCK_OA: '/mock-oa',
  MOCK_OA_SESSION: '/mock-oa/session',
  MOCK_OA_RESULT: '/mock-oa/result',
} as const;
