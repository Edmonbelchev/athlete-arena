import { useMemo } from 'react';

import { COIN_MULTIPLIER_VALUE } from '@/constants/spinWheel';
import { useShop } from '@/features/shop/ShopProvider';
import { applyCoinMultiplier, isCoinMultiplierActive } from '@/features/spin/coinMultiplierUtils';

export function useCoinMultiplier() {
  const { summary } = useShop();

  const isActive = useMemo(
    () => isCoinMultiplierActive(summary.coinMultiplier, summary.coinMultiplierExpiresAt),
    [summary.coinMultiplier, summary.coinMultiplierExpiresAt],
  );

  return {
    isActive,
    multiplier: isActive ? COIN_MULTIPLIER_VALUE : 1,
    expiresAt: summary.coinMultiplierExpiresAt,
    applyToCoins: (baseCoins: number) => applyCoinMultiplier(baseCoins, isActive),
  };
}
