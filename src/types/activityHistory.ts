import type { ExerciseType } from '@/constants/challenges';
import type { CustomWorkoutType } from '@/types/customWorkouts';
import type { ChallengeHistoryEntry, ChallengeHistoryFriendKind } from '@/types/challengeHistory';
import type { ChallengeStatus } from '@/types/friends';

export type ActivityHistoryFilter =
  | 'all'
  | 'quests'
  | 'friend_challenges'
  | 'friend_workouts'
  | 'workouts';

export type ActivityHistoryCategory =
  | 'daily_quest'
  | 'friend_exercise'
  | 'friend_workout'
  | 'solo_workout';

export interface SoloWorkoutHistoryEntry {
  entryId: string;
  category: 'solo_workout';
  resultAt: string;
  workoutTitle: string;
  workoutType: CustomWorkoutType;
  timeLimitSeconds: number;
  completedRounds: number;
  totalReps: number;
  elapsedSeconds: number | null;
}

export type ActivityHistoryEntry =
  | (ChallengeHistoryEntry & { category: 'daily_quest' | 'friend_exercise' | 'friend_workout' })
  | SoloWorkoutHistoryEntry;

export const ACTIVITY_HISTORY_FILTERS: Array<{ id: ActivityHistoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'quests', label: 'Quests' },
  { id: 'friend_challenges', label: 'Challenges' },
  { id: 'friend_workouts', label: 'Friend WODs' },
  { id: 'workouts', label: 'Workouts' },
];

export const ACTIVITY_HISTORY_PAGE_SIZE = 12;

export function getActivityHistoryEmptyMessage(filter: ActivityHistoryFilter): string {
  switch (filter) {
    case 'quests':
      return 'No completed quests yet. Clear a daily quest to see it here.';
    case 'friend_challenges':
      return 'No friend exercise challenges yet.';
    case 'friend_workouts':
      return 'No friend workout races yet.';
    case 'workouts':
      return 'No solo workout runs yet. Finish an Arena or library workout to see it here.';
    default:
      return 'No activity yet. Complete a quest, challenge, or workout to build your history.';
  }
}

export function isSoloWorkoutHistoryEntry(
  entry: ActivityHistoryEntry,
): entry is SoloWorkoutHistoryEntry {
  return entry.category === 'solo_workout';
}

export function isChallengeHistoryEntry(
  entry: ActivityHistoryEntry,
): entry is ChallengeHistoryEntry & {
  category: 'daily_quest' | 'friend_exercise' | 'friend_workout';
} {
  return entry.category !== 'solo_workout';
}

export function mapActivityHistoryRow(row: {
  entry_id: string;
  category: string;
  kind: string;
  exercise_type: ExerciseType | null;
  target_reps: number | null;
  completed_reps: number;
  xp_reward: number;
  status: ChallengeStatus;
  result_at: string;
  opponent_username: string | null;
  opponent_display_name: string | null;
  opponent_completed_reps: number | null;
  opponent_status: ChallengeStatus | null;
  race_seconds: number | null;
  opponent_race_seconds: number | null;
  winner_user_id: string | null;
  xp_earned: number | null;
  friend_challenge_kind: string | null;
  workout_title: string | null;
  workout_type: CustomWorkoutType | null;
  completed_rounds: number | null;
  opponent_completed_rounds: number | null;
  total_reps: number | null;
  elapsed_seconds: number | null;
  time_limit_seconds: number | null;
}): ActivityHistoryEntry {
  if (row.category === 'solo_workout') {
    return {
      entryId: row.entry_id,
      category: 'solo_workout',
      resultAt: row.result_at,
      workoutTitle: row.workout_title ?? 'Workout',
      workoutType: row.workout_type ?? 'amrap',
      timeLimitSeconds: row.time_limit_seconds ?? 0,
      completedRounds: row.completed_rounds ?? 0,
      totalReps: row.total_reps ?? row.completed_reps,
      elapsedSeconds: row.elapsed_seconds ?? row.race_seconds,
    };
  }

  const friendChallengeKind = (row.friend_challenge_kind as ChallengeHistoryFriendKind | null) ?? null;

  return {
    entryId: row.entry_id,
    category: row.category as 'daily_quest' | 'friend_exercise' | 'friend_workout',
    kind: row.kind as ChallengeHistoryEntry['kind'],
    exerciseType: row.exercise_type,
    targetReps: row.target_reps ?? 0,
    completedReps: row.completed_reps,
    xpReward: row.xp_reward,
    status: row.status,
    resultAt: row.result_at,
    opponentUsername: row.opponent_username,
    opponentDisplayName: row.opponent_display_name,
    opponentCompletedReps: row.opponent_completed_reps,
    opponentStatus: row.opponent_status,
    raceSeconds: row.race_seconds,
    opponentRaceSeconds: row.opponent_race_seconds,
    winnerUserId: row.winner_user_id,
    xpEarned: row.xp_earned,
    friendChallengeKind:
      row.category === 'friend_workout'
        ? 'workout'
        : row.category === 'friend_exercise'
          ? 'exercise'
          : friendChallengeKind,
    workoutTitle: row.workout_title,
    workoutType: row.workout_type,
    completedRounds: row.completed_rounds,
    opponentCompletedRounds: row.opponent_completed_rounds,
  };
}
