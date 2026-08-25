import { useEffect, useMemo, useState } from 'react';

import {
  buildWorkoutBrowseRows,
  filterWorkoutsByTitle,
  filterWorkoutsByType,
  getAvailableWorkoutTypes,
  sortWorkoutsForBrowse,
  WORKOUT_BROWSE_PAGE_SIZE,
  type WorkoutBrowseItem,
  type WorkoutBrowseRow,
  type WorkoutTypeFilter,
} from '@/features/workouts/workoutBrowseList';

interface UseWorkoutBrowseListOptions<T extends WorkoutBrowseItem> {
  items: T[];
  getKey: (item: T) => string;
  pageSize?: number;
}

export function useWorkoutBrowseList<T extends WorkoutBrowseItem>({
  items,
  getKey,
  pageSize = WORKOUT_BROWSE_PAGE_SIZE,
}: UseWorkoutBrowseListOptions<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<WorkoutTypeFilter>('all');
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const availableTypes = useMemo(() => getAvailableWorkoutTypes(items), [items]);

  const filteredItems = useMemo(() => {
    const byTitle = filterWorkoutsByTitle(items, searchQuery);
    const byType = filterWorkoutsByType(byTitle, typeFilter);
    return sortWorkoutsForBrowse(byType, typeFilter);
  }, [items, searchQuery, typeFilter]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount],
  );

  const listRows = useMemo(
    () => buildWorkoutBrowseRows(visibleItems, typeFilter, getKey),
    [getKey, typeFilter, visibleItems],
  );

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [pageSize, searchQuery, typeFilter, items.length]);

  useEffect(() => {
    if (typeFilter !== 'all' && !availableTypes.includes(typeFilter)) {
      setTypeFilter('all');
    }
  }, [availableTypes, typeFilter]);

  const hasMore = filteredItems.length > visibleCount;
  const remainingCount = filteredItems.length - visibleCount;

  function showMore() {
    setVisibleCount((current) => current + pageSize);
  }

  return {
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    availableTypes,
    filteredItems,
    visibleItems,
    listRows: listRows as WorkoutBrowseRow<T>[],
    hasMore,
    remainingCount,
    showMore,
  };
}
