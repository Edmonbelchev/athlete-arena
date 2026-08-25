import type { ExerciseType } from '@/constants/challenges';
import type { CustomWorkoutType, ForTimeStructureConfig } from '@/types/customWorkouts';
import { formatRaceTime } from '@/constants/friendChallenges';
import type { ShopAvatarDisplay, ShopFrameDisplay } from '@/types/shop';

export type WorkoutLeaderboardMetric = 'most_rounds' | 'fastest_time';

export interface CatalogWorkoutSummary {
  catalogWorkoutId: string;
  title: string;
  description: string | null;
  workoutType: CustomWorkoutType;
  timeLimitSeconds: number;
  leaderboardMetric: WorkoutLeaderboardMetric | null;
  exerciseCount: number;
  sortOrder: number;
}

export interface CatalogWorkoutDetail {
  catalogWorkoutId: string;
  title: string;
  description: string | null;
  workoutType: CustomWorkoutType;
  timeLimitSeconds: number;
  leaderboardMetric: WorkoutLeaderboardMetric | null;
  exercises: Array<{ exerciseType: ExerciseType; targetReps: number }>;
  structureConfig: ForTimeStructureConfig | null;
  myBestRounds: number | null;
  myBestReps: number | null;
  myBestElapsedSeconds: number | null;
  mySessionCount: number;
}

export interface WorkoutSessionHistoryEntry {
  sessionId: string;
  title: string;
  workoutType: CustomWorkoutType | null;
  timeLimitSeconds: number;
  completedRounds: number;
  totalReps: number;
  elapsedSeconds: number | null;
  exerciseBreakdown: Array<{
    exerciseType: ExerciseType;
    targetReps: number;
    totalReps: number;
  }>;
  startedAt: string;
  completedAt: string;
}

export type WorkoutLeaderboardPeriod = 'weekly' | 'all_time';

export interface WorkoutLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  level: number;
  scoreAmount: number;
  tiebreakAmount: number;
  avatarUrl: string | null;
  avatar: ShopAvatarDisplay | null;
  frame: ShopFrameDisplay | null;
  isCurrentUser: boolean;
}

export function getWorkoutLeaderboardScoreLabel(metric: WorkoutLeaderboardMetric | null): string {
  if (metric === 'fastest_time') {
    return 'Finish time';
  }

  return 'Rounds · reps';
}

export function formatWorkoutAmrapScore(completedRounds: number, totalReps: number): string {
  return `${completedRounds} rounds · ${totalReps} reps`;
}

export function formatWorkoutForTimeScore(elapsedSeconds: number): string {
  return formatRaceTime(elapsedSeconds);
}

export function formatWorkoutSessionScore(entry: Pick<
  WorkoutSessionHistoryEntry,
  'workoutType' | 'completedRounds' | 'totalReps' | 'elapsedSeconds' | 'timeLimitSeconds'
>): string {
  if (entry.workoutType === 'for_time' && entry.elapsedSeconds !== null) {
    return formatWorkoutForTimeScore(entry.elapsedSeconds);
  }

  return formatWorkoutAmrapScore(entry.completedRounds, entry.totalReps);
}

export function getWorkoutLeaderboardPeriodLabel(period: WorkoutLeaderboardPeriod): string {
  return period === 'weekly' ? 'This week' : 'All time';
}
