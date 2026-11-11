import { calculateLevel, xpForLevel, xpRequiredForLevel } from '@/features/xp/levelUtils';

export interface LevelUpCelebration {
  kind: 'level_up';
  userId: string;
  /** Total XP before the gain (bar starts here). */
  fromXp: number;
  /** Total XP after the gain (bar ends here). */
  toXp: number;
}

export interface WeeklyStreakCelebration {
  kind: 'weekly_streak';
  userId: string;
  /** Dedupe key - the local date the streak completed. */
  streakKey: string;
  targetDays: number;
  rewardXp: number;
  rewardCoins: number;
}

export type Celebration = LevelUpCelebration | WeeklyStreakCelebration;

/** Lower shows first: a level-up always comes before the weekly streak popup. */
const KIND_PRIORITY: Record<Celebration['kind'], number> = {
  level_up: 0,
  weekly_streak: 1,
};

export function getLevelUpTargetLevel(celebration: LevelUpCelebration): number {
  return calculateLevel(celebration.toXp);
}

/** Level-up when XP grew across a level threshold; null otherwise. */
export function detectLevelUp(previousXp: number, nextXp: number): { fromXp: number; toXp: number } | null {
  if (!(nextXp > previousXp)) {
    return null;
  }

  return calculateLevel(nextXp) > calculateLevel(previousXp) ? { fromXp: previousXp, toXp: nextXp } : null;
}

/**
 * Adds a celebration to a pending queue.
 * - Level-ups for the same user merge into one popup spanning every level gained.
 * - Weekly streaks dedupe by streak key.
 */
export function enqueueCelebration(queue: readonly Celebration[], next: Celebration): Celebration[] {
  if (next.kind === 'level_up') {
    const index = queue.findIndex((item) => item.kind === 'level_up' && item.userId === next.userId);
    if (index >= 0) {
      const existing = queue[index] as LevelUpCelebration;
      const merged: LevelUpCelebration = {
        ...existing,
        fromXp: Math.min(existing.fromXp, next.fromXp),
        toXp: Math.max(existing.toXp, next.toXp),
      };
      return queue.map((item, itemIndex) => (itemIndex === index ? merged : item));
    }

    return [...queue, next];
  }

  const duplicate = queue.some(
    (item) => item.kind === 'weekly_streak' && item.userId === next.userId && item.streakKey === next.streakKey,
  );
  return duplicate ? [...queue] : [...queue, next];
}

/** Index of the celebration to show next (level-ups first, then oldest), or -1 when empty. */
export function getNextCelebrationIndex(queue: readonly Celebration[]): number {
  let best = -1;
  queue.forEach((item, index) => {
    if (best < 0 || KIND_PRIORITY[item.kind] < KIND_PRIORITY[queue[best].kind]) {
      best = index;
    }
  });
  return best;
}

export interface LevelUpBarSegment {
  /** Level shown while this segment fills. */
  level: number;
  /** Bar progress 0..1 at the start and end of the segment. */
  fromProgress: number;
  toProgress: number;
}

/** Most full-bar fills animated for skipped levels in between (big catch-ups jump the rest). */
const MAX_INTERMEDIATE_FILLS = 3;

function progressInLevel(totalXp: number, level: number): number {
  const required = xpRequiredForLevel(level);
  if (required <= 0) {
    return 1;
  }

  return Math.min(1, Math.max(0, (totalXp - xpForLevel(level)) / required));
}

/**
 * Bar animation for a level-up: fill the old level to full, fill any levels in between, then
 * fill the new level up to the current progress. Big jumps keep the last few in-between fills.
 */
export function buildLevelUpSegments(fromXp: number, toXp: number): LevelUpBarSegment[] {
  const startXp = Math.max(0, Math.min(fromXp, toXp));
  const endXp = Math.max(0, toXp);
  const fromLevel = calculateLevel(startXp);
  const toLevel = calculateLevel(endXp);

  if (toLevel <= fromLevel) {
    return [
      {
        level: toLevel,
        fromProgress: progressInLevel(startXp, toLevel),
        toProgress: progressInLevel(endXp, toLevel),
      },
    ];
  }

  const segments: LevelUpBarSegment[] = [
    { level: fromLevel, fromProgress: progressInLevel(startXp, fromLevel), toProgress: 1 },
  ];

  const firstIntermediate = Math.max(fromLevel + 1, toLevel - MAX_INTERMEDIATE_FILLS);
  for (let level = firstIntermediate; level < toLevel; level += 1) {
    segments.push({ level, fromProgress: 0, toProgress: 1 });
  }

  segments.push({ level: toLevel, fromProgress: 0, toProgress: progressInLevel(endXp, toLevel) });
  return segments;
}

/** Local calendar date (YYYY-MM-DD) used to dedupe weekly streak celebrations. */
export function getLocalDateKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Top-level routes where celebrations wait: live workouts / challenges (and their complete
 * screens, which share the route), onboarding and auth. They show once the user is back on a
 * normal screen.
 */
const PAUSED_ROOT_SEGMENTS: ReadonlySet<string> = new Set([
  'workout',
  'challenge',
  'onboarding',
  '(auth)',
  'spin',
  'premium-paywall',
  'reset-password',
]);

export function isCelebrationPausedRoute(segments: readonly string[]): boolean {
  return segments.length > 0 && PAUSED_ROOT_SEGMENTS.has(segments[0]);
}
