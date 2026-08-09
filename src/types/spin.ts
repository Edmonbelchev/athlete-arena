export type SpinRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface SpinSegment {
  rewardId: string;
  rarity: SpinRarity;
  coins: number;
  grantsMultiplier: boolean;
  /** Weights sum to 100, so this doubles as a percentage chance. */
  weight: number;
}

export interface SpinHistoryEntry {
  rewardId: string;
  rarity: SpinRarity;
  coinsAwarded: number;
  multiplierGranted: boolean;
  spinDate: string;
  createdAt: string;
}

export interface DailySpinStatus {
  canSpin: boolean;
  nextSpinAt: string | null;
  coinBalance: number;
  coinMultiplier: number;
  coinMultiplierExpiresAt: string | null;
  lastSpin: SpinHistoryEntry | null;
  segments: SpinSegment[];
}

export interface SpinResult {
  rewardId: string;
  rarity: SpinRarity;
  coinsAwarded: number;
  multiplierGranted: boolean;
  coinBalance: number;
  coinMultiplier: number;
  coinMultiplierExpiresAt: string | null;
  nextSpinAt: string | null;
}
