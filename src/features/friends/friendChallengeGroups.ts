import {
  getCreatorDisplayName,
  getOpponentDisplayName,
  type FriendChallenge,
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
