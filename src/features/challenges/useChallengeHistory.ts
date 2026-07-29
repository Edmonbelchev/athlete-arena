import { useCallback, useEffect, useState } from 'react';

import { formatUserError } from '@/lib/errors';
import { getChallengeHistory } from '@/services/challengeHistoryService';
import type { ChallengeHistoryEntry } from '@/types/challengeHistory';

export function useChallengeHistory(limit = 50) {
  const [entries, setEntries] = useState<ChallengeHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const history = await getChallengeHistory(limit);
      setEntries(history);
    } catch (err) {
      setError(formatUserError(err, 'Failed to load challenge history'));
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, isLoading, error, refresh };
}
