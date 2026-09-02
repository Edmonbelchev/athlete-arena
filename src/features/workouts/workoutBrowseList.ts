import {
  AVAILABLE_CUSTOM_WORKOUT_TYPES,
  getCustomWorkoutTypeLabel,
} from '@/constants/customWorkouts';
import type { CustomWorkoutType } from '@/types/customWorkouts';

export const WORKOUT_BROWSE_PAGE_SIZE = 12;

export type WorkoutTypeFilter = 'all' | CustomWorkoutType;

export interface WorkoutBrowseItem {
  title: string;
  workoutType: CustomWorkoutType;
}

export type WorkoutBrowseRow<T extends WorkoutBrowseItem> =
  | { kind: 'section'; workoutType: CustomWorkoutType; label: string }
  | { kind: 'item'; item: T; key: string };

export function filterWorkoutsByTitle<T extends WorkoutBrowseItem>(
  items: T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) => item.title.toLowerCase().includes(normalizedQuery));
}

export function filterWorkoutsByType<T extends WorkoutBrowseItem>(
  items: T[],
  typeFilter: WorkoutTypeFilter,
): T[] {
  if (typeFilter === 'all') {
    return items;
  }

  return items.filter((item) => item.workoutType === typeFilter);
}

const WORKOUT_TYPE_ORDER = new Map(
  AVAILABLE_CUSTOM_WORKOUT_TYPES.map((entry, index) => [entry.type, index]),
);

export function sortWorkoutsForBrowse<T extends WorkoutBrowseItem>(
  items: T[],
  typeFilter: WorkoutTypeFilter,
): T[] {
  return [...items].sort((left, right) => {
    if (typeFilter === 'all') {
      const leftOrder = WORKOUT_TYPE_ORDER.get(left.workoutType) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = WORKOUT_TYPE_ORDER.get(right.workoutType) ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
    }

    return left.title.localeCompare(right.title);
  });
}

export function getAvailableWorkoutTypes<T extends WorkoutBrowseItem>(items: T[]): CustomWorkoutType[] {
  const present = new Set(items.map((item) => item.workoutType));
  const ordered = AVAILABLE_CUSTOM_WORKOUT_TYPES.map((entry) => entry.type).filter((type) =>
    present.has(type),
  );
  const extras = [...present].filter((type) => !ordered.includes(type));

  return [...ordered, ...extras];
}

export function buildWorkoutBrowseRows<T extends WorkoutBrowseItem>(
  items: T[],
  typeFilter: WorkoutTypeFilter,
  getKey: (item: T) => string,
): WorkoutBrowseRow<T>[] {
  if (typeFilter !== 'all') {
    return items.map((item) => ({ kind: 'item', item, key: getKey(item) }));
  }

  const rows: WorkoutBrowseRow<T>[] = [];
  let lastType: CustomWorkoutType | null = null;

  for (const item of items) {
    if (item.workoutType !== lastType) {
      rows.push({
        kind: 'section',
        workoutType: item.workoutType,
        label: getCustomWorkoutTypeLabel(item.workoutType),
      });
      lastType = item.workoutType;
    }

    rows.push({ kind: 'item', item, key: getKey(item) });
  }

  return rows;
}

export function countWorkoutsByType<T extends WorkoutBrowseItem>(
  items: T[],
  type: CustomWorkoutType,
): number {
  return items.filter((item) => item.workoutType === type).length;
}
