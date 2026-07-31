import { assertSupabaseConfigured } from '@/lib/supabase';
import type { ChallengeNotification } from '@/features/notifications/types';
import { syncChallengeNotifications } from '@/services/challengeNotificationService';
import { syncFriendNotifications } from '@/services/friendNotificationService';

export async function syncAllNotifications(
  existing: ChallengeNotification[],
  currentUserId: string,
): Promise<ChallengeNotification[]> {
  if (!currentUserId) {
    return existing;
  }

  assertSupabaseConfigured();

  const afterChallenges = await syncChallengeNotifications(existing);
  return syncFriendNotifications(afterChallenges, currentUserId);
}
