import { useEffect, useMemo, useState } from 'react';

export interface PagedList<T> {
  visibleItems: T[];
  /** Items not shown yet. */
  remainingCount: number;
  hasMore: boolean;
  /** More than the first page is showing - offer "Show less". */
  canCollapse: boolean;
  showMore: () => void;
  collapse: () => void;
}

/** First `visibleCount` items, plus what is left to reveal. Pure, for tests. */
export function pageItems<T>(items: readonly T[], visibleCount: number) {
  const visibleItems = items.slice(0, Math.max(0, visibleCount));
  return { visibleItems, remainingCount: Math.max(0, items.length - visibleItems.length) };
}

/**
 * Shows a long list a page at a time: the first `pageSize` items, then `pageSize` more per
 * "Show more". Collapses back to the first page when the list empties out, so a section that
 * clears and refills starts short again.
 */
export function usePagedList<T>(items: readonly T[], pageSize: number): PagedList<T> {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    if (items.length <= pageSize) {
      setVisibleCount(pageSize);
    }
  }, [items.length, pageSize]);

  const { visibleItems, remainingCount } = useMemo(() => pageItems(items, visibleCount), [items, visibleCount]);

  return {
    visibleItems,
    remainingCount,
    hasMore: remainingCount > 0,
    canCollapse: visibleCount > pageSize && items.length > pageSize,
    showMore: () => setVisibleCount((current) => current + pageSize),
    collapse: () => setVisibleCount(pageSize),
  };
}
