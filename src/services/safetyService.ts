import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { UserReportReason } from '@/types/database';

/**
 * User safety (App Store Guideline 1.2): blocking, reporting, and the hidden-user list used to
 * keep blocked people out of leaderboards, search, and friend requests in both directions.
 */

export interface BlockedUser {
  userId: string;
  username: string;
  displayName: string | null;
  blockedAt: string;
}

const HIDDEN_CACHE_MS = 60_000;
let hiddenCache: { ids: Set<string>; loadedAt: number } | null = null;
let hiddenRequest: Promise<Set<string>> | null = null;

/** Drop the cached hidden-user list (after blocking / unblocking, or on sign-out). */
export function invalidateHiddenUsers(): void {
  hiddenCache = null;
  hiddenRequest = null;
}

/**
 * People the current user should not see: everyone they blocked and everyone who blocked them.
 * Cached briefly; on failure an empty set is returned so lists still load.
 */
export async function getHiddenUserIds(): Promise<Set<string>> {
  if (hiddenCache && Date.now() - hiddenCache.loadedAt < HIDDEN_CACHE_MS) {
    return hiddenCache.ids;
  }

  hiddenRequest ??= (async () => {
    try {
      assertSupabaseConfigured();
      const { data, error } = await supabase.rpc('get_hidden_user_ids');
      if (error) {
        throw error;
      }
      const ids = new Set((data ?? []).map((row) => row.user_id));
      hiddenCache = { ids, loadedAt: Date.now() };
      return ids;
    } catch {
      return new Set<string>();
    } finally {
      hiddenRequest = null;
    }
  })();

  return hiddenRequest;
}

/** Removes hidden (blocked / blocking) users from a list. */
export async function withoutHiddenUsers<T>(items: T[], userIdOf: (item: T) => string): Promise<T[]> {
  const hidden = await getHiddenUserIds();
  return hidden.size === 0 ? items : items.filter((item) => !hidden.has(userIdOf(item)));
}

export async function blockUser(userId: string): Promise<void> {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  invalidateHiddenUsers();
  if (error) {
    throw error;
  }
}

export async function unblockUser(userId: string): Promise<void> {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc('unblock_user', { p_user_id: userId });
  invalidateHiddenUsers();
  if (error) {
    throw error;
  }
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('get_blocked_users');
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    blockedAt: row.blocked_at,
  }));
}

export async function reportUser(userId: string, reason: UserReportReason, details?: string): Promise<void> {
  assertSupabaseConfigured();
  const { error } = await supabase.rpc('report_user', {
    p_user_id: userId,
    p_reason: reason,
    p_details: details?.trim() ? details.trim() : null,
  });
  if (error) {
    throw error;
  }
}

/** False when the username contains language that is not allowed. */
export async function isUsernameAllowed(username: string): Promise<boolean> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('is_username_allowed', { p_username: username });
  if (error) {
    throw error;
  }
  return data !== false;
}

export const REPORT_REASONS: { value: UserReportReason; label: string }[] = [
  { value: 'inappropriate_name', label: 'Inappropriate username or name' },
  { value: 'inappropriate_bio', label: 'Inappropriate bio' },
  { value: 'offensive_avatar', label: 'Offensive avatar' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'cheating', label: 'Cheating' },
  { value: 'other', label: 'Something else' },
];
