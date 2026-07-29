import { useCallback, useEffect, useState } from 'react';

import { getChallengeById, startChallenge } from '@/services/challengeService';
import { formatUserError } from '@/lib/errors';
import type { DailyChallenge } from '@/types';

interface UseChallengeResult {
  challenge: DailyChallenge | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useChallenge(challengeId: string | undefined): UseChallengeResult {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(challengeId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!challengeId) {
      setChallenge(null);
      setIsLoading(false);
      setError('Challenge not found');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const loadedChallenge = await getChallengeById(challengeId);

      if (!loadedChallenge) {
        setChallenge(null);
        setError('Challenge not found');
        return;
      }

      if (loadedChallenge.status === 'pending') {
        const startedChallenge = await startChallenge(loadedChallenge.id);
        setChallenge(startedChallenge);
        return;
      }

      setChallenge(loadedChallenge);
    } catch (err) {
      setChallenge(null);
      setError(formatUserError(err, 'Failed to load challenge'));
    } finally {
      setIsLoading(false);
    }
  }, [challengeId]);

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
