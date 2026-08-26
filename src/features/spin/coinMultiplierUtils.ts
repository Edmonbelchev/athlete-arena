import { COIN_MULTIPLIER_VALUE } from '@/constants/spinWheel';

export function isCoinMultiplierActive(
  coinMultiplier: number,
  expiresAt: string | null,
): boolean {
  if (expiresAt) {
    return new Date(expiresAt).getTime() > Date.now();
  }

  return coinMultiplier > 1;
}

export function applyCoinMultiplier(
  baseCoins: number,
  isActive: boolean,
  multiplier = COIN_MULTIPLIER_VALUE,
): number {
  if (!isActive || baseCoins <= 0) {
    return baseCoins;
  }

  return baseCoins * multiplier;
}
