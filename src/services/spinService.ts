import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type {
  DailySpinStatus,
  SpinHistoryEntry,
  SpinRarity,
  SpinResult,
  SpinSegment,
} from '@/types/spin';

function isSpinRarity(value: unknown): value is SpinRarity {
  return value === 'common' || value === 'rare' || value === 'epic' || value === 'legendary';
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function mapSegments(value: unknown): SpinSegment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') {
      return [];
    }

    const record = raw as Record<string, unknown>;
    if (typeof record.reward_id !== 'string' || !isSpinRarity(record.rarity)) {
      return [];
    }

    return [
      {
        rewardId: record.reward_id,
        rarity: record.rarity,
        coins: toNumber(record.coins),
        grantsMultiplier: record.grants_multiplier === true,
        weight: toNumber(record.weight),
      },
    ];
  });
}

function mapLastSpin(value: unknown): SpinHistoryEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.reward_id !== 'string' || !isSpinRarity(record.rarity)) {
    return null;
  }

  return {
    rewardId: record.reward_id,
    rarity: record.rarity,
    coinsAwarded: toNumber(record.coins_awarded),
    multiplierGranted: record.multiplier_granted === true,
    spinDate: toNullableString(record.spin_date) ?? '',
    createdAt: toNullableString(record.created_at) ?? '',
  };
}

export async function getDailySpinStatus(): Promise<DailySpinStatus> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_daily_spin_status');

  if (error) {
    throw error;
  }

  const record = (data ?? {}) as Record<string, unknown>;

  return {
    canSpin: record.can_spin === true,
    nextSpinAt: toNullableString(record.next_spin_at),
    coinBalance: toNumber(record.coin_balance),
    coinMultiplier: toNumber(record.coin_multiplier, 1),
    coinMultiplierExpiresAt: toNullableString(record.coin_multiplier_expires_at),
    lastSpin: mapLastSpin(record.last_spin),
    segments: mapSegments(record.segments),
  };
}

export async function spinDailyWheel(): Promise<SpinResult> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('spin_daily_wheel');

  if (error) {
    throw error;
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (typeof record.reward_id !== 'string' || !isSpinRarity(record.rarity)) {
    throw new Error('Unexpected spin response');
  }

  return {
    rewardId: record.reward_id,
    rarity: record.rarity,
    coinsAwarded: toNumber(record.coins_awarded),
    multiplierGranted: record.multiplier_granted === true,
    coinBalance: toNumber(record.coin_balance),
    coinMultiplier: toNumber(record.coin_multiplier, 1),
    coinMultiplierExpiresAt: toNullableString(record.coin_multiplier_expires_at),
    nextSpinAt: toNullableString(record.next_spin_at),
  };
}
