import type { ExerciseType } from '@/constants/challenges';
import type { CustomWorkoutType } from '@/types/customWorkouts';
import type { ShopAvatarDisplay, ShopFrameDisplay } from '@/types/shop';

export type WorkoutLeaderboardMetric = 'most_rounds';

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
  myBestRounds: number | null;
  myBestReps: number | null;
  mySessionCount: number;
}

export interface WorkoutSessionHistoryEntry {
  sessionId: string;
  title: string;
  timeLimitSeconds: number;
  completedRounds: number;
  totalReps: number;
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

export function getWorkoutLeaderboardScoreLabel(): string {
  return 'Rounds · reps';
}

export function formatWorkoutAmrapScore(completedRounds: number, totalReps: number): string {
  return `${completedRounds} rounds · ${totalReps} reps`;
}

export function getWorkoutLeaderboardPeriodLabel(period: WorkoutLeaderboardPeriod): string {
  return period === 'weekly' ? 'This week' : 'All time';
}
