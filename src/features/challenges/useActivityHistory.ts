import { useCallback, useEffect, useState } from 'react';

import { formatUserError } from '@/lib/errors';
import { getActivityHistory } from '@/services/activityHistoryService';
import {
  ACTIVITY_HISTORY_PAGE_SIZE,
  type ActivityHistoryEntry,
  type ActivityHistoryFilter,
} from '@/types/activityHistory';

export function useActivityHistory(initialFilter: ActivityHistoryFilter = 'all') {
  const [filter, setFilter] = useState<ActivityHistoryFilter>(initialFilter);
  const [entries, setEntries] = useState<ActivityHistoryEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (nextFilter: ActivityHistoryFilter, nextOffset: number, append: boolean) => {
      const page = await getActivityHistory(nextFilter, ACTIVITY_HISTORY_PAGE_SIZE, nextOffset);

      setHasMore(page.length === ACTIVITY_HISTORY_PAGE_SIZE);
      setOffset(nextOffset + page.length);
      setEntries((current) => (append ? [...current, ...page] : page));
    },
    [],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await fetchPage(filter, 0, false);
    } catch (err) {
      setEntries([]);
      setHasMore(false);
      setOffset(0);
      setError(formatUserError(err, 'Failed to load history'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, filter]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || isLoading) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      await fetchPage(filter, offset, true);
    } catch (err) {
      setError(formatUserError(err, 'Failed to load more history'));
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchPage, filter, hasMore, isLoading, isLoadingMore, offset]);

  const changeFilter = useCallback((nextFilter: ActivityHistoryFilter) => {
    setFilter((current) => {
      if (current === nextFilter) {
        return current;
      }

      setEntries([]);
      setOffset(0);
      setHasMore(false);
      setError(null);
      setIsLoading(true);
      return nextFilter;
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    filter,
    changeFilter,
    entries,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    refresh,
    loadMore,
  };
}
