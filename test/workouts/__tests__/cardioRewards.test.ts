import { describe, expect, it } from '@jest/globals';

import { getDailyMissionReward } from '@/constants/dailyMissionRewards';
import { FRIEND_CHALLENGE_FULL_REWARD_REPS } from '@/constants/friendChallengeRewards';
import { sumRepXpFromBreakdown } from '@/features/workouts/workoutXp';

describe('lighter rewards for high knees and shadow boxing', () => {
  it('daily quests pay 30 XP / 12 coins instead of 50 / 20', () => {
    expect(getDailyMissionReward('high_knees')).toEqual({ xp: 30, coins: 12 });
    expect(getDailyMissionReward('shadow_boxing')).toEqual({ xp: 30, coins: 12 });
    for (const other of ['push_ups', 'squats', 'tuck_jumps', null]) {
      expect(getDailyMissionReward(other)).toEqual({ xp: 50, coins: 20 });
    }
  });

  it('friend challenges need twice the reps for the full reward', () => {
    expect(FRIEND_CHALLENGE_FULL_REWARD_REPS.high_knees).toBe(120);
    expect(FRIEND_CHALLENGE_FULL_REWARD_REPS.shadow_boxing).toBe(120);
    expect(FRIEND_CHALLENGE_FULL_REWARD_REPS.tuck_jumps).toBe(20);
  });

  it('workouts earn one XP per two reps (rounded down), other moves unchanged', () => {
    const entry = (exerciseType: 'high_knees' | 'shadow_boxing' | 'squats' | 'tuck_jumps', totalReps: number) => ({
      exerciseType,
      targetReps: totalReps,
      totalReps,
    });
    expect(sumRepXpFromBreakdown([entry('high_knees', 40)])).toBe(20);
    expect(sumRepXpFromBreakdown([entry('shadow_boxing', 41)])).toBe(20);
    expect(sumRepXpFromBreakdown([entry('squats', 40)])).toBe(40);
    expect(sumRepXpFromBreakdown([entry('tuck_jumps', 10)])).toBe(20);
  });
});
