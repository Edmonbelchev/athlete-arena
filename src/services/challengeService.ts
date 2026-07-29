import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { DailyChallenge } from '@/types';

type DailyChallengeRow = Database['public']['Tables']['daily_challenges']['Row'];

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
