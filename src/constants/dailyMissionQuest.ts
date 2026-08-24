import { formatExerciseLabel, type ExerciseType } from '@/constants/challenges';
import type { ThemeColor } from '@/constants/theme';

export interface DailyMissionQuestMeta {
  questTitle: string;
  objectiveVerb: string;
}

const QUEST_ACCENT_COLORS = ['primary', 'streak', 'accent', 'xp'] as const satisfies readonly ThemeColor[];

export const DAILY_MISSION_QUEST: Partial<Record<ExerciseType, DailyMissionQuestMeta>> = {
  push_ups: {
    questTitle: 'Push-Up Patrol',
    objectiveVerb: 'Complete',
  },
  squats: {
    questTitle: 'Squat Squad',
    objectiveVerb: 'Complete',
  },
  pull_ups: {
    questTitle: 'Bar Hang Hero',
    objectiveVerb: 'Complete',
  },
  burpees: {
    questTitle: 'Burpee Blitz',
    objectiveVerb: 'Complete',
  },
  half_burpees: {
    questTitle: 'Half Burpee Hustle',
    objectiveVerb: 'Complete',
  },
};

export function getDailyMissionQuestMeta(exerciseType: ExerciseType): DailyMissionQuestMeta {
  return (
    DAILY_MISSION_QUEST[exerciseType] ?? {
      questTitle: formatExerciseLabel(exerciseType),
      objectiveVerb: 'Complete',
    }
  );
}

export function getQuestAccentColor(missionIndex: number): ThemeColor {
  return QUEST_ACCENT_COLORS[missionIndex % QUEST_ACCENT_COLORS.length];
}

export function getQuestActionLabel(
  missionStatus: 'tracking' | 'active' | 'ready' | 'cleared',
): string | null {
  if (missionStatus === 'cleared') {
    return null;
  }

  if (missionStatus === 'ready') {
    return 'Claim reward';
  }

  if (missionStatus === 'active') {
    return 'Continue workout';
  }

  return 'Train now';
}
