import { useCallback, useState } from 'react';

import { formatUserError } from '@/lib/errors';
import { getWorkoutCatalog } from '@/services/workoutCatalogService';
import type { CatalogWorkoutSummary } from '@/types/catalogWorkouts';

export function useOfficialWorkoutCatalog() {
  const [workouts, setWorkouts] = useState<CatalogWorkoutSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      setWorkouts(await getWorkoutCatalog());
    } catch (err) {
      setError(formatUserError(err, 'Failed to load official workouts'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  return {
    workouts,
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
