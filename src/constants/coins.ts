import { DAILY_MISSION_COIN_REWARD } from '@/constants/dailyMissionRewards';
import {
  FRIEND_CHALLENGE_MAX_COINS,
  FRIEND_CHALLENGE_PARTICIPATION_COINS,
  FRIEND_CHALLENGE_WINNER_TOTAL_COINS,
} from '@/constants/friendChallengeRewards';

/** Coin rewards - keep in sync with supabase friend challenge migrations */

export { DAILY_MISSION_COIN_REWARD };
export { FRIEND_CHALLENGE_MAX_COINS };
export const FRIEND_CHALLENGE_WORKOUT_WINNER_TOTAL_COINS = FRIEND_CHALLENGE_WINNER_TOTAL_COINS;
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
    label: 'Win a friend challenge',
    amount: FRIEND_CHALLENGE_WORKOUT_WINNER_TOTAL_COINS,
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

export function getFriendChallengeCoinReward(coinsEarned: number | null): number {
  return coinsEarned ?? 0;
}

export function getFriendChallengeParticipationCoins(): number {
  return FRIEND_CHALLENGE_PARTICIPATION_COINS;
}
