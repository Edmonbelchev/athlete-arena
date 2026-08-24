import { normalizeUsername, isValidUsername } from '@/features/auth/validation';
import { isUsernameAvailable } from '@/features/auth/authService';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ProfileStats, UpdateProfileInput } from '@/types/profile';
import type { Profile } from '@/types';

export async function getProfile(userId: string): Promise<Profile | null> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from('daily_challenges')
    .select('exercise_type, completed_reps')
    .eq('user_id', userId)
    .eq('status', 'completed');

  if (error) {
    throw error;
  }

  let completedChallenges = 0;
  let totalPushUps = 0;
  let totalSquats = 0;
  let totalPullUps = 0;
  let totalDips = 0;
  let totalBurpees = 0;
  let totalHalfBurpees = 0;
  let totalJumpingJacks = 0;

  for (const row of data ?? []) {
    completedChallenges += 1;
    switch (row.exercise_type) {
      case 'push_ups':
        totalPushUps += row.completed_reps;
        break;
      case 'squats':
        totalSquats += row.completed_reps;
        break;
      case 'pull_ups':
        totalPullUps += row.completed_reps;
        break;
      case 'dips':
        totalDips += row.completed_reps;
        break;
      case 'burpees':
        totalBurpees += row.completed_reps;
        break;
      case 'half_burpees':
        totalHalfBurpees += row.completed_reps;
        break;
      case 'jumping_jacks':
        totalJumpingJacks += row.completed_reps;
        break;
    }
  }

  return {
    completedChallenges,
    totalPushUps,
    totalSquats,
    totalPullUps,
    totalDips,
    totalBurpees,
    totalHalfBurpees,
    totalJumpingJacks,
  };
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<Profile> {
  assertSupabaseConfigured();

  const payload: UpdateProfileInput = {};

  if (input.username !== undefined) {
    const normalizedUsername = normalizeUsername(input.username);
    if (!isValidUsername(normalizedUsername)) {
      throw new Error('Username must be 3–30 characters: lowercase letters, numbers, underscore');
    }

    const available = await isUsernameAvailable(normalizedUsername, userId);
    if (!available) {
      throw new Error('username_taken');
    }

    payload.username = normalizedUsername;
  }

  if (input.display_name !== undefined) {
    const trimmed = input.display_name?.trim() ?? '';
    payload.display_name = trimmed.length > 0 ? trimmed : null;
  }

  if (input.avatar_url !== undefined) {
    payload.avatar_url = input.avatar_url;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}
