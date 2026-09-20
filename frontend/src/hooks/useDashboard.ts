import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardPayload } from '../lib/dashboard/types';
import { fetchDashboard } from '../lib/dashboard/api';

interface UseDashboardResult {
  data: DashboardPayload | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useDashboard(initialPayload?: DashboardPayload | null): UseDashboardResult {
  const [data, setData] = useState<DashboardPayload | null>(initialPayload ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialPayload);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);

    try {
      const payload = await fetchDashboard();
      if (isMountedRef.current) {
        setData(payload);
        setIsLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to load dashboard payload'));
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (!initialPayload) {
      loadData(true);
    } else {
      setData(initialPayload);
      setIsLoading(false);
    }

    // Refetch on window focus so returning from Update Calibration shows fresh data
    const handleFocus = () => {
      // Background refetch without showing full page skeleton if data already exists
      loadData(false);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadData, initialPayload]);

  return {
    data,
    isLoading,
    error,
    refetch: () => loadData(true),
  };
}
