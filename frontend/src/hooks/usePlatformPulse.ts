import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardPayload } from '../lib/dashboard/types';
import { fetchDashboard } from '../lib/dashboard/api';
import { usersApi, PlatformActivityItem, LeetCodeStatus } from '../lib/api/endpoints';

export interface PlatformPulse {
  loading: boolean;
  activity: PlatformActivityItem[];
  leetcode: LeetCodeStatus | null;
  codeforcesSyncedAt: string | null;
  syncedThisSession: boolean;
  error: string | null;
}

/**
 * Daily platform progress ("platform pulse"):
 * - On first load per browser session, POST /users/me/platforms/sync refreshes
 *   every connected platform (LeetCode cookies + Codeforces public API) so
 *   today's solved problems show up the moment the dashboard opens.
 * - Falls back to GET /users/me/platforms/activity when the sync was recent.
 * - Surfaces leetcode.expired so the UI can ask for fresh cookies.
 */
export function usePlatformPulse(enabled = true): PlatformPulse {
  const [state, setState] = useState<PlatformPulse>({
    loading: enabled,
    activity: [],
    leetcode: null,
    codeforcesSyncedAt: null,
    syncedThisSession: false,
    error: null,
  });
  const startedRef = useRef(false);

  const load = useCallback(async (sync: boolean) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      if (sync) {
        const res = await usersApi.platformsSync();
        setState({
          loading: false,
          activity: res.activity,
          leetcode: res.leetcode,
          codeforcesSyncedAt: null,
          syncedThisSession: true,
          error: null,
        });
      } else {
        const res = await usersApi.platformsActivity();
        setState({
          loading: false,
          activity: res.activity,
          leetcode: res.leetcode,
          codeforcesSyncedAt: res.codeforces_synced_at,
          syncedThisSession: false,
          error: null,
        });
      }
    } catch {
      // Platform pulse is best-effort; never block the dashboard.
      setState((s) => ({ ...s, loading: false, error: null }));
    }
  }, []);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    // Sync once per tab session; afterwards just read the feed.
    const alreadySynced = sessionStorage.getItem('clarity_platform_synced') === '1';
    if (alreadySynced) {
      void load(false);
    } else {
      sessionStorage.setItem('clarity_platform_synced', '1');
      void load(true);
    }
  }, [enabled, load]);

  const refetch = useCallback(() => load(true), [load]);
  void refetch; // exposed for manual "Refresh now" buttons

  return state;
}
