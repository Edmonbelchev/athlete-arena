export const FRIEND_CHALLENGE_PARTICIPATION_XP = 150;
export const FRIEND_CHALLENGE_PARTICIPATION_COINS = 100;
export const FRIEND_CHALLENGE_WINNER_BONUS_XP = 100;
export const FRIEND_CHALLENGE_WINNER_BONUS_COINS = 50;

export const FRIEND_CHALLENGE_WINNER_TOTAL_XP =
  FRIEND_CHALLENGE_PARTICIPATION_XP + FRIEND_CHALLENGE_WINNER_BONUS_XP;

export const FRIEND_CHALLENGE_WINNER_TOTAL_COINS =
  FRIEND_CHALLENGE_PARTICIPATION_COINS + FRIEND_CHALLENGE_WINNER_BONUS_COINS;

export function formatFriendChallengeRewardPreview(): string {
  return `Finish: +${FRIEND_CHALLENGE_PARTICIPATION_XP} XP & +${FRIEND_CHALLENGE_PARTICIPATION_COINS} coins · Winner bonus: +${FRIEND_CHALLENGE_WINNER_BONUS_XP} XP & +${FRIEND_CHALLENGE_WINNER_BONUS_COINS} coins`;
}

export function getFriendChallengeEarnedRewards(
  xpEarned: number | null,
  coinsEarned: number | null,
): { xp: number; coins: number } {
  return {
    xp: xpEarned ?? 0,
    coins: coinsEarned ?? inferFriendChallengeCoinsFromXp(xpEarned),
  };
}

export function inferFriendChallengeCoinsFromXp(xpEarned: number | null): number {
  if (xpEarned === null || xpEarned <= 0) {
    return 0;
  }

  if (xpEarned >= FRIEND_CHALLENGE_WINNER_TOTAL_XP) {
    return FRIEND_CHALLENGE_WINNER_TOTAL_COINS;
  }

  if (xpEarned >= FRIEND_CHALLENGE_PARTICIPATION_XP) {
    return FRIEND_CHALLENGE_PARTICIPATION_COINS;
  }

  return 0;
}
