import { useEffect, useMemo, useState } from 'react';

import type { ExerciseType } from '@/constants/challenges';
import {
  EXERCISE_BROWSE_PAGE_SIZE,
  filterExercisesByQuery,
  sortExercisesForBrowse,
} from '@/features/challenges/exerciseBrowseList';

interface UseExerciseBrowseListOptions {
  exerciseTypes: readonly ExerciseType[];
  pageSize?: number;
}

export function useExerciseBrowseList({
  exerciseTypes,
  pageSize = EXERCISE_BROWSE_PAGE_SIZE,
}: UseExerciseBrowseListOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const filteredExerciseTypes = useMemo(() => {
    const filtered = filterExercisesByQuery(exerciseTypes, searchQuery);
    return sortExercisesForBrowse(filtered);
  }, [exerciseTypes, searchQuery]);

  const visibleExerciseTypes = useMemo(
    () => filteredExerciseTypes.slice(0, visibleCount),
    [filteredExerciseTypes, visibleCount],
  );

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [pageSize, searchQuery, exerciseTypes.length]);

  const hasMore = filteredExerciseTypes.length > visibleCount;
  const remainingCount = filteredExerciseTypes.length - visibleCount;

  function showMore() {
    setVisibleCount((current) => current + pageSize);
  }

  return {
    searchQuery,
    setSearchQuery,
    filteredExerciseTypes,
    visibleExerciseTypes,
    hasMore,
    remainingCount,
    showMore,
  };
}
