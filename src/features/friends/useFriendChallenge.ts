import { useCallback, useEffect, useState } from 'react';

import { formatUserError } from '@/lib/errors';
import { getFriendChallengeByParticipantId } from '@/services/friendChallengeService';
import type { FriendChallenge } from '@/types/friends';

export function useFriendChallenge(participantId: string | undefined) {
  const [challenge, setChallenge] = useState<FriendChallenge | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(participantId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!participantId) {
      setChallenge(null);
      setIsLoading(false);
      setError('Challenge not found');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const loaded = await getFriendChallengeByParticipantId(participantId);

      if (!loaded) {
        setChallenge(null);
        setError('Challenge not found');
        return;
      }

      setChallenge(loaded);
    } catch (err) {
      setChallenge(null);
      setError(formatUserError(err, 'Failed to load challenge'));
    } finally {
      setIsLoading(false);
    }
  }, [participantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { challenge, isLoading, error, refresh };
}
