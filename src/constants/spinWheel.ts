/** Spin wheel display config - segments themselves come from the server.
 *  Keep the fallback in sync with supabase/migrations/031_daily_spin_wheel.sql */

import type { SpinRarity, SpinSegment } from '@/types/spin';

export const SPIN_RARITY_LABELS: Record<SpinRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

export const SPIN_RARITY_COLORS: Record<SpinRarity, string> = {
  common: '#64748B',
  rare: '#0EA5E9',
  epic: '#A855F7',
  legendary: '#F59E0B',
};

export const COIN_MULTIPLIER_VALUE = 2;

/** Used only until the server status loads, so the wheel never renders empty. */
export const FALLBACK_SPIN_SEGMENTS: SpinSegment[] = [
  { rewardId: 'coins_5', rarity: 'common', coins: 5, grantsMultiplier: false, weight: 30 },
  { rewardId: 'coins_10', rarity: 'common', coins: 10, grantsMultiplier: false, weight: 27 },
  { rewardId: 'coins_20', rarity: 'rare', coins: 20, grantsMultiplier: false, weight: 22 },
  { rewardId: 'coins_50', rarity: 'epic', coins: 50, grantsMultiplier: false, weight: 12 },
  { rewardId: 'multiplier_2x', rarity: 'epic', coins: 0, grantsMultiplier: true, weight: 6 },
  { rewardId: 'coins_100', rarity: 'legendary', coins: 100, grantsMultiplier: false, weight: 3 },
];

export function getSegmentShortLabel(segment: SpinSegment): string {
  return segment.grantsMultiplier ? `${COIN_MULTIPLIER_VALUE}x` : String(segment.coins);
}

export function getSegmentTitle(segment: SpinSegment): string {
  return segment.grantsMultiplier
    ? `${COIN_MULTIPLIER_VALUE}x Coins`
    : `${segment.coins} coins`;
}

export function getSegmentDescription(segment: SpinSegment): string {
  return segment.grantsMultiplier
    ? 'Every coin reward is doubled for the rest of the day.'
    : `${segment.coins} coins added to your balance.`;
}

/** "5h 12m" until the given timestamp, or null once it has passed. */
export function formatTimeRemaining(target: string | null): string | null {
  if (!target) {
    return null;
  }

  const targetTime = new Date(target).getTime();
  if (Number.isNaN(targetTime)) {
    return null;
  }

  const msRemaining = targetTime - Date.now();
  if (msRemaining <= 0) {
    return null;
  }

  const totalMinutes = Math.floor(msRemaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}
