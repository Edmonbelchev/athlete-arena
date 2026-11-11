import { calculateLevel, xpForLevel } from '@/features/xp/levelUtils';
import { getAppStorageItem, setAppStorageItem } from '@/lib/appStorage';

import {
  enqueueCelebration,
  getLevelUpTargetLevel,
  getNextCelebrationIndex,
  type Celebration,
  type WeeklyStreakCelebration,
} from './celebrationQueue';

/**
 * Global queue for full-screen celebrations (level-up, weekly streak). Anything may enqueue;
 * CelebrationHost (root layout) shows them one at a time, and only outside workout / challenge
 * screens. What was shown is persisted per user so a reload never shows it again.
 */

export interface CelebrationState {
  pending: Celebration[];
  active: Celebration | null;
}

let state: CelebrationState = { pending: [], active: null };
const listeners = new Set<() => void>();

function setState(next: CelebrationState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribeCelebrations(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCelebrationState(): CelebrationState {
  return state;
}

// --- Persistence ("last celebrated") -------------------------------------------------------

const levelKey = (userId: string) => `celebrations.level.${userId}`;
const weeklyStreakKey = (userId: string) => `celebrations.weekly-streak.${userId}`;

const celebratedLevelCache = new Map<string, number | null>();
const celebratedStreakCache = new Map<string, string | null>();

async function loadCelebratedLevel(userId: string): Promise<number | null> {
  if (celebratedLevelCache.has(userId)) {
    return celebratedLevelCache.get(userId) ?? null;
  }

  let level: number | null = null;
  try {
    const raw = await getAppStorageItem(levelKey(userId));
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    level = Number.isFinite(parsed) ? parsed : null;
  } catch {
    level = null;
  }

  // Another call may have written while this one was reading.
  if (!celebratedLevelCache.has(userId)) {
    celebratedLevelCache.set(userId, level);
  }
  return celebratedLevelCache.get(userId) ?? null;
}

function saveCelebratedLevel(userId: string, level: number): void {
  const current = celebratedLevelCache.get(userId);
  if (typeof current === 'number' && current >= level) {
    return;
  }

  celebratedLevelCache.set(userId, level);
  void setAppStorageItem(levelKey(userId), String(level)).catch(() => {});
}

async function loadCelebratedStreakKey(userId: string): Promise<string | null> {
  if (celebratedStreakCache.has(userId)) {
    return celebratedStreakCache.get(userId) ?? null;
  }

  let key: string | null = null;
  try {
    key = await getAppStorageItem(weeklyStreakKey(userId));
  } catch {
    key = null;
  }

  if (!celebratedStreakCache.has(userId)) {
    celebratedStreakCache.set(userId, key);
  }
  return celebratedStreakCache.get(userId) ?? null;
}

function saveCelebratedStreakKey(userId: string, key: string): void {
  celebratedStreakCache.set(userId, key);
  void setAppStorageItem(weeklyStreakKey(userId), key).catch(() => {});
}

// --- Enqueue ---------------------------------------------------------------------------------

/** Queues a level-up popup unless that level was already celebrated on this device. */
export async function celebrateLevelUp(userId: string, fromXp: number, toXp: number): Promise<void> {
  const level = calculateLevel(toXp);
  const celebrated = await loadCelebratedLevel(userId);
  if (celebrated !== null && level <= celebrated) {
    return;
  }

  setState({
    ...state,
    pending: enqueueCelebration(state.pending, { kind: 'level_up', userId, fromXp, toXp }),
  });
}

/**
 * Call when a profile first loads. The first time ever, it just records the current level (no
 * popup for existing users). Later, a level above the last celebrated one (app closed before the
 * popup showed, or levelled up on another device) is celebrated from the start of the old level.
 */
export async function reconcileCelebratedLevel(userId: string, totalXp: number): Promise<void> {
  const level = calculateLevel(totalXp);
  const celebrated = await loadCelebratedLevel(userId);

  if (celebrated === null) {
    saveCelebratedLevel(userId, level);
    return;
  }

  if (level > celebrated) {
    await celebrateLevelUp(userId, xpForLevel(celebrated), totalXp);
  }
}

/** Queues the weekly mission streak popup once per streak (keyed by completion date). */
export async function celebrateWeeklyStreak(
  celebration: Omit<WeeklyStreakCelebration, 'kind'>,
): Promise<void> {
  const celebrated = await loadCelebratedStreakKey(celebration.userId);
  if (celebrated === celebration.streakKey) {
    return;
  }

  const active = state.active;
  if (
    active?.kind === 'weekly_streak' &&
    active.userId === celebration.userId &&
    active.streakKey === celebration.streakKey
  ) {
    return;
  }

  setState({
    ...state,
    pending: enqueueCelebration(state.pending, { kind: 'weekly_streak', ...celebration }),
  });
}

// --- Host API --------------------------------------------------------------------------------

/** Moves the next pending celebration (level-ups first) to active and marks it celebrated. */
export function showNextCelebration(): Celebration | null {
  if (state.active) {
    return state.active;
  }

  const index = getNextCelebrationIndex(state.pending);
  if (index < 0) {
    return null;
  }

  const next = state.pending[index];
  if (next.kind === 'level_up') {
    saveCelebratedLevel(next.userId, getLevelUpTargetLevel(next));
  } else {
    saveCelebratedStreakKey(next.userId, next.streakKey);
  }

  setState({
    pending: state.pending.filter((_, itemIndex) => itemIndex !== index),
    active: next,
  });
  return next;
}

export function dismissActiveCelebration(): void {
  if (!state.active) {
    return;
  }

  setState({ ...state, active: null });
}

/** Drops queued celebrations for other accounts (sign out / switch user). */
export function clearCelebrationsExcept(userId: string | null): void {
  const pending = state.pending.filter((item) => item.userId === userId);
  const active = state.active && state.active.userId === userId ? state.active : null;
  if (pending.length !== state.pending.length || active !== state.active) {
    setState({ pending, active });
  }
}
