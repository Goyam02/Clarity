/**
 * Daily platform progress sync ("platform pulse", backend half):
 *
 * POST /users/me/platforms/sync refreshes every connected platform —
 * LeetCode (stored cookies) + Codeforces (public API) — blends the results
 * into the Mastery Model, and returns the solved-problems feed plus
 * `leetcode.expired` so the UI can ask for fresh cookies via a popup.
 *
 * Runs at most once per browser session, triggered at login/signup and
 * adopted by the dashboard if it is still in flight when the dashboard opens.
 */
import { usersApi, PlatformSyncResult } from '../api/endpoints';

const SYNCED_FLAG = 'clarity_platform_synced';

let inFlight: Promise<PlatformSyncResult | null> | null = null;

/**
 * Kick off the daily sync (idempotent per session). Safe to call from
 * login/signup pages and the dashboard — the second caller gets the same
 * in-flight promise instead of double-hitting LeetCode.
 */
export function startDailyPlatformSync(): Promise<PlatformSyncResult | null> {
  if (inFlight) return inFlight;
  sessionStorage.setItem(SYNCED_FLAG, '1');
  inFlight = usersApi.platformsSync().catch(() => null);
  return inFlight;
}

/** The in-flight sync promise, if one is currently running. */
export function dailySyncInFlight(): Promise<PlatformSyncResult | null> | null {
  return inFlight;
}
