import { useCallback, useEffect, useState } from 'react';

import { equipUserTitle, getMyTitles, syncUserTitles } from '@/services/titleService';
import type { TitleRecord } from '@/types/titles';
import { formatUserError } from '@/lib/errors';

export function useTitles(options?: { syncOnLoad?: boolean }) {
  const syncOnLoad = options?.syncOnLoad ?? true;
  const [titles, setTitles] = useState<TitleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (syncOnLoad) {
        await syncUserTitles();
      }
      const nextTitles = await getMyTitles();
      setTitles(nextTitles);
    } catch (err) {
      setError(formatUserError(err, 'Failed to load titles'));
    } finally {
      setIsLoading(false);
    }
  }, [syncOnLoad]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const equipTitle = useCallback(
    async (titleId: string | null) => {
      setIsUpdating(true);
      setError(null);

      try {
        await equipUserTitle(titleId);
        await refresh();
      } catch (err) {
        setError(formatUserError(err, 'Failed to update title'));
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [refresh],
  );

  const unlockedCount = titles.filter((title) => title.unlocked).length;

  return {
    titles,
    unlockedCount,
    totalCount: titles.length,
    isLoading,
    isUpdating,
    error,
    refresh,
    equipTitle,
  };
}
