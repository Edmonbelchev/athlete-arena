import type { AchievementRecord, AchievementRequirementType } from '@/types/achievements';
import type { TitleRecord, TitleRequirementType } from '@/types/titles';

const ACHIEVEMENT_TITLE_REQUIREMENT_TYPES: Partial<
  Record<AchievementRequirementType, TitleRequirementType>
> = {
  workouts_completed: 'workouts_completed',
  friend_races_won: 'friend_races_won',
  push_ups_total: 'push_ups_total',
  squats_total: 'squats_total',
  pull_ups_total: 'pull_ups_total',
  burpees_total: 'burpees_total',
};

export function findLinkedTitle(
  requirements: AchievementRecord['requirements'],
  titles: TitleRecord[],
): TitleRecord | null {
  const titleRequirementType = ACHIEVEMENT_TITLE_REQUIREMENT_TYPES[requirements.type];
  if (!titleRequirementType) {
    return null;
  }

  return (
    titles.find(
      (title) =>
        title.requirementType === titleRequirementType &&
        title.requirementMin === requirements.min,
    ) ?? null
  );
}
