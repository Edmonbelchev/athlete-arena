import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { DailyChallenge, DailyChallengeHome } from '@/types';

type DailyChallengeRow = Database['public']['Tables']['daily_challenges']['Row'];

type DailyChallengeHomeRow = {
  template_id: string;
  challenge_date: string;
  exercise_type: DailyChallenge['exercise_type'];
  target_reps: number;
  xp_reward: number;
  catalog_slot: number;
  user_challenge_id: string | null;
  user_status: DailyChallenge['status'] | null;
  completed_reps: number;
  completed_at: string | null;
};

function mapDailyChallengeHome(row: DailyChallengeHomeRow): DailyChallengeHome {
  return {
    templateId: row.template_id,
    challengeDate: row.challenge_date,
    exerciseType: row.exercise_type,
    targetReps: row.target_reps,
    xpReward: row.xp_reward,
    catalogSlot: row.catalog_slot,
    userChallengeId: row.user_challenge_id,
    status: row.user_status ?? 'not_started',
    completedReps: row.completed_reps,
    completedAt: row.completed_at,
  };
}

export async function getDailyChallengeHome(): Promise<DailyChallengeHome> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_daily_challenge_home');

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error('Failed to load daily challenge');
  }

  return mapDailyChallengeHome(row as DailyChallengeHomeRow);
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

export async function getOrCreateDailyChallenge(): Promise<DailyChallenge> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_or_create_daily_challenge');

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Failed to load daily challenge');
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
