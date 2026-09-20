/**
 * Authentication configuration and feature flags.
 *
 * Route protection is guarded by NEXT_PUBLIC_ENFORCE_AUTH.
 * When unset or 'false' (default), guests can access /onboarding, /dashboard,
 * and /dashboard/graph without an active account or session.
 * Setting NEXT_PUBLIC_ENFORCE_AUTH='true' enables strict route protection.
 */
export function isAuthEnforced(): boolean {
  // Check Node/Next/Vitest process.env
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ENFORCE_AUTH !== undefined) {
    return process.env.NEXT_PUBLIC_ENFORCE_AUTH === 'true';
  }

  // Check Vite client-side import.meta.env
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_ENFORCE_AUTH !== undefined) {
      // @ts-ignore
      return import.meta.env.NEXT_PUBLIC_ENFORCE_AUTH === 'true';
    }
  } catch {
    // ignore
  }

  return false;
}
