import { useCallback, useEffect, useState } from 'react';

import { formatUserError } from '@/lib/errors';
import { getActiveFriendChallengeCount } from '@/services/friendChallengeService';

export function useActiveFriendChallengeCount() {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);

    try {
      setCount(await getActiveFriendChallengeCount());
    } catch (err) {
      setCount(0);
      setError(formatUserError(err, 'Failed to load friend challenges'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { count, isLoading, error, refresh };
}
