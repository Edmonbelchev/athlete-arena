import type { ExerciseType } from '@/constants/challenges';
import {
  calculateFriendChallengeCoins,
  FRIEND_CHALLENGE_MAX_COINS,
} from '@/constants/friendChallengeRewards';
import { DAILY_MISSION_COIN_REWARD } from '@/constants/dailyMissionRewards';

/** Coin rewards - keep in sync with supabase/migrations/037_reward_model_swap.sql */

export { DAILY_MISSION_COIN_REWARD };
export { FRIEND_CHALLENGE_MAX_COINS as FRIEND_CHALLENGE_MAX_COIN_REWARD };
/** Best coin segment on the daily spin wheel (031_daily_spin_wheel.sql). */
export const DAILY_SPIN_MAX_COIN_REWARD = 100;

export const COIN_EARN_SOURCES = [
  {
    id: 'daily_challenge',
    label: 'Complete a daily mission',
    amount: DAILY_MISSION_COIN_REWARD,
  },
  {
    id: 'friend_race_win',
    label: 'Win a friend speed race',
    amount: FRIEND_CHALLENGE_MAX_COINS,
  },
  {
    id: 'daily_spin',
    label: 'Spin the daily wheel',
    amount: DAILY_SPIN_MAX_COIN_REWARD,
  },
] as const;

export function formatCoinAmount(amount: number): string {
  return `+${amount} coin${amount === 1 ? '' : 's'}`;
}

export function formatXpAndCoins(xp: number, coins: number): string {
  return `+${xp} XP · ${formatCoinAmount(coins)}`;
}

export function formatRewardPreview(xp: number, coins: number): string {
  return `Reward: ${formatXpAndCoins(xp, coins)}`;
}

export function getFriendChallengeCoinReward(
  resolvedAt: string | null,
  winnerUserId: string | null,
  myUserId: string,
  exerciseType: ExerciseType,
  targetReps: number,
): number {
  if (!resolvedAt) {
    return 0;
  }

  const coins = calculateFriendChallengeCoins(exerciseType, targetReps);

  if (!winnerUserId) {
    return coins;
  }

  return winnerUserId === myUserId ? coins : 0;
}
