import { AUTH_EMAIL_REDIRECT_URL } from '@/constants/app';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';

import { normalizeUsername } from './validation';

interface SignUpParams {
  email: string;
  password: string;
  username: string;
}

export async function signInWithEmail(email: string, password: string) {
  assertSupabaseConfigured();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signUpWithEmail({ email, password, username }: SignUpParams) {
  assertSupabaseConfigured();

  const normalizedUsername = normalizeUsername(username);

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        username: normalizedUsername,
        display_name: normalizedUsername,
      },
      emailRedirectTo: AUTH_EMAIL_REDIRECT_URL,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  assertSupabaseConfigured();

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

/** Structured for future OAuth providers. */
export const authService = {
  signInWithEmail,
  signUpWithEmail,
  signOut,
};
