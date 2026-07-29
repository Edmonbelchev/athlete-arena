import { PostgrestError } from '@supabase/supabase-js';

const NETWORK_ERROR_PATTERN =
  /network|fetch failed|failed to fetch|timeout|offline|connection|ECONNREFUSED/i;

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return NETWORK_ERROR_PATTERN.test(message);
}

export function formatUserError(error: unknown, fallback = 'Something went wrong'): string {
  if (isNetworkError(error)) {
    return 'Network error - check your connection and try again.';
  }

  if (error instanceof PostgrestError) {
    if (error.code === 'PGRST116') {
      return 'Record not found.';
    }
    return error.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
