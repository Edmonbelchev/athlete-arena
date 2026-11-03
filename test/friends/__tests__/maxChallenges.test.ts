import { describe, expect, it } from '@jest/globals';

import { formatChallengeDuration, FRIEND_CHALLENGE_MAX_DURATIONS } from '@/constants/friendChallenges';
import { getHistoryKindLabel, getHistoryScoreLine, getHistoryTitle, type ChallengeHistoryEntry } from '@/types/challengeHistory';
import {
  formatFriendChallengeProgress,
  getFriendChallengeKindLabel,
  getFriendChallengeTitle,
  isMaxRepsChallenge,
  type FriendChallenge,
} from '@/types/friends';

function challenge(overrides: Partial<FriendChallenge>): FriendChallenge {
  return {
    participantId: 'p1',
    challengeId: 'c1',
    challengeKind: 'exercise',
    exerciseType: 'push_ups',
    targetReps: 20,
    xpReward: 50,
    message: null,
    timeLimitSeconds: null,
    maxEffort: false,
    deadlineAt: null,
    status: 'completed',
    completedReps: 0,
    completedAt: null,
    startedAt: null,
    xpEarned: null,
    coinsEarned: null,
    elapsedSeconds: null,
    completedRounds: null,
    workoutTotalReps: null,
    createdAt: '2026-11-03T10:00:00Z',
    creatorId: 'me',
    creatorUsername: 'me',
    creatorDisplayName: null,
    isCreator: true,
    opponentId: 'alex',
    opponentUsername: 'alex',
    opponentDisplayName: 'Alex',
    opponentStatus: 'completed',
    opponentCompletedReps: 0,
    opponentCompletedAt: null,
    opponentStartedAt: null,
    opponentElapsedSeconds: null,
    opponentCompletedRounds: null,
    opponentWorkoutTotalReps: null,
    winnerUserId: null,
    resolvedAt: null,
    creatorEmoteId: null,
    creatorEmoteEmoji: null,
    templateId: null,
    catalogWorkoutId: null,
    workoutTitle: null,
    workoutType: null,
    structureConfig: null,
    workoutExercises: [],
    ...overrides,
  };
}

describe('max challenge durations', () => {
  it('formats durations', () => {
    expect(formatChallengeDuration(30)).toBe('30 sec');
    expect(formatChallengeDuration(120)).toBe('2 min');
    expect(formatChallengeDuration(90)).toBe('1:30 min');
  });

  it('stays within the 30 s - 10 min window the server accepts', () => {
    for (const seconds of FRIEND_CHALLENGE_MAX_DURATIONS) {
      expect(seconds).toBeGreaterThanOrEqual(30);
      expect(seconds).toBeLessThanOrEqual(600);
    }
  });
});

describe('max challenge display', () => {
  const maxPushUps = challenge({ maxEffort: true, targetReps: 1, timeLimitSeconds: 120, completedReps: 42, opponentCompletedReps: 38 });
  const maxPlank = challenge({ maxEffort: true, targetReps: 1, exerciseType: 'plank', completedReps: 95, opponentCompletedReps: 80 });

  it('names the challenge by its goal, not the 1 rep minimum', () => {
    expect(getFriendChallengeTitle(maxPushUps)).toBe('MAX PUSH-UPS · 2 min');
    expect(getFriendChallengeTitle(maxPlank)).toBe('LONGEST PLANK');
    expect(getFriendChallengeKindLabel(maxPushUps)).toBe('MAX CHALLENGE');
    expect(getFriendChallengeTitle(challenge({}))).toBe('20 PUSH-UPS');
  });

  it('shows reps without a target', () => {
    expect(formatFriendChallengeProgress(maxPushUps, 'Alex')).toBe('You 42 reps · Alex 38 reps');
  });

  it('only treats max rep challenges (not max holds) as timed max reps', () => {
    expect(isMaxRepsChallenge(maxPushUps)).toBe(true);
    expect(isMaxRepsChallenge(maxPlank)).toBe(false);
    expect(isMaxRepsChallenge(challenge({}))).toBe(false);
  });

  it('shows max challenges in the activity history', () => {
    const entry = {
      entryId: 'e1',
      kind: 'friend',
      exerciseType: 'squats',
      targetReps: 1,
      completedReps: 61,
      xpReward: 50,
      status: 'completed',
      resultAt: '2026-11-03T10:00:00Z',
      opponentUsername: 'alex',
      opponentDisplayName: 'Alex',
      opponentCompletedReps: 55,
      opponentStatus: 'completed',
      raceSeconds: 60,
      opponentRaceSeconds: 60,
      winnerUserId: 'me',
      xpEarned: 80,
      friendChallengeKind: 'exercise',
      workoutTitle: null,
      workoutType: null,
      completedRounds: null,
      opponentCompletedRounds: null,
      maxEffort: true,
      timeLimitSeconds: 60,
    } satisfies ChallengeHistoryEntry;

    expect(getHistoryTitle(entry)).toBe('MAX SQUATS · 1 min');
    expect(getHistoryKindLabel(entry)).toBe('Friend max challenge');
    expect(getHistoryScoreLine(entry)).toBe('You 61 reps · Alex 55 reps');
  });
});
