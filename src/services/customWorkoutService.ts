import type { ExerciseType } from '@/constants/challenges';
import { normalizeCustomWorkoutType } from '@/constants/customWorkouts';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { clearMovementStatsCache } from '@/services/statsService';
import type {
  CustomWorkoutExerciseBreakdown,
  AmrapWorkoutResult,
  ForTimeWorkoutResult,
  CustomWorkoutTemplateDetail,
  CustomWorkoutTemplateSummary,
  ForTimeStructureConfig,
} from '@/types/customWorkouts';
import type { SaveWorkoutSessionResult } from '@/types/titles';
import { parseStructureConfig, serializeStructureConfig } from '@/features/workouts/forTimeStructure';

function mapTemplateSummary(row: {
  template_id: string;
  title: string;
  workout_type: 'amrap' | 'for_time' | 'emom';
  time_limit_seconds: number;
  exercise_count: number;
  created_at: string;
  is_owner: boolean;
  creator_username: string | null;
  creator_display_name: string | null;
  shared_at: string | null;
}): CustomWorkoutTemplateSummary {
  return {
    templateId: row.template_id,
    title: row.title,
    workoutType: normalizeCustomWorkoutType(row.workout_type),
    timeLimitSeconds: row.time_limit_seconds,
    exerciseCount: row.exercise_count,
    createdAt: row.created_at,
    isOwner: row.is_owner,
    creatorUsername: row.creator_username,
    creatorDisplayName: row.creator_display_name,
    sharedAt: row.shared_at,
  };
}

export async function getMyCustomWorkoutTemplates(): Promise<CustomWorkoutTemplateSummary[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_my_custom_workout_templates');

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapTemplateSummary);
}

export async function getCustomWorkoutTemplateDetail(
  templateId: string,
): Promise<CustomWorkoutTemplateDetail> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_custom_workout_template_detail', {
    p_template_id: templateId,
  });

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('Workout template not found');
  }

  const first = data[0];

  return {
    templateId: first.template_id,
    title: first.title,
    workoutType: normalizeCustomWorkoutType(first.workout_type),
    timeLimitSeconds: first.time_limit_seconds,
    creatorId: first.creator_id,
    creatorUsername: first.creator_username,
    creatorDisplayName: first.creator_display_name,
    isOwner: first.is_owner,
    structureConfig: parseStructureConfig(first.structure_config),
    exercises: data.map((row) => ({
      exerciseType: row.exercise_type as ExerciseType,
      targetReps: row.target_reps,
    })),
  };
}

export async function createCustomWorkoutTemplate(input: {
  title: string;
  workoutType: CustomWorkoutTemplateSummary['workoutType'];
  timeLimitSeconds: number;
  exercises: Array<{ exerciseType: ExerciseType; targetReps: number }>;
  structureConfig?: ForTimeStructureConfig | null;
}): Promise<string> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('create_custom_workout_template', {
    p_title: input.title,
    p_workout_type: input.workoutType,
    p_time_limit_seconds: input.timeLimitSeconds,
    p_exercises: input.exercises.map((exercise) => ({
      exercise_type: exercise.exerciseType,
      target_reps: exercise.targetReps,
    })),
    p_structure_config: serializeStructureConfig(input.structureConfig),
  });

  if (error) {
    throw error;
  }

  return data as string;
}

export async function updateCustomWorkoutTemplate(
  templateId: string,
  input: {
    title: string;
    workoutType: CustomWorkoutTemplateSummary['workoutType'];
    timeLimitSeconds: number;
    exercises: Array<{ exerciseType: ExerciseType; targetReps: number }>;
    structureConfig?: ForTimeStructureConfig | null;
  },
): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('update_custom_workout_template', {
    p_template_id: templateId,
    p_title: input.title,
    p_workout_type: input.workoutType,
    p_time_limit_seconds: input.timeLimitSeconds,
    p_exercises: input.exercises.map((exercise) => ({
      exercise_type: exercise.exerciseType,
      target_reps: exercise.targetReps,
    })),
    p_structure_config: serializeStructureConfig(input.structureConfig),
  });

  if (error) {
    throw error;
  }
}

export async function shareCustomWorkoutTemplate(
  templateId: string,
  friendId: string,
): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('share_custom_workout_template', {
    p_template_id: templateId,
    p_friend_id: friendId,
  });

  if (error) {
    throw error;
  }
}

export async function shareCustomWorkoutTemplateWithFriends(
  templateId: string,
  friendIds: string[],
): Promise<void> {
  const uniqueFriendIds = [...new Set(friendIds)];
  await Promise.all(uniqueFriendIds.map((friendId) => shareCustomWorkoutTemplate(templateId, friendId)));
}

export async function dismissSharedWorkoutTemplate(templateId: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('dismiss_shared_workout_template', {
    p_template_id: templateId,
  });

  if (error) {
    throw error;
  }
}

export async function softDeleteCustomWorkoutTemplate(templateId: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('soft_delete_custom_workout_template', {
    p_template_id: templateId,
  });

  if (error) {
    throw error;
  }
}

function mapSaveWorkoutSessionResult(data: unknown): SaveWorkoutSessionResult {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid workout save response');
  }

  const payload = data as {
    session_id?: string;
    daily_bonus?: { xp?: number; coins?: number } | null;
  };

  if (!payload.session_id) {
    throw new Error('Invalid workout save response');
  }

  const bonus = payload.daily_bonus;
  const dailyBonus =
    bonus && typeof bonus.xp === 'number' && typeof bonus.coins === 'number'
      ? { xp: bonus.xp, coins: bonus.coins }
      : null;

  clearMovementStatsCache();

  return {
    sessionId: payload.session_id,
    dailyBonus,
  };
}

export async function saveCustomWorkoutSession(result: AmrapWorkoutResult): Promise<SaveWorkoutSessionResult> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('save_custom_workout_session', {
    p_template_id: result.templateId,
    p_catalog_workout_id: result.catalogWorkoutId,
    p_title: result.title,
    p_time_limit_seconds: result.timeLimitSeconds,
    p_completed_rounds: result.completedRounds,
    p_total_reps: result.totalReps,
    p_exercise_breakdown: result.exerciseBreakdown.map((entry) => ({
      exercise_type: entry.exerciseType,
      target_reps: entry.targetReps,
      total_reps: entry.totalReps,
    })),
    p_started_at: result.startedAt,
    p_elapsed_seconds: null,
  });

  if (error) {
    throw error;
  }

  return mapSaveWorkoutSessionResult(data);
}

export async function saveForTimeWorkoutSession(result: ForTimeWorkoutResult): Promise<SaveWorkoutSessionResult> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('save_custom_workout_session', {
    p_template_id: result.templateId,
    p_catalog_workout_id: result.catalogWorkoutId,
    p_title: result.title,
    p_time_limit_seconds: 0,
    p_completed_rounds: 1,
    p_total_reps: result.totalReps,
    p_exercise_breakdown: result.exerciseBreakdown.map((entry) => ({
      exercise_type: entry.exerciseType,
      target_reps: entry.targetReps,
      total_reps: entry.totalReps,
    })),
    p_started_at: result.startedAt,
    p_elapsed_seconds: result.elapsedSeconds,
  });

  if (error) {
    throw error;
  }

  return mapSaveWorkoutSessionResult(data);
}

export function buildExerciseBreakdownFromSteps(
  exercises: Array<{ exerciseType: ExerciseType; targetReps: number }>,
  stepTotals: number[],
): CustomWorkoutExerciseBreakdown[] {
  return exercises.map((exercise, index) => ({
    exerciseType: exercise.exerciseType,
    targetReps: exercise.targetReps,
    totalReps: stepTotals[index] ?? 0,
  }));
}

export function buildExerciseBreakdown(
  exercises: Array<{ exerciseType: ExerciseType; targetReps: number }>,
  totals: Record<string, number>,
): CustomWorkoutExerciseBreakdown[] {
  return exercises.map((exercise) => ({
    exerciseType: exercise.exerciseType,
    targetReps: exercise.targetReps,
    totalReps: totals[exercise.exerciseType] ?? 0,
  }));
}
