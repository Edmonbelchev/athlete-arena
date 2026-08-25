import {
    formatWorkoutTimeLimit,
    getCustomWorkoutTypeLabel,
} from '@/constants/customWorkouts';
import type { WorkoutBrowseItem } from '@/features/workouts/workoutBrowseList';
import type { CatalogWorkoutSummary } from '@/types/catalogWorkouts';
import type { CustomWorkoutTemplateSummary } from '@/types/customWorkouts';
import { getWorkoutSharerDisplayName } from '@/types/customWorkouts';

export type FriendChallengeWorkoutSource = 'arena' | 'library';

export type FriendChallengeWorkoutSourceFilter = 'all' | FriendChallengeWorkoutSource;

export interface FriendChallengeWorkoutOption extends WorkoutBrowseItem {
  id: string;
  source: FriendChallengeWorkoutSource;
  exerciseCount: number;
  timeLimitSeconds: number;
  sourceLabel: string;
}

export function getFriendChallengeWorkoutKey(option: Pick<FriendChallengeWorkoutOption, 'source' | 'id'>): string {
  return `${option.source}:${option.id}`;
}

export function parseFriendChallengeWorkoutKey(
  key: string,
): { source: FriendChallengeWorkoutSource; id: string } | null {
  const separatorIndex = key.indexOf(':');
  if (separatorIndex <= 0) {
    return null;
  }

  const source = key.slice(0, separatorIndex);
  const id = key.slice(separatorIndex + 1);

  if ((source !== 'arena' && source !== 'library') || !id) {
    return null;
  }

  return { source, id };
}

function isSupportedChallengeWorkoutType(
  workoutType: FriendChallengeWorkoutOption['workoutType'],
): boolean {
  return workoutType === 'amrap' || workoutType === 'for_time';
}

export function buildFriendChallengeWorkoutOptions(input: {
  catalogWorkouts: CatalogWorkoutSummary[];
  libraryTemplates: CustomWorkoutTemplateSummary[];
}): FriendChallengeWorkoutOption[] {
  const arenaOptions: FriendChallengeWorkoutOption[] = input.catalogWorkouts
    .filter((workout) => isSupportedChallengeWorkoutType(workout.workoutType))
    .map((workout) => ({
      id: workout.catalogWorkoutId,
      source: 'arena',
      title: workout.title,
      workoutType: workout.workoutType,
      exerciseCount: workout.exerciseCount,
      timeLimitSeconds: workout.timeLimitSeconds,
      sourceLabel: 'Arena',
    }))
    .sort((left, right) => left.title.localeCompare(right.title));

  const libraryOptions: FriendChallengeWorkoutOption[] = input.libraryTemplates
    .filter((template) => isSupportedChallengeWorkoutType(template.workoutType))
    .map((template) => ({
      id: template.templateId,
      source: 'library',
      title: template.title,
      workoutType: template.workoutType,
      exerciseCount: template.exerciseCount,
      timeLimitSeconds: template.timeLimitSeconds,
      sourceLabel: template.isOwner ? 'My workout' : `Shared by ${getWorkoutSharerDisplayName(template)}`,
    }))
    .sort((left, right) => left.title.localeCompare(right.title));

  return [...arenaOptions, ...libraryOptions];
}

export function filterFriendChallengeWorkoutsBySource(
  items: FriendChallengeWorkoutOption[],
  sourceFilter: FriendChallengeWorkoutSourceFilter,
): FriendChallengeWorkoutOption[] {
  if (sourceFilter === 'all') {
    return items;
  }

  return items.filter((item) => item.source === sourceFilter);
}

export function formatFriendChallengeWorkoutMeta(option: FriendChallengeWorkoutOption): string {
  const typeLabel = getCustomWorkoutTypeLabel(option.workoutType);
  const capLabel =
    option.workoutType === 'for_time' ? 'Fastest time wins' : formatWorkoutTimeLimit(option.timeLimitSeconds);

  return `${option.sourceLabel} · ${typeLabel} · ${capLabel} · ${option.exerciseCount} exercises`;
}

export type FriendChallengeWorkoutBrowseRow =
  | { kind: 'section'; label: string; key: string }
  | { kind: 'item'; item: FriendChallengeWorkoutOption; key: string };

export function buildFriendChallengeWorkoutBrowseRows(
  items: FriendChallengeWorkoutOption[],
  sourceFilter: FriendChallengeWorkoutSourceFilter,
): FriendChallengeWorkoutBrowseRow[] {
  if (sourceFilter !== 'all') {
    return items.map((item) => ({
      kind: 'item',
      item,
      key: getFriendChallengeWorkoutKey(item),
    }));
  }

  const rows: FriendChallengeWorkoutBrowseRow[] = [];
  const arenaItems = items.filter((item) => item.source === 'arena');
  const libraryItems = items.filter((item) => item.source === 'library');

  if (arenaItems.length > 0) {
    rows.push({ kind: 'section', label: 'Arena', key: 'section:arena' });
    for (const item of arenaItems) {
      rows.push({ kind: 'item', item, key: getFriendChallengeWorkoutKey(item) });
    }
  }

  if (libraryItems.length > 0) {
    rows.push({ kind: 'section', label: 'My workouts', key: 'section:library' });
    for (const item of libraryItems) {
      rows.push({ kind: 'item', item, key: getFriendChallengeWorkoutKey(item) });
    }
  }

  return rows;
}
