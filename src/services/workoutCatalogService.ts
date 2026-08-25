import { mapPublicCosmetics } from '@/features/friends/friendCosmeticsUtils';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type {
  CatalogWorkoutDetail,
  CatalogWorkoutSummary,
  WorkoutLeaderboardEntry,
  WorkoutLeaderboardPeriod,
  WorkoutSessionHistoryEntry,
} from '@/types/catalogWorkouts';
import type { ExerciseType } from '@/constants/challenges';

export async function getWorkoutCatalog(): Promise<CatalogWorkoutSummary[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_workout_catalog');

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    catalogWorkoutId: row.catalog_workout_id,
    title: row.title,
    description: row.description,
    workoutType: row.workout_type,
    timeLimitSeconds: row.time_limit_seconds,
    leaderboardMetric: row.leaderboard_metric,
    exerciseCount: row.exercise_count,
    sortOrder: row.sort_order,
  }));
}

export async function getWorkoutCatalogDetail(catalogWorkoutId: string): Promise<CatalogWorkoutDetail> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_workout_catalog_detail', {
    p_catalog_workout_id: catalogWorkoutId,
  });

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('Workout not found');
  }

  const first = data[0];

  return {
    catalogWorkoutId: first.catalog_workout_id,
    title: first.title,
    description: first.description,
    workoutType: first.workout_type,
    timeLimitSeconds: first.time_limit_seconds,
    leaderboardMetric: first.leaderboard_metric,
    exercises: data.map((row) => ({
      exerciseType: row.exercise_type as ExerciseType,
      targetReps: row.target_reps,
    })),
    myBestRounds: first.my_best_rounds,
    myBestReps: first.my_best_reps,
    myBestElapsedSeconds: first.my_best_elapsed_seconds ?? null,
    mySessionCount: first.my_session_count,
  };
}

export async function getMyWorkoutSessions(options: {
  catalogWorkoutId?: string;
  templateId?: string;
  limit?: number;
}): Promise<WorkoutSessionHistoryEntry[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_my_workout_sessions', {
    p_catalog_workout_id: options.catalogWorkoutId ?? null,
    p_template_id: options.templateId ?? null,
    p_limit: options.limit ?? 20,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    sessionId: row.session_id,
    title: row.title,
    workoutType: row.workout_type ?? null,
    timeLimitSeconds: row.time_limit_seconds,
    completedRounds: row.completed_rounds,
    totalReps: row.total_reps,
    elapsedSeconds: row.elapsed_seconds ?? null,
    exerciseBreakdown: Array.isArray(row.exercise_breakdown)
      ? row.exercise_breakdown.map((entry) => ({
          exerciseType: entry.exercise_type as ExerciseType,
          targetReps: entry.target_reps as number,
          totalReps: entry.total_reps as number,
        }))
      : [],
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }));
}

export async function getCatalogWorkoutLeaderboard(
  catalogWorkoutId: string,
  period: WorkoutLeaderboardPeriod,
): Promise<WorkoutLeaderboardEntry[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_catalog_workout_leaderboard', {
    p_catalog_workout_id: catalogWorkoutId,
    p_period: period,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const cosmetics = mapPublicCosmetics(row);

    return {
      rank: Number(row.rank),
      userId: row.user_id,
      username: row.username,
      displayName: row.display_name,
      level: row.level,
      scoreAmount: row.score_amount,
      tiebreakAmount: row.tiebreak_amount,
      avatarUrl: row.avatar_url,
      avatar: cosmetics.avatar,
      frame: cosmetics.frame,
      isCurrentUser: row.is_current_user,
    };
  });
}
