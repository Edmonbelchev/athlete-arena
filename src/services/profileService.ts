import { normalizeUsername, isValidUsername } from '@/features/auth/validation';
import { isUsernameAvailable } from '@/features/auth/authService';
import { movementStatsToProfileStats } from '@/features/stats/movementStatsUtils';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { getMovementStats } from '@/services/statsService';
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

export async function getProfileStats(_userId: string): Promise<ProfileStats> {
  const movement = await getMovementStats();
  return movementStatsToProfileStats(movement);
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
