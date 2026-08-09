import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth';
import { formatUserError } from '@/lib/errors';
import { getDailyChallengeHome } from '@/services/challengeService';
import type { DailyChallengeHome } from '@/types';

interface UseDailyChallengeResult {
  missions: DailyChallengeHome[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDailyChallenge(): UseDailyChallengeResult {
  const { session } = useAuth();
  const [missions, setMissions] = useState<DailyChallengeHome[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setMissions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextMissions = await getDailyChallengeHome();
      setMissions(nextMissions);
    } catch (err) {
      setMissions([]);
      setError(formatUserError(err, 'Failed to load daily missions'));
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    missions,
    isLoading,
    error,
    refresh,
  };
}
