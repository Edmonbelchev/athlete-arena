import { formatExerciseLabel, type ExerciseType } from '@/constants/challenges';

export const FRIEND_CHALLENGE_MAX_XP = 200;
export const FRIEND_CHALLENGE_MAX_COINS = 50;

export interface FriendChallengeRewardRule {
  xpPerRep: number;
  coinEveryReps: number;
  maxXp: number;
  maxCoins: number;
}

export const FRIEND_CHALLENGE_REWARD_RULES: Record<ExerciseType, FriendChallengeRewardRule> = {
  push_ups: {
    xpPerRep: 2,
    coinEveryReps: 5,
    maxXp: FRIEND_CHALLENGE_MAX_XP,
    maxCoins: FRIEND_CHALLENGE_MAX_COINS,
  },
  squats: {
    xpPerRep: 1,
    coinEveryReps: 10,
    maxXp: FRIEND_CHALLENGE_MAX_XP,
    maxCoins: FRIEND_CHALLENGE_MAX_COINS,
  },
  pull_ups: {
    xpPerRep: 3,
    coinEveryReps: 3,
    maxXp: FRIEND_CHALLENGE_MAX_XP,
    maxCoins: FRIEND_CHALLENGE_MAX_COINS,
  },
  burpees: {
    xpPerRep: 2,
    coinEveryReps: 4,
    maxXp: FRIEND_CHALLENGE_MAX_XP,
    maxCoins: FRIEND_CHALLENGE_MAX_COINS,
  },
  half_burpees: {
    xpPerRep: 2,
    coinEveryReps: 4,
    maxXp: FRIEND_CHALLENGE_MAX_XP,
    maxCoins: FRIEND_CHALLENGE_MAX_COINS,
  },
  jumping_jacks: {
    xpPerRep: 0.5,
    coinEveryReps: 10,
    maxXp: FRIEND_CHALLENGE_MAX_XP,
    maxCoins: FRIEND_CHALLENGE_MAX_COINS,
  },
};

export function calculateFriendChallengeXp(exerciseType: ExerciseType, reps: number): number {
  const rule = FRIEND_CHALLENGE_REWARD_RULES[exerciseType];
  return Math.min(Math.floor(Math.max(reps, 0) * rule.xpPerRep), rule.maxXp);
}

export function calculateFriendChallengeCoins(exerciseType: ExerciseType, reps: number): number {
  const rule = FRIEND_CHALLENGE_REWARD_RULES[exerciseType];
  return Math.min(Math.floor(Math.max(reps, 0) / rule.coinEveryReps), rule.maxCoins);
}

export function calculateFriendChallengeConsolationXp(
  exerciseType: ExerciseType,
  reps: number,
): number {
  return Math.max(1, Math.floor(calculateFriendChallengeXp(exerciseType, reps) * 0.25));
}

export function formatFriendChallengeRewardRule(exerciseType: ExerciseType): string {
  const rule = FRIEND_CHALLENGE_REWARD_RULES[exerciseType];
  const label = formatExerciseLabel(exerciseType);

  return `${label}: ${rule.xpPerRep} XP/rep (max ${rule.maxXp} XP) · 1 coin/${rule.coinEveryReps} reps (max ${rule.maxCoins} coins)`;
}

export function formatFriendChallengeRewardPreview(exerciseType: ExerciseType, reps: number): string {
  const xp = calculateFriendChallengeXp(exerciseType, reps);
  const coins = calculateFriendChallengeCoins(exerciseType, reps);
  const consolationXp = calculateFriendChallengeConsolationXp(exerciseType, reps);

  return `Winner up to +${xp} XP & +${coins} coins · Runner-up +${consolationXp} XP`;
}
