import { AUTH_EMAIL_REDIRECT_URL } from '@/constants/app';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';

import { isValidEmail, isValidUsername, normalizeUsername } from './validation';

interface SignUpParams {
  email: string;
  password: string;
  username: string;
}

export class UsernameTakenError extends Error {
  constructor() {
    super('username_taken');
    this.name = 'UsernameTakenError';
  }
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('email_already_registered');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export async function isUsernameAvailable(
  username: string,
  excludeUserId?: string,
): Promise<boolean> {
  assertSupabaseConfigured();

  const normalizedUsername = normalizeUsername(username);
  if (!isValidUsername(normalizedUsername)) {
    return false;
  }

  const { data, error } = await supabase.rpc('is_username_available', {
    p_username: normalizedUsername,
    p_exclude_user_id: excludeUserId ?? null,
  });

  if (error) {
    throw error;
  }

  return data === true;
}

export async function isEmailRegistered(email: string): Promise<boolean> {
  assertSupabaseConfigured();

  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) {
    return false;
  }

  const { data, error } = await supabase.rpc('is_email_registered', {
    p_email: trimmedEmail,
  });

  if (error) {
    throw error;
  }

  return data === true;
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
  const trimmedEmail = email.trim();

  if (!(await isUsernameAvailable(normalizedUsername))) {
    throw new UsernameTakenError();
  }

  if (await isEmailRegistered(trimmedEmail)) {
    throw new EmailAlreadyRegisteredError();
  }

  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
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

export async function resendSignUpConfirmation(email: string) {
  assertSupabaseConfigured();

  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) {
    throw new Error('Enter a valid email address.');
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: trimmedEmail,
    options: {
      emailRedirectTo: AUTH_EMAIL_REDIRECT_URL,
    },
  });

  if (error) {
    throw error;
  }
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
  isUsernameAvailable,
  isEmailRegistered,
  resendSignUpConfirmation,
};
