export const DAILY_MISSION_XP_REWARD = 50;
export const DAILY_MISSION_COIN_REWARD = 20;

/**
 * Light cardio quests (every knee lift / punch is a rep, so reps come fast) pay less.
 * Keep in sync with daily_mission_reward() in supabase/migrations/140_star_jumps_knee_strikes_rewards.sql.
 */
const LIGHT_QUEST_EXERCISES: readonly string[] = ['high_knees', 'shadow_boxing', 'knee_strikes'];
const LIGHT_QUEST_REWARD = { xp: 30, coins: 12 } as const;

/** XP and coins a completed daily quest of this exercise pays. */
export function getDailyMissionReward(exerciseType: string | null | undefined): { xp: number; coins: number } {
  return exerciseType && LIGHT_QUEST_EXERCISES.includes(exerciseType)
    ? LIGHT_QUEST_REWARD
    : { xp: DAILY_MISSION_XP_REWARD, coins: DAILY_MISSION_COIN_REWARD };
}

/** Coins for each daily quest swap after the free one of the day. */
export const DAILY_QUEST_REROLL_COST = 50;

export const DAILY_MISSION_REWARD_SUMMARY =
  'Each completed mission earns up to 50 XP and 20 coins.';
