import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth';
import { formatUserError } from '@/lib/errors';
import { getOrCreateDailyChallenge } from '@/services/challengeService';
import type { DailyChallenge } from '@/types';

interface UseDailyChallengeResult {
  challenge: DailyChallenge | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDailyChallenge(): UseDailyChallengeResult {
  const { session } = useAuth();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setChallenge(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextChallenge = await getOrCreateDailyChallenge();
      setChallenge(nextChallenge);
    } catch (err) {
      setChallenge(null);
      setError(formatUserError(err, 'Failed to load daily challenge'));
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    challenge,
    isLoading,
    error,
    refresh,
  };
}
