import { useState, useEffect, useCallback } from 'react';
import { PlatformActivityItem, LeetCodeStatus } from '../lib/api/endpoints';
import { dailySyncInFlight, startDailyPlatformSync } from '../lib/platforms/dailySync';

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
 * - The sync itself fires once per browser session at login/signup (see
 *   lib/platforms/dailySync.ts). This hook picks up that in-flight sync when
 *   the dashboard opens, or falls back to GET /users/me/platforms/activity.
 * - Surfaces leetcode.expired so the UI can raise the cookies-expired popup.
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

  const readFeed = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await (await import('../lib/api/endpoints')).usersApi.platformsActivity();
      setState({
        loading: false,
        activity: res.activity,
        leetcode: res.leetcode,
        codeforcesSyncedAt: res.codeforces_synced_at,
        syncedThisSession: false,
        error: null,
      });
    } catch {
      // Platform pulse is best-effort; never block the dashboard.
      setState((s) => ({ ...s, loading: false, error: null }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const running = dailySyncInFlight();
    if (running) {
      void running.then((res) => {
        if (res) {
          setState({
            loading: false,
            activity: res.activity,
            leetcode: res.leetcode,
            codeforcesSyncedAt: null,
            syncedThisSession: true,
            error: null,
          });
        } else {
          void readFeed();
        }
      });
    } else {
      void readFeed();
    }
  }, [enabled, readFeed]);

  const refetch = useCallback(() => {
    void startDailyPlatformSync().then((res) => {
      if (res) {
        setState({
          loading: false,
          activity: res.activity,
          leetcode: res.leetcode,
          codeforcesSyncedAt: null,
          syncedThisSession: true,
          error: null,
        });
      } else {
        void readFeed();
      }
    });
  }, [readFeed]);

  return state;
}
