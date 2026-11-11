import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  buildLevelUpSegments,
  detectLevelUp,
  enqueueCelebration,
  getNextCelebrationIndex,
  isCelebrationPausedRoute,
  type Celebration,
} from '@/features/celebrations/celebrationQueue';
import { xpForLevel } from '@/features/xp/levelUtils';
import { didCompleteWeeklyMissionStreak, type WeeklyMissionStreakStatus } from '@/types/weeklyStreak';

const mockStorage = new Map<string, string>();
jest.mock('@/lib/appStorage', () => ({
  getAppStorageItem: async (key: string) => mockStorage.get(key) ?? null,
  setAppStorageItem: async (key: string, value: string) => {
    mockStorage.set(key, value);
  },
}));

const levelUp = (fromXp: number, toXp: number, userId = 'u1'): Celebration => ({
  kind: 'level_up',
  userId,
  fromXp,
  toXp,
});
const streak = (streakKey: string, userId = 'u1'): Celebration => ({
  kind: 'weekly_streak',
  userId,
  streakKey,
  targetDays: 7,
  rewardXp: 300,
  rewardCoins: 200,
});

describe('level-up detection', () => {
  it('fires only when a level threshold is crossed', () => {
    expect(detectLevelUp(100, 400)).toBeNull();
    expect(detectLevelUp(400, 520)).toEqual({ fromXp: 400, toXp: 520 });
    expect(detectLevelUp(520, 400)).toBeNull();
    expect(detectLevelUp(520, 520)).toBeNull();
  });
});

describe('level-up bar segments', () => {
  it('fills the old level, then the new level up to the current progress', () => {
    // Level 1 → 2 at 500 XP; level 2 needs 550.
    const segments = buildLevelUpSegments(250, 775);
    expect(segments).toEqual([
      { level: 1, fromProgress: 0.5, toProgress: 1 },
      { level: 2, fromProgress: 0, toProgress: 0.5 },
    ]);
  });

  it('fills each level gained in a multi-level jump', () => {
    const segments = buildLevelUpSegments(0, xpForLevel(4) + 10);
    expect(segments.map((segment) => segment.level)).toEqual([1, 2, 3, 4]);
    expect(segments.slice(0, 3).every((segment) => segment.toProgress === 1)).toBe(true);
    expect(segments[3].toProgress).toBeGreaterThan(0);
  });

  it('caps in-between fills for huge jumps but always ends on the new level', () => {
    const segments = buildLevelUpSegments(0, xpForLevel(20));
    expect(segments.length).toBeLessThanOrEqual(5);
    expect(segments[0].level).toBe(1);
    expect(segments[segments.length - 1]).toEqual({ level: 20, fromProgress: 0, toProgress: 0 });
  });
});

describe('celebration queue', () => {
  it('merges level-ups for the same user into one popup', () => {
    const queue = enqueueCelebration(enqueueCelebration([], levelUp(400, 520)), levelUp(520, 1100));
    expect(queue).toEqual([levelUp(400, 1100)]);
  });

  it('dedupes weekly streaks by key', () => {
    const queue = enqueueCelebration(enqueueCelebration([], streak('2026-11-11')), streak('2026-11-11'));
    expect(queue).toHaveLength(1);
  });

  it('shows the level-up before the weekly streak even when queued later', () => {
    const queue = enqueueCelebration(enqueueCelebration([], streak('2026-11-11')), levelUp(400, 520));
    expect(queue[getNextCelebrationIndex(queue)].kind).toBe('level_up');
    expect(getNextCelebrationIndex([])).toBe(-1);
  });

  it('waits on workout, challenge, onboarding and auth routes', () => {
    expect(isCelebrationPausedRoute(['workout', 'session'])).toBe(true);
    expect(isCelebrationPausedRoute(['challenge', '[id]'])).toBe(true);
    expect(isCelebrationPausedRoute(['challenge', 'friend', '[participantId]'])).toBe(true);
    expect(isCelebrationPausedRoute(['onboarding'])).toBe(true);
    expect(isCelebrationPausedRoute(['(tabs)'])).toBe(false);
    expect(isCelebrationPausedRoute(['(tabs)', 'workouts'])).toBe(false);
  });
});

describe('weekly streak completion', () => {
  const base: WeeklyMissionStreakStatus = {
    streakDays: 6,
    targetDays: 7,
    todayCompleted: false,
    rewardXp: 300,
    rewardCoins: 200,
  };

  it('detects the 7th day being completed', () => {
    expect(didCompleteWeeklyMissionStreak(base, { ...base, streakDays: 1, todayCompleted: true })).toBe(true);
    expect(didCompleteWeeklyMissionStreak({ ...base, streakDays: 5 }, { ...base, todayCompleted: true })).toBe(false);
    expect(didCompleteWeeklyMissionStreak(base, base)).toBe(false);
  });
});

describe('celebration store', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.resetModules();
  });

  function loadStore(): typeof import('@/features/celebrations/celebrationStore') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/features/celebrations/celebrationStore');
  }

  it('does not celebrate on the first profile load, only real gains', async () => {
    const store = loadStore();
    await store.reconcileCelebratedLevel('u1', 600); // level 2, nothing stored yet
    expect(store.getCelebrationState().pending).toHaveLength(0);

    await store.celebrateLevelUp('u1', 600, xpForLevel(3) + 5);
    expect(store.getCelebrationState().pending).toHaveLength(1);
  });

  it('shows level-up then streak one at a time and never re-shows them', async () => {
    const store = loadStore();
    await store.reconcileCelebratedLevel('u1', 400);
    await store.celebrateWeeklyStreak({ userId: 'u1', streakKey: 'k1', targetDays: 7, rewardXp: 300, rewardCoins: 200 });
    await store.celebrateLevelUp('u1', 400, 700);

    expect(store.showNextCelebration()?.kind).toBe('level_up');
    // Only one at a time.
    expect(store.showNextCelebration()?.kind).toBe('level_up');
    store.dismissActiveCelebration();
    expect(store.showNextCelebration()?.kind).toBe('weekly_streak');
    store.dismissActiveCelebration();
    expect(store.showNextCelebration()).toBeNull();

    // Same level / same streak again (e.g. a profile refresh) is ignored.
    await store.celebrateLevelUp('u1', 400, 700);
    await store.celebrateWeeklyStreak({ userId: 'u1', streakKey: 'k1', targetDays: 7, rewardXp: 300, rewardCoins: 200 });
    expect(store.getCelebrationState().pending).toHaveLength(0);

    // After an app restart (fresh module, persisted storage) nothing is shown again either.
    jest.resetModules();
    const reloaded = loadStore();
    await reloaded.reconcileCelebratedLevel('u1', 700);
    await reloaded.celebrateWeeklyStreak({ userId: 'u1', streakKey: 'k1', targetDays: 7, rewardXp: 300, rewardCoins: 200 });
    expect(reloaded.getCelebrationState().pending).toHaveLength(0);
  });

  it('catches up a level-up that was never shown (app closed before the popup)', async () => {
    const store = loadStore();
    await store.reconcileCelebratedLevel('u1', 400); // stores level 1

    jest.resetModules();
    const reloaded = loadStore();
    await reloaded.reconcileCelebratedLevel('u1', 700); // now level 2
    expect(reloaded.getCelebrationState().pending).toEqual([
      { kind: 'level_up', userId: 'u1', fromXp: 0, toXp: 700 },
    ]);
  });
});
