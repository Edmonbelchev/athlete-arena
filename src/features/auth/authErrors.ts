import type { AuthError } from '@supabase/supabase-js';

export function isEmailNotConfirmedError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return false;
  }

  return String((error as AuthError).message).includes('Email not confirmed');
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'username_taken') {
      return 'That username is already taken.';
    }

    if (error.message === 'email_already_registered') {
      return 'An account with this email already exists.';
    }
  }

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

  if (
    message.includes('username_taken') ||
    (message.includes('duplicate key value') && message.includes('username'))
  ) {
    return 'That username is already taken.';
  }

  if (message.includes('Email not confirmed')) {
    return 'Confirm your email before signing in.';
  }

  if (message.includes('For security purposes, you can only request this once every')) {
    return 'Please wait a moment before requesting another confirmation email.';
  }

  return message;
}
