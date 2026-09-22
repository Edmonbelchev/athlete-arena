import type { CustomWorkoutTemplateSummary } from '@/types/customWorkouts';

export type WorkoutLibraryFilter = 'all' | 'mine' | 'shared';

export const WORKOUT_LIBRARY_FILTERS: Array<{
  id: WorkoutLibraryFilter;
  label: string;
  icon: 'dumbbell' | 'target' | 'friends';
}> = [
  { id: 'all', label: 'All', icon: 'dumbbell' },
  { id: 'mine', label: 'Mine', icon: 'target' },
  { id: 'shared', label: 'Shared', icon: 'friends' },
];

export function filterTemplatesByLibraryFilter(
  templates: CustomWorkoutTemplateSummary[],
  filter: WorkoutLibraryFilter,
): CustomWorkoutTemplateSummary[] {
  return templates.filter((template) => {
    if (filter === 'mine' && !template.isOwner) {
      return false;
    }

    if (filter === 'shared' && template.isOwner) {
      return false;
    }

    return true;
  });
}

export function getWorkoutLibraryFilterCount(
  templates: CustomWorkoutTemplateSummary[],
  filterId: WorkoutLibraryFilter,
): number {
  if (filterId === 'mine') {
    return templates.filter((template) => template.isOwner).length;
  }

  if (filterId === 'shared') {
    return templates.filter((template) => !template.isOwner).length;
  }

  return templates.length;
}
