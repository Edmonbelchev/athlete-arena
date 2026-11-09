export const DAILY_MISSION_XP_REWARD = 50;
export const DAILY_MISSION_COIN_REWARD = 20;

/**
 * Light cardio quests (every knee lift / punch is a rep, so reps come fast) pay less.
 * Keep in sync with daily_mission_reward() in supabase/migrations/140_star_jumps_knee_strikes_rewards.sql.
 */
const LIGHT_QUEST_EXERCISES: readonly string[] = ['high_knees', 'shadow_boxing', 'knee_strikes'];
const LIGHT_QUEST_REWARD = { xp: 30, coins: 12 } as const;

function baseDailyMissionReward(exerciseType: string | null | undefined): { xp: number; coins: number } {
  return exerciseType && LIGHT_QUEST_EXERCISES.includes(exerciseType)
    ? LIGHT_QUEST_REWARD
    : { xp: DAILY_MISSION_XP_REWARD, coins: DAILY_MISSION_COIN_REWARD };
}

/**
 * Share of the reward a swapped quest still pays: full if never swapped, half after the first
 * swap, a quarter after the second and later swaps. Counted per quest.
 * Keep in sync with daily_mission_reward(exercise, reroll_count) in migration 139.
 */
export function getRerollRewardMultiplier(rerollCount: number | null | undefined): number {
  const count = rerollCount ?? 0;
  if (count <= 0) {
    return 1;
  }
  return count === 1 ? 0.5 : 0.25;
}

/** XP and coins a completed daily quest of this exercise pays, after any swap reduction. */
export function getDailyMissionReward(
  exerciseType: string | null | undefined,
  rerollCount: number | null | undefined = 0,
): { xp: number; coins: number } {
  const base = baseDailyMissionReward(exerciseType);
  const multiplier = getRerollRewardMultiplier(rerollCount);
  return { xp: Math.floor(base.xp * multiplier), coins: Math.floor(base.coins * multiplier) };
}

/**
 * Reward of a finished quest from the XP it stored (history rows don't carry the swap count):
 * finds the swap reduction that matches the stored XP and returns the coins that go with it.
 */
export function getDailyMissionRewardForXp(
  exerciseType: string | null | undefined,
  xp: number,
): { xp: number; coins: number } {
  for (const rerollCount of [0, 1, 2]) {
    const reward = getDailyMissionReward(exerciseType, rerollCount);
    if (xp >= reward.xp) {
      return { xp, coins: reward.coins };
    }
  }
  return { xp, coins: getDailyMissionReward(exerciseType, 2).coins };
}

/** How much a swap cuts this quest's reward, for the swap dialog. */
export function describeSwapRewardCut(currentRerollCount: number): string {
  return currentRerollCount <= 0
    ? 'The swapped quest pays half the reward.'
    : 'Swapping again cuts the reward to a quarter.';
}

/** Coins for each daily quest swap after the free one of the day. */
export const DAILY_QUEST_REROLL_COST = 50;

export const DAILY_MISSION_REWARD_SUMMARY =
  'Each completed mission earns up to 50 XP and 20 coins. Swapped quests pay half, then a quarter after another swap.';
