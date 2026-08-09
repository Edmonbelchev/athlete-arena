import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth';
import { formatUserError } from '@/lib/errors';
import { getFriendProfile } from '@/services/friendsService';
import type { FriendPublicProfile } from '@/types/friends';

export function useFriendProfile(userId?: string) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<FriendPublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(userId && session));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session?.user.id || !userId) {
      setProfile(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextProfile = await getFriendProfile(userId);
      setProfile(nextProfile);
    } catch (err) {
      setProfile(null);
      setError(formatUserError(err, 'Failed to load profile'));
    } finally {
      setIsLoading(false);
    }
  }, [session?.user.id, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profile, isLoading, error, refresh };
}
