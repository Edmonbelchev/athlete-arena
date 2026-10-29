import { formatExerciseLabel, type ExerciseType } from '@/constants/challenges';
import type { FriendChallengeKind } from '@/types/friends';

/*
 * Friend challenge rewards — keep in sync with 120_friend_challenge_reward_rework.sql.
 *
 * Each challenge pays a finish reward, plus either a win bonus or (when the friend
 * declines or lets it expire) a smaller no-show bonus. Every part scales with reps:
 * exercise challenges reach the full amount at a per-exercise target, workouts at
 * WORKOUT_FULL_REWARD_REPS total reps done.
 */

export type FriendChallengeRewardPart = 'finish' | 'win' | 'noShow';

export interface FriendChallengeRewardAmount {
  xp: number;
  coins: number;
}

/** Full exercise-challenge amounts; workouts pay double. */
export const FRIEND_CHALLENGE_REWARDS: Record<FriendChallengeRewardPart, FriendChallengeRewardAmount> = {
  finish: { xp: 50, coins: 30 },
  win: { xp: 35, coins: 20 },
  noShow: { xp: 20, coins: 10 },
};

const WORKOUT_REWARD_MULTIPLIER = 2;

/** Days after a challenge is sent before anyone who has not finished is marked expired. */
export const FRIEND_CHALLENGE_EXPIRY_DAYS = 7;

type FriendChallengeRewardExerciseType = ExerciseType | 'dips';

/** Target reps at which an exercise challenge pays its full reward. */
export const FRIEND_CHALLENGE_FULL_REWARD_REPS: Record<FriendChallengeRewardExerciseType, number> = {
  push_ups: 30,
  squats: 50,
  pull_ups: 15,
  burpees: 20,
  half_burpees: 25,
  jumping_jacks: 60,
  jumping_squats: 40,
  lunges: 50,
  dips: 50,
};

/** Total reps done at which a workout challenge pays its full reward. */
export const WORKOUT_FULL_REWARD_REPS = 100;

export function isFriendChallengeExerciseType(
  exerciseType: string | null | undefined,
): exerciseType is FriendChallengeRewardExerciseType {
  return !!exerciseType && exerciseType in FRIEND_CHALLENGE_FULL_REWARD_REPS;
}

/**
 * One reward part, scaled by reps (rounded down).
 * `reps` is the target reps for exercise challenges and the reps done for workouts.
 */
export function getFriendChallengeReward(
  kind: FriendChallengeKind,
  part: FriendChallengeRewardPart,
  reps: number,
  exerciseType?: ExerciseType | null,
): FriendChallengeRewardAmount {
  const fullReps =
    kind === 'workout'
      ? WORKOUT_FULL_REWARD_REPS
      : isFriendChallengeExerciseType(exerciseType)
        ? FRIEND_CHALLENGE_FULL_REWARD_REPS[exerciseType]
        : 50;
  const multiplier = kind === 'workout' ? WORKOUT_REWARD_MULTIPLIER : 1;
  const scale = Math.min(Math.max(reps, 0), fullReps) / fullReps;
  const base = FRIEND_CHALLENGE_REWARDS[part];

  return {
    xp: Math.floor(base.xp * multiplier * scale),
    coins: Math.floor(base.coins * multiplier * scale),
  };
}

/** Full workout challenge amounts (at WORKOUT_FULL_REWARD_REPS reps or more). */
export const FRIEND_CHALLENGE_PARTICIPATION_XP = FRIEND_CHALLENGE_REWARDS.finish.xp * WORKOUT_REWARD_MULTIPLIER;
export const FRIEND_CHALLENGE_PARTICIPATION_COINS = FRIEND_CHALLENGE_REWARDS.finish.coins * WORKOUT_REWARD_MULTIPLIER;
export const FRIEND_CHALLENGE_WINNER_BONUS_XP = FRIEND_CHALLENGE_REWARDS.win.xp * WORKOUT_REWARD_MULTIPLIER;
export const FRIEND_CHALLENGE_WINNER_BONUS_COINS = FRIEND_CHALLENGE_REWARDS.win.coins * WORKOUT_REWARD_MULTIPLIER;
export const FRIEND_CHALLENGE_NO_SHOW_BONUS_XP = FRIEND_CHALLENGE_REWARDS.noShow.xp * WORKOUT_REWARD_MULTIPLIER;
export const FRIEND_CHALLENGE_NO_SHOW_BONUS_COINS = FRIEND_CHALLENGE_REWARDS.noShow.coins * WORKOUT_REWARD_MULTIPLIER;

export const FRIEND_CHALLENGE_WINNER_TOTAL_XP =
  FRIEND_CHALLENGE_PARTICIPATION_XP + FRIEND_CHALLENGE_WINNER_BONUS_XP;

export const FRIEND_CHALLENGE_WINNER_TOTAL_COINS =
  FRIEND_CHALLENGE_PARTICIPATION_COINS + FRIEND_CHALLENGE_WINNER_BONUS_COINS;

/** Most an exercise challenge can pay (finish + win at the full-reward reps). */
export const FRIEND_CHALLENGE_MAX_XP = FRIEND_CHALLENGE_REWARDS.finish.xp + FRIEND_CHALLENGE_REWARDS.win.xp;
export const FRIEND_CHALLENGE_MAX_COINS = FRIEND_CHALLENGE_REWARDS.finish.coins + FRIEND_CHALLENGE_REWARDS.win.coins;

/** Winner total XP (finish + win) for an exercise challenge. */
export function calculateFriendChallengeXp(exerciseType: ExerciseType, reps: number): number {
  return (
    getFriendChallengeReward('exercise', 'finish', reps, exerciseType).xp +
    getFriendChallengeReward('exercise', 'win', reps, exerciseType).xp
  );
}

/** Winner total coins (finish + win) for an exercise challenge. */
export function calculateFriendChallengeCoins(exerciseType: ExerciseType, reps: number): number {
  return (
    getFriendChallengeReward('exercise', 'finish', reps, exerciseType).coins +
    getFriendChallengeReward('exercise', 'win', reps, exerciseType).coins
  );
}

export function formatFriendChallengeRewardRule(exerciseType: ExerciseType): string {
  const fullReps = isFriendChallengeExerciseType(exerciseType)
    ? FRIEND_CHALLENGE_FULL_REWARD_REPS[exerciseType]
    : 50;

  return `Full reward at ${fullReps} ${formatExerciseLabel(exerciseType).toLowerCase()} · fewer reps pay less`;
}

export function formatFriendChallengeRewardPreview(exerciseType: ExerciseType, reps: number): string {
  const finish = getFriendChallengeReward('exercise', 'finish', reps, exerciseType);

  return `Winner +${calculateFriendChallengeXp(exerciseType, reps)} XP & +${calculateFriendChallengeCoins(exerciseType, reps)} coins · Finish +${finish.xp} XP & +${finish.coins} coins`;
}

export function formatFriendChallengeWorkoutRewardPreview(): string {
  return `Finish: up to +${FRIEND_CHALLENGE_PARTICIPATION_XP} XP & +${FRIEND_CHALLENGE_PARTICIPATION_COINS} coins · Winner bonus: up to +${FRIEND_CHALLENGE_WINNER_BONUS_XP} XP & +${FRIEND_CHALLENGE_WINNER_BONUS_COINS} coins`;
}

/*
 * Challenges finished before coins were stored per participant only kept XP,
 * so their coins are inferred from the reward rules in force at the time.
 */
const LEGACY_EXERCISE_RULES: Record<FriendChallengeRewardExerciseType, { xpPerRep: number; coinEveryReps: number }> = {
  push_ups: { xpPerRep: 2, coinEveryReps: 5 },
  squats: { xpPerRep: 1, coinEveryReps: 10 },
  pull_ups: { xpPerRep: 3, coinEveryReps: 3 },
  burpees: { xpPerRep: 2, coinEveryReps: 4 },
  half_burpees: { xpPerRep: 2, coinEveryReps: 4 },
  jumping_jacks: { xpPerRep: 0.5, coinEveryReps: 10 },
  jumping_squats: { xpPerRep: 1, coinEveryReps: 10 },
  lunges: { xpPerRep: 1, coinEveryReps: 10 },
  dips: { xpPerRep: 3, coinEveryReps: 3 },
};
const LEGACY_MAX_XP = 200;
const LEGACY_MAX_COINS = 50;
const LEGACY_WORKOUT_PARTICIPATION = { xp: 150, coins: 100 };
const LEGACY_WORKOUT_WINNER_TOTAL = { xp: 250, coins: 150 };

export function getFriendChallengeEarnedRewards(
  xpEarned: number | null,
  coinsEarned: number | null,
  options?: {
    exerciseType?: ExerciseType;
    targetReps?: number;
  },
): { xp: number; coins: number } {
  if (coinsEarned !== null && coinsEarned > 0) {
    return {
      xp: xpEarned ?? 0,
      coins: coinsEarned,
    };
  }

  if (
    options?.exerciseType !== undefined &&
    options.targetReps !== undefined &&
    isFriendChallengeExerciseType(options.exerciseType)
  ) {
    const rule = LEGACY_EXERCISE_RULES[options.exerciseType];
    const reps = Math.max(options.targetReps, 0);
    const winnerXp = Math.min(Math.floor(reps * rule.xpPerRep), LEGACY_MAX_XP);

    return {
      xp: xpEarned ?? 0,
      coins:
        xpEarned !== null && xpEarned >= winnerXp
          ? Math.min(Math.floor(reps / rule.coinEveryReps), LEGACY_MAX_COINS)
          : 0,
    };
  }

  return {
    xp: xpEarned ?? 0,
    coins: inferLegacyWorkoutCoinsFromXp(xpEarned),
  };
}

function inferLegacyWorkoutCoinsFromXp(xpEarned: number | null): number {
  if (xpEarned === null || xpEarned <= 0) {
    return 0;
  }

  if (xpEarned >= LEGACY_WORKOUT_WINNER_TOTAL.xp) {
    return LEGACY_WORKOUT_WINNER_TOTAL.coins;
  }

  if (xpEarned >= LEGACY_WORKOUT_PARTICIPATION.xp) {
    return LEGACY_WORKOUT_PARTICIPATION.coins;
  }

  return 0;
}
