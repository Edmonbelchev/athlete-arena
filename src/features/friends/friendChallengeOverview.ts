import {
  getChallengeFriendId,
  getChallengeFriendName,
  getChallengeFriendUsername,
  isActiveFriendChallenge,
} from '@/features/friends/friendChallengeGroups';
import {
  hasFriendChallengeStarted,
  isFriendChallengeWaitingOnOpponent,
  type FriendChallenge,
} from '@/types/friends';

export type FriendChallengeAction = 'respond' | 'start' | 'continue';

export interface FriendChallengeRivalSummary {
  friendId: string;
  username: string;
  displayName: string;
  activeCount: number;
  wins: number;
  losses: number;
  ties: number;
  latestCreatedAt: string;
}

export interface FriendChallengeOverview {
  /** Active challenges waiting on me - accept, start, or finish. */
  yourMove: FriendChallenge[];
  /** I finished; the friend still has to race. */
  waiting: FriendChallenge[];
  rivals: FriendChallengeRivalSummary[];
  wins: number;
  losses: number;
}

/** What I have to do next on an active challenge, or null when it is not my move. */
export function getFriendChallengeAction(challenge: FriendChallenge): FriendChallengeAction | null {
  if (!isActiveFriendChallenge(challenge) || isFriendChallengeWaitingOnOpponent(challenge)) {
    return null;
  }

  if (challenge.status === 'pending') {
    return 'respond';
  }

  if (challenge.status === 'in_progress') {
    return hasFriendChallengeStarted(challenge) ? 'continue' : 'start';
  }

  return null;
}

type Result = 'win' | 'loss' | 'tie' | null;

function getResult(challenge: FriendChallenge, myUserId: string): Result {
  if (!challenge.resolvedAt || challenge.status !== 'completed') {
    return null;
  }

  if (!challenge.winnerUserId) {
    return challenge.opponentStatus === 'completed' ? 'tie' : null;
  }

  return challenge.winnerUserId === myUserId ? 'win' : 'loss';
}

export function buildFriendChallengeOverview(
  challenges: FriendChallenge[],
  myUserId: string,
): FriendChallengeOverview {
  const yourMove: FriendChallenge[] = [];
  const waiting: FriendChallenge[] = [];
  const rivals = new Map<string, FriendChallengeRivalSummary>();
  let wins = 0;
  let losses = 0;

  for (const challenge of challenges) {
    if (getFriendChallengeAction(challenge)) {
      yourMove.push(challenge);
    } else if (isFriendChallengeWaitingOnOpponent(challenge)) {
      waiting.push(challenge);
    }

    const friendId = getChallengeFriendId(challenge);
    const rival =
      rivals.get(friendId) ??
      {
        friendId,
        username: getChallengeFriendUsername(challenge),
        displayName: getChallengeFriendName(challenge),
        activeCount: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        latestCreatedAt: challenge.createdAt,
      };

    if (isActiveFriendChallenge(challenge)) {
      rival.activeCount += 1;
    }

    const result = getResult(challenge, myUserId);
    if (result === 'win') {
      rival.wins += 1;
      wins += 1;
    } else if (result === 'loss') {
      rival.losses += 1;
      losses += 1;
    } else if (result === 'tie') {
      rival.ties += 1;
    }

    if (challenge.createdAt > rival.latestCreatedAt) {
      rival.latestCreatedAt = challenge.createdAt;
    }

    rivals.set(friendId, rival);
  }

  // Requests to respond to first, then challenges ready to race.
  const actionOrder: Record<FriendChallengeAction, number> = { respond: 0, continue: 1, start: 2 };
  yourMove.sort(
    (left, right) =>
      actionOrder[getFriendChallengeAction(left) ?? 'start'] - actionOrder[getFriendChallengeAction(right) ?? 'start'] ||
      right.createdAt.localeCompare(left.createdAt),
  );

  return {
    yourMove,
    waiting,
    rivals: Array.from(rivals.values()).sort(
      (left, right) =>
        right.activeCount - left.activeCount || right.latestCreatedAt.localeCompare(left.latestCreatedAt),
    ),
    wins,
    losses,
  };
}
