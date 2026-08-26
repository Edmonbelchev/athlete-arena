import type { ExerciseType } from '@/constants/challenges';
import { formatExerciseLabel } from '@/constants/challenges';
import { formatRaceTime } from '@/constants/friendChallenges';
import type { CustomWorkoutExercise, CustomWorkoutType } from '@/types/customWorkouts';

import type { ShopAvatarDisplay, ShopFrameDisplay } from '@/types/shop';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';
export type ChallengeStatus = 'pending' | 'in_progress' | 'completed' | 'declined' | 'expired';

export type FriendChallengeKind = 'exercise' | 'workout';

export interface FriendChallengeRequestQuota {
  usedCount: number;
  monthlyLimit: number | null;
  isPremium: boolean;
  canCreate: boolean;
}

export interface FriendSummary {
  friendshipId: string;
  friendId: string;
  username: string;
  displayName: string | null;
  level: number;
  currentStreak: number;
  avatarUrl: string | null;
  avatar: ShopAvatarDisplay | null;
  frame: ShopFrameDisplay | null;
}

export interface FriendPublicProfile {
  userId: string;
  username: string;
  displayName: string | null;
  level: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  avatarUrl: string | null;
  avatar: ShopAvatarDisplay | null;
  frame: ShopFrameDisplay | null;
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

export interface FriendWithActiveChallengesSummary {
  friendId: string;
  username: string;
  displayName: string | null;
  activeCount: number;
  historyCount: number;
  latestCreatedAt: string;
}

export type FriendChallengePartnerSummary = FriendWithActiveChallengesSummary;

export interface FriendChallenge {
  participantId: string;
  challengeId: string;
  challengeKind: FriendChallengeKind;
  exerciseType: ExerciseType | null;
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
  coinsEarned: number | null;
  elapsedSeconds: number | null;
  completedRounds: number | null;
  workoutTotalReps: number | null;
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
  opponentElapsedSeconds: number | null;
  opponentCompletedRounds: number | null;
  opponentWorkoutTotalReps: number | null;
  winnerUserId: string | null;
  resolvedAt: string | null;
  creatorEmoteId: string | null;
  creatorEmoteEmoji: string | null;
  templateId: string | null;
  catalogWorkoutId: string | null;
  workoutTitle: string | null;
  workoutType: CustomWorkoutType | null;
  structureConfig: unknown;
  workoutExercises: CustomWorkoutExercise[];
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

export function getFriendChallengeTitle(challenge: FriendChallenge): string {
  if (challenge.challengeKind === 'workout') {
    return challenge.workoutTitle ?? 'Workout challenge';
  }

  return `${challenge.targetReps} ${formatExerciseLabel(challenge.exerciseType ?? 'push_ups', true)}`;
}

export function getFriendChallengeKindLabel(challenge: FriendChallenge): string {
  return challenge.challengeKind === 'workout' ? 'WORKOUT CHALLENGE' : 'SPEED RACE';
}

export function formatFriendWorkoutScore(challenge: FriendChallenge): string {
  if (challenge.workoutType === 'for_time') {
    const myTime = challenge.elapsedSeconds ?? getMyRaceSeconds(challenge);
    const opponentTime = challenge.opponentElapsedSeconds ?? getOpponentRaceSeconds(challenge);
    const opponentName = getOpponentDisplayName(challenge);

    if (myTime !== null) {
      return `You ${formatRaceTime(myTime)}${
        opponentTime !== null ? ` · ${opponentName} ${formatRaceTime(opponentTime)}` : ''
      }`;
    }
  }

  const myRounds = challenge.completedRounds ?? 0;
  const opponentRounds = challenge.opponentCompletedRounds ?? 0;
  const myReps = challenge.workoutTotalReps ?? challenge.completedReps;
  const opponentReps = challenge.opponentWorkoutTotalReps ?? challenge.opponentCompletedReps;
  const opponentName = getOpponentDisplayName(challenge);

  return `You ${myRounds} rnd · ${myReps} reps · ${opponentName} ${opponentRounds} rnd · ${opponentReps} reps`;
}
