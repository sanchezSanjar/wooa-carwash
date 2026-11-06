import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Loads data whenever the screen gains focus and exposes `refresh` for pull-to-refresh.
 * `load` must be stable (a module function or wrapped in useCallback).
 */
export function useApi<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      try {
        setData(await load());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [load],
  );

  useFocusEffect(
    useCallback(() => {
      void run(false);
    }, [run]),
  );

  return { data, setData, error, loading, refreshing, refresh: () => run(true) };
}
