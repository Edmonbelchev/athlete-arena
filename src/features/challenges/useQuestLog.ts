import { useCallback, useEffect, useState } from 'react';

import { formatUserError } from '@/lib/errors';
import { getQuestLog } from '@/services/questLogService';
import type { ChallengeHistoryEntry } from '@/types/challengeHistory';

export type QuestLogTab = 'completed' | 'incomplete';

export const QUEST_LOG_PAGE_SIZE = 12;

export function useQuestLog(initialTab: QuestLogTab = 'completed') {
  const [tab, setTab] = useState<QuestLogTab>(initialTab);
  const [entries, setEntries] = useState<ChallengeHistoryEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (nextTab: QuestLogTab, nextOffset: number, append: boolean) => {
      const page = await getQuestLog(nextTab === 'completed', QUEST_LOG_PAGE_SIZE, nextOffset);

      setHasMore(page.length === QUEST_LOG_PAGE_SIZE);
      setOffset(nextOffset + page.length);
      setEntries((current) => (append ? [...current, ...page] : page));
    },
    [],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await fetchPage(tab, 0, false);
    } catch (err) {
      setEntries([]);
      setHasMore(false);
      setOffset(0);
      setError(formatUserError(err, 'Failed to load quest log'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, tab]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || isLoading) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      await fetchPage(tab, offset, true);
    } catch (err) {
      setError(formatUserError(err, 'Failed to load more quests'));
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchPage, hasMore, isLoading, isLoadingMore, offset, tab]);

  const changeTab = useCallback((nextTab: QuestLogTab) => {
    setTab((current) => {
      if (current === nextTab) {
        return current;
      }

      setEntries([]);
      setOffset(0);
      setHasMore(false);
      setError(null);
      setIsLoading(true);
      return nextTab;
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    tab,
    changeTab,
    entries,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    refresh,
    loadMore,
  };
}
