import { EXERCISE_TYPES, type ExerciseType } from '@/constants/challenges';
import { DAILY_MISSION_XP_REWARD } from '@/constants/dailyMissionRewards';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { DailyChallenge, DailyChallengeHome } from '@/types';

type DailyChallengeRow = Database['public']['Tables']['daily_challenges']['Row'];

type DailyChallengeHomeRow = {
  mission_index?: number | null;
  template_id: string;
  challenge_date: string;
  exercise_type: ExerciseType;
  target_reps: number;
  xp_reward: number;
  catalog_slot: number | null;
  user_challenge_id: string | null;
  user_status: DailyChallenge['status'] | null;
  completed_reps: number;
  completed_at: string | null;
};

type TemplateRow = {
  id: string;
  challenge_date: string;
  exercise_type: ExerciseType;
  target_reps: number;
  xp_reward: number;
  catalog_slot: number | null;
  mission_index?: number | null;
};

type UserChallengeRow = {
  id: string;
  exercise_type: ExerciseType;
  mission_index?: number | null;
  status: DailyChallenge['status'];
  completed_reps: number;
  completed_at: string | null;
};

export function resolveMissionIndex(
  exerciseType: ExerciseType,
  explicitIndex: number | null | undefined,
  fallbackIndex: number,
): number {
  if (typeof explicitIndex === 'number' && Number.isFinite(explicitIndex)) {
    return explicitIndex;
  }

  const fromExercise = EXERCISE_TYPES.indexOf(exerciseType);
  return fromExercise >= 0 ? fromExercise : fallbackIndex;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapDailyChallengeHome(
  row: DailyChallengeHomeRow,
  fallbackIndex: number,
): DailyChallengeHome {
  const missionIndex = resolveMissionIndex(row.exercise_type, row.mission_index, fallbackIndex);

  return {
    missionIndex,
    templateId: row.template_id,
    challengeDate: row.challenge_date,
    exerciseType: row.exercise_type,
    targetReps: row.target_reps,
    xpReward: DAILY_MISSION_XP_REWARD,
    catalogSlot: row.catalog_slot,
    userChallengeId: row.user_challenge_id,
    status: row.user_status ?? 'not_started',
    completedReps: row.completed_reps,
    completedAt: row.completed_at,
  };
}

function buildMissionsFromTemplates(
  templates: TemplateRow[],
  userChallenges: UserChallengeRow[],
): DailyChallengeHome[] {
  const challengeByMission = new Map<number, UserChallengeRow>();
  const challengeByExercise = new Map<ExerciseType, UserChallengeRow>();

  for (const challenge of userChallenges) {
    const missionIndex = resolveMissionIndex(challenge.exercise_type, challenge.mission_index, 0);
    challengeByMission.set(missionIndex, challenge);
    challengeByExercise.set(challenge.exercise_type, challenge);
  }

  return templates
    .map((template, index) => {
      const missionIndex = resolveMissionIndex(template.exercise_type, template.mission_index, index);
      const userChallenge =
        challengeByMission.get(missionIndex) ?? challengeByExercise.get(template.exercise_type) ?? null;

      return {
        missionIndex,
        templateId: template.id,
        challengeDate: template.challenge_date,
        exerciseType: template.exercise_type,
        targetReps: template.target_reps,
        xpReward: DAILY_MISSION_XP_REWARD,
        catalogSlot: template.catalog_slot,
        userChallengeId: userChallenge?.id ?? null,
        status: userChallenge?.status ?? 'not_started',
        completedReps: userChallenge?.completed_reps ?? 0,
        completedAt: userChallenge?.completed_at ?? null,
      };
    })
    .sort((left, right) => left.missionIndex - right.missionIndex);
}

async function ensureTodayMissionTemplates(today: string): Promise<void> {
  const { error: missionsError } = await supabase.rpc('ensure_daily_mission_templates', {
    p_date: today,
  });

  if (!missionsError) {
    return;
  }

  await supabase.rpc('ensure_daily_challenge_template', { p_date: today });
}

async function fetchTodayTemplates(today: string): Promise<TemplateRow[]> {
  const withMissionIndex = await supabase
    .from('daily_challenge_templates')
    .select(
      'id, challenge_date, exercise_type, target_reps, xp_reward, catalog_slot, mission_index',
    )
    .eq('challenge_date', today);

  if (!withMissionIndex.error) {
    return (withMissionIndex.data ?? []) as TemplateRow[];
  }

  const legacy = await supabase
    .from('daily_challenge_templates')
    .select('id, challenge_date, exercise_type, target_reps, xp_reward, catalog_slot')
    .eq('challenge_date', today);

  if (legacy.error) {
    throw legacy.error;
  }

  return (legacy.data ?? []) as TemplateRow[];
}

async function fetchTodayUserChallenges(today: string): Promise<UserChallengeRow[]> {
  const withMissionIndex = await supabase
    .from('daily_challenges')
    .select('id, exercise_type, mission_index, status, completed_reps, completed_at')
    .eq('challenge_date', today);

  if (!withMissionIndex.error) {
    return (withMissionIndex.data ?? []) as UserChallengeRow[];
  }

  const legacy = await supabase
    .from('daily_challenges')
    .select('id, exercise_type, status, completed_reps, completed_at')
    .eq('challenge_date', today);

  if (legacy.error) {
    throw legacy.error;
  }

  return (legacy.data ?? []) as UserChallengeRow[];
}

function dedupeMissions(missions: DailyChallengeHome[]): DailyChallengeHome[] {
  const seen = new Set<string>();

  return missions.filter((mission) => {
    const dedupeKey =
      mission.templateId || `${mission.challengeDate}-${mission.missionIndex}-${mission.exerciseType}`;

    if (seen.has(dedupeKey)) {
      return false;
    }

    seen.add(dedupeKey);
    return true;
  });
}

export async function getDailyChallengeHome(): Promise<DailyChallengeHome[]> {
  assertSupabaseConfigured();
  const today = todayDateString();

  await ensureTodayMissionTemplates(today);

  const [templates, userChallenges] = await Promise.all([
    fetchTodayTemplates(today),
    fetchTodayUserChallenges(today),
  ]);

  if (templates.length > 0) {
    return dedupeMissions(buildMissionsFromTemplates(templates, userChallenges));
  }

  const { data, error } = await supabase.rpc('get_daily_challenge_home');

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];

  if (rows.length === 0) {
    throw new Error('Failed to load daily missions');
  }

  return dedupeMissions(
    rows.map((row, index) => mapDailyChallengeHome(row as DailyChallengeHomeRow, index)),
  );
}

export async function getChallengeById(challengeId: string): Promise<DailyChallenge | null> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getOrCreateDailyChallenge(missionIndex: number): Promise<DailyChallenge> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_or_create_daily_challenge', {
    p_mission_index: missionIndex,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Failed to load daily mission');
  }

  return data as DailyChallengeRow;
}

export async function startChallenge(challengeId: string): Promise<DailyChallenge> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('start_challenge', {
    p_challenge_id: challengeId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Failed to start challenge');
  }

  return data as DailyChallengeRow;
}

export async function completeChallenge(
  challengeId: string,
  completedReps: number,
): Promise<DailyChallenge> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('complete_challenge', {
    p_challenge_id: challengeId,
    p_completed_reps: completedReps,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Failed to complete challenge');
  }

  return data as DailyChallengeRow;
}

export async function finalizeDailyMission(challengeId: string): Promise<DailyChallenge> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('finalize_daily_mission', {
    p_challenge_id: challengeId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Failed to finalize daily mission');
  }

  return data as DailyChallengeRow;
}

export async function syncDailyMissionProgress(
  challengeId: string,
  completedReps: number,
): Promise<DailyChallenge> {
  return completeChallenge(challengeId, completedReps);
}
