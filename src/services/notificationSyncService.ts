import { assertSupabaseConfigured } from '@/lib/supabase';
import type { ChallengeNotification } from '@/features/notifications/types';
import { syncChallengeNotifications } from '@/services/challengeNotificationService';
import { syncFriendNotifications } from '@/services/friendNotificationService';
import { syncWorkoutShareNotifications } from '@/services/customWorkoutNotificationService';

export async function syncAllNotifications(
  existing: ChallengeNotification[],
  currentUserId: string,
): Promise<ChallengeNotification[]> {
  if (!currentUserId) {
    return existing;
  }

  assertSupabaseConfigured();

  const afterChallenges = await syncChallengeNotifications(existing);
  const afterFriends = await syncFriendNotifications(afterChallenges, currentUserId);
  return syncWorkoutShareNotifications(afterFriends, currentUserId);
}
