import { describe, expect, it } from '@jest/globals';

import {
  getDailyMissionReward,
  getDailyMissionRewardForXp,
  getRerollRewardMultiplier,
} from '@/constants/dailyMissionRewards';

describe('swapped quest rewards', () => {
  it('pays full, then half, then a quarter', () => {
    expect(getRerollRewardMultiplier(0)).toBe(1);
    expect(getRerollRewardMultiplier(1)).toBe(0.5);
    expect(getRerollRewardMultiplier(2)).toBe(0.25);
    expect(getRerollRewardMultiplier(5)).toBe(0.25);
  });

  it('rounds down like the database', () => {
    expect(getDailyMissionReward('push_ups', 0)).toEqual({ xp: 50, coins: 20 });
    expect(getDailyMissionReward('push_ups', 1)).toEqual({ xp: 25, coins: 10 });
    expect(getDailyMissionReward('push_ups', 2)).toEqual({ xp: 12, coins: 5 });
    expect(getDailyMissionReward('high_knees', 1)).toEqual({ xp: 15, coins: 6 });
    expect(getDailyMissionReward('high_knees', 3)).toEqual({ xp: 7, coins: 3 });
  });

  it('recovers coins from the stored XP for history', () => {
    expect(getDailyMissionRewardForXp('squats', 50)).toEqual({ xp: 50, coins: 20 });
    expect(getDailyMissionRewardForXp('squats', 25)).toEqual({ xp: 25, coins: 10 });
    expect(getDailyMissionRewardForXp('squats', 12)).toEqual({ xp: 12, coins: 5 });
    expect(getDailyMissionRewardForXp('shadow_boxing', 7)).toEqual({ xp: 7, coins: 3 });
  });
});
