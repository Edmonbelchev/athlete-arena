import type { ExerciseType } from '@/constants/challenges';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';
export type ChallengeStatus = 'pending' | 'in_progress' | 'completed' | 'declined' | 'expired';

export interface FriendSummary {
  friendshipId: string;
  friendId: string;
  username: string;
  displayName: string | null;
  level: number;
  currentStreak: number;
}

export interface FriendRequest {
  friendshipId: string;
  requesterId: string;
  username: string;
  displayName: string | null;
  createdAt: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string | null;
}

export interface FriendChallenge {
  participantId: string;
  challengeId: string;
  exerciseType: ExerciseType;
  targetReps: number;
  xpReward: number;
  message: string | null;
  /** Max seconds allowed per attempt once started. */
  timeLimitSeconds: number | null;
  deadlineAt: string | null;
  status: ChallengeStatus;
  completedReps: number;
  completedAt: string | null;
  startedAt: string | null;
  xpEarned: number | null;
  createdAt: string;
  creatorId: string;
  creatorUsername: string;
  creatorDisplayName: string | null;
  isCreator: boolean;
  opponentId: string;
  opponentUsername: string;
  opponentDisplayName: string | null;
  opponentStatus: ChallengeStatus;
  opponentCompletedReps: number;
  opponentCompletedAt: string | null;
  opponentStartedAt: string | null;
  winnerUserId: string | null;
  resolvedAt: string | null;
}

export function getOpponentDisplayName(challenge: FriendChallenge): string {
  return challenge.opponentDisplayName ?? challenge.opponentUsername;
}

export function getCreatorDisplayName(challenge: FriendChallenge): string {
  return challenge.creatorDisplayName ?? challenge.creatorUsername;
}

export function isFriendChallengeExpired(challenge: FriendChallenge): boolean {
  return challenge.status === 'expired';
}

export function hasFriendChallengeStarted(challenge: FriendChallenge): boolean {
  return challenge.startedAt !== null;
}

export function getFriendChallengeRaceSeconds(
  startedAt: string | null,
  completedAt: string | null,
  now = Date.now(),
): number | null {
  if (!startedAt) {
    return null;
  }

  const startMs = new Date(startedAt).getTime();
  const endMs = completedAt ? new Date(completedAt).getTime() : now;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

export function getMyRaceSeconds(challenge: FriendChallenge, now = Date.now()): number | null {
  return getFriendChallengeRaceSeconds(challenge.startedAt, challenge.completedAt, now);
}

export function getOpponentRaceSeconds(challenge: FriendChallenge): number | null {
  return getFriendChallengeRaceSeconds(challenge.opponentStartedAt, challenge.opponentCompletedAt);
}

export function isFriendChallengeResolved(challenge: FriendChallenge): boolean {
  return challenge.resolvedAt !== null;
}

export function didIWinFriendChallenge(challenge: FriendChallenge, myUserId: string): boolean | null {
  if (!challenge.resolvedAt || !challenge.winnerUserId) {
    return null;
  }
  return challenge.winnerUserId === myUserId;
}

export function isFriendChallengeWaitingOnOpponent(challenge: FriendChallenge): boolean {
  return (
    challenge.status === 'completed' &&
    challenge.opponentStatus !== 'completed' &&
    challenge.resolvedAt === null
  );
}

export function getFriendChallengeSecondsRemaining(
  challenge: FriendChallenge,
  now = Date.now(),
): number | null {
  if (!challenge.timeLimitSeconds || !challenge.startedAt || challenge.completedAt) {
    return null;
  }

  const elapsed = getMyRaceSeconds(challenge, now) ?? 0;
  return Math.max(0, challenge.timeLimitSeconds - elapsed);
}

/** @deprecated Use hasFriendChallengeStarted for race mode. */
export function hasFriendChallengeTimerStarted(challenge: FriendChallenge): boolean {
  return hasFriendChallengeStarted(challenge);
}
