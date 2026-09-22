import { AVAILABLE_CUSTOM_WORKOUT_TYPES } from '@/constants/customWorkouts';
import type { AppIconName } from '@/constants/icons';
import type { CustomWorkoutType } from '@/types/customWorkouts';

export const OFFICIAL_WORKOUT_CATEGORY_TYPES = AVAILABLE_CUSTOM_WORKOUT_TYPES.map(
  (entry) => entry.type,
);

const CATEGORY_ICONS: Record<CustomWorkoutType, AppIconName> = {
  amrap: 'flame',
  for_time: 'bolt',
  emom: 'swap',
};

export function isOfficialWorkoutCategoryType(value: string): value is CustomWorkoutType {
  return OFFICIAL_WORKOUT_CATEGORY_TYPES.includes(value as CustomWorkoutType);
}

export function getOfficialWorkoutCategoryIcon(workoutType: CustomWorkoutType): AppIconName {
  return CATEGORY_ICONS[workoutType] ?? 'dumbbell';
}
