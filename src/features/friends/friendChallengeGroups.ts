import {
  getCreatorDisplayName,
  getOpponentDisplayName,
  type FriendChallenge,
  type FriendChallengePartnerSummary,
} from '@/types/friends';

export interface FriendChallengeGroup {
  friendId: string;
  friendName: string;
  friendUsername: string;
  challenges: FriendChallenge[];
}

export function getChallengeFriendId(challenge: FriendChallenge): string {
  return challenge.isCreator ? challenge.opponentId : challenge.creatorId;
}

export function getChallengeFriendName(challenge: FriendChallenge): string {
  return challenge.isCreator ? getOpponentDisplayName(challenge) : getCreatorDisplayName(challenge);
}

export function getChallengeFriendUsername(challenge: FriendChallenge): string {
  return challenge.isCreator ? challenge.opponentUsername : challenge.creatorUsername;
}

export function isActiveFriendChallenge(challenge: FriendChallenge): boolean {
  if (challenge.status === 'declined' || challenge.status === 'expired') {
    return false;
  }

  if (challenge.resolvedAt !== null) {
    return false;
  }

  return true;
}

export function splitFriendChallenges(challenges: FriendChallenge[]): {
  active: FriendChallenge[];
  history: FriendChallenge[];
} {
  const active: FriendChallenge[] = [];
  const history: FriendChallenge[] = [];

  for (const challenge of challenges) {
    if (isActiveFriendChallenge(challenge)) {
      active.push(challenge);
    } else {
      history.push(challenge);
    }
  }

  return { active, history };
}

export function summarizeFriendChallengePartners(
  challenges: FriendChallenge[],
): FriendChallengePartnerSummary[] {
  const partners = new Map<string, FriendChallengePartnerSummary>();

  for (const challenge of challenges) {
    const friendId = getChallengeFriendId(challenge);
    const existing = partners.get(friendId);

    if (existing) {
      if (isActiveFriendChallenge(challenge)) {
        existing.activeCount += 1;
      } else {
        existing.historyCount += 1;
      }

      if (challenge.createdAt > existing.latestCreatedAt) {
        existing.latestCreatedAt = challenge.createdAt;
      }

      continue;
    }

    partners.set(friendId, {
      friendId,
      username: getChallengeFriendUsername(challenge),
      displayName: getChallengeFriendName(challenge),
      activeCount: isActiveFriendChallenge(challenge) ? 1 : 0,
      historyCount: isActiveFriendChallenge(challenge) ? 0 : 1,
      latestCreatedAt: challenge.createdAt,
    });
  }

  return Array.from(partners.values()).sort(
    (left, right) => new Date(right.latestCreatedAt).getTime() - new Date(left.latestCreatedAt).getTime(),
  );
}

export function formatFriendChallengePartnerMeta(partner: FriendChallengePartnerSummary): string {
  const parts: string[] = [`@${partner.username}`];

  if (partner.activeCount > 0) {
    parts.push(`${partner.activeCount} active ${partner.activeCount === 1 ? 'race' : 'races'}`);
  }

  if (partner.historyCount > 0) {
    parts.push(`${partner.historyCount} completed`);
  }

  return parts.join(' · ');
}

export function groupChallengesByFriend(challenges: FriendChallenge[]): FriendChallengeGroup[] {
  const groups = new Map<string, FriendChallengeGroup>();

  for (const challenge of challenges) {
    const friendId = getChallengeFriendId(challenge);
    const existing = groups.get(friendId);

    if (existing) {
      existing.challenges.push(challenge);
      continue;
    }

    groups.set(friendId, {
      friendId,
      friendName: getChallengeFriendName(challenge),
      friendUsername: getChallengeFriendUsername(challenge),
      challenges: [challenge],
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      challenges: group.challenges.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    }))
    .sort((a, b) => {
      const aLatest = a.challenges[0]?.createdAt ?? '';
      const bLatest = b.challenges[0]?.createdAt ?? '';
      return new Date(bLatest).getTime() - new Date(aLatest).getTime();
    });
}
