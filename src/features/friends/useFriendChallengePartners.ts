import { useMemo } from 'react';

import { summarizeFriendChallengePartners } from '@/features/friends/friendChallengeGroups';
import { useFriendChallenges } from '@/features/friends/useFriendChallenges';

export function useFriendChallengePartners() {
  const { challenges, isLoading, error, refresh } = useFriendChallenges();

  const partners = useMemo(() => summarizeFriendChallengePartners(challenges), [challenges]);
  const activePartners = useMemo(
    () => partners.filter((partner) => partner.activeCount > 0),
    [partners],
  );
  const historyOnlyPartners = useMemo(
    () => partners.filter((partner) => partner.historyCount > 0 && partner.activeCount === 0),
    [partners],
  );

  return {
    partners,
    activePartners,
    historyOnlyPartners,
    isLoading,
    error,
    refresh,
  };
}
