/** Coin rewards — keep in sync with supabase/migrations/019_coin_rewards.sql */

export const DAILY_CHALLENGE_COIN_REWARD = 50;
export const FRIEND_CHALLENGE_WIN_COIN_REWARD = 20;

export const COIN_EARN_SOURCES = [
  {
    id: 'daily_challenge',
    label: 'Complete a daily challenge',
    amount: DAILY_CHALLENGE_COIN_REWARD,
  },
  {
    id: 'friend_race_win',
    label: 'Win a friend speed race',
    amount: FRIEND_CHALLENGE_WIN_COIN_REWARD,
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
): number {
  if (!resolvedAt) {
    return 0;
  }

  if (!winnerUserId) {
    return FRIEND_CHALLENGE_WIN_COIN_REWARD;
  }

  return winnerUserId === myUserId ? FRIEND_CHALLENGE_WIN_COIN_REWARD : 0;
}
