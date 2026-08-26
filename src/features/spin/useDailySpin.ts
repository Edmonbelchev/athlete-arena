import { useCallback, useEffect, useState } from 'react';

import { FALLBACK_SPIN_SEGMENTS } from '@/constants/spinWheel';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile/useProfile';
import { useShop } from '@/features/shop/ShopProvider';
import { formatUserError } from '@/lib/errors';
import { getDailySpinStatus, spinDailyWheel } from '@/services/spinService';
import type { DailySpinStatus, SpinResult, SpinSegment } from '@/types/spin';

interface UseDailySpinResult {
  status: DailySpinStatus | null;
  segments: SpinSegment[];
  isLoading: boolean;
  isSpinning: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  spin: () => Promise<SpinResult | null>;
  commitSpinResult: (result: SpinResult) => void;
}

export function useDailySpin(): UseDailySpinResult {
  const { session } = useAuth();
  const { patchProfile } = useProfile();
  const { patchSummary } = useShop();
  const [status, setStatus] = useState<DailySpinStatus | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [isSpinning, setIsSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setStatus(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setStatus(await getDailySpinStatus());
    } catch (err) {
      setStatus(null);
      setError(formatUserError(err, 'Failed to load the spin wheel'));
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const commitSpinResult = useCallback(
    (result: SpinResult) => {
      patchProfile({ coin_balance: result.coinBalance });
      patchSummary({
        coinBalance: result.coinBalance,
        coinMultiplier: result.coinMultiplier,
        coinMultiplierExpiresAt: result.coinMultiplierExpiresAt,
      });

      setStatus((current) =>
        current
          ? {
              ...current,
              canSpin: false,
              coinBalance: result.coinBalance,
              coinMultiplier: result.coinMultiplier,
              coinMultiplierExpiresAt: result.coinMultiplierExpiresAt,
              nextSpinAt: result.nextSpinAt ?? current.nextSpinAt,
            }
          : current,
      );
    },
    [patchProfile, patchSummary],
  );

  const spin = useCallback(async () => {
    if (isSpinning) {
      return null;
    }

    setIsSpinning(true);
    setError(null);

    try {
      const result = await spinDailyWheel();

      setStatus((current) => (current ? { ...current, canSpin: false } : current));

      return result;
    } catch (err) {
      setError(formatUserError(err, 'Failed to spin the wheel'));
      return null;
    } finally {
      setIsSpinning(false);
    }
  }, [isSpinning]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    segments: status?.segments.length ? status.segments : FALLBACK_SPIN_SEGMENTS,
    isLoading,
    isSpinning,
    error,
    refresh,
    spin,
    commitSpinResult,
  };
}
