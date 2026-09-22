import { useCallback, useState } from 'react';

import { formatUserError } from '@/lib/errors';
import { getMyCustomWorkoutTemplates } from '@/services/customWorkoutService';
import type { CustomWorkoutTemplateSummary } from '@/types/customWorkouts';

export function useCustomWorkoutTemplates() {
  const [templates, setTemplates] = useState<CustomWorkoutTemplateSummary[]>([]);
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
      setTemplates(await getMyCustomWorkoutTemplates());
    } catch (err) {
      setError(formatUserError(err, 'Failed to load workouts'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  return {
    templates,
    setTemplates,
    isLoading,
    isRefreshing,
    error,
    setError,
    refresh,
  };
}
