import type { AuthError } from '@supabase/supabase-js';

export function getAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return 'Something went wrong. Please try again.';
  }

  const message = String((error as AuthError).message);

  if (message.includes('Invalid login credentials')) {
    return 'Incorrect email or password.';
  }

  if (message.includes('User already registered')) {
    return 'An account with this email already exists.';
  }

  if (message.includes('Password should be at least')) {
    return 'Password must be at least 8 characters.';
  }

  if (message.includes('Unable to validate email address')) {
    return 'Enter a valid email address.';
  }

  if (message.includes('duplicate key value') && message.includes('username')) {
    return 'That username is already taken.';
  }

  if (message.includes('Email not confirmed')) {
    return 'Confirm your email before signing in.';
  }

  return message;
}
