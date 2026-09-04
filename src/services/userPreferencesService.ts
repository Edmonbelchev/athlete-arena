import {
  getDefaultUserPreferences,
  mergeUserPreferences,
  parseUserPreferences,
  type UserPreferences,
} from '@/features/settings/userPreferences';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.preferences || Object.keys(data.preferences as object).length === 0) {
    return null;
  }

  return parseUserPreferences(
    data.preferences,
    getDefaultUserPreferences(false),
  );
}

export async function updateUserPreferences(
  userId: string,
  current: UserPreferences,
  patch: Partial<UserPreferences>,
): Promise<UserPreferences> {
  assertSupabaseConfigured();

  const next = mergeUserPreferences(current, patch);

  const { data, error } = await supabase
    .from('profiles')
    .update({ preferences: next as unknown as Json })
    .eq('id', userId)
    .select('preferences')
    .single();

  if (error) {
    throw error;
  }

  return parseUserPreferences(data.preferences, next);
}
