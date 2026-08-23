import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth';
import { getMyPremiumStatus, type PremiumStatus } from '@/services/subscriptionService';

interface UsePremiumResult extends PremiumStatus {
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_STATUS: PremiumStatus = {
  isPremium: false,
  provider: null,
  expiresAt: null,
};

export function usePremium(): UsePremiumResult {
  const { session } = useAuth();
  const [status, setStatus] = useState<PremiumStatus>(DEFAULT_STATUS);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setStatus(DEFAULT_STATUS);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextStatus = await getMyPremiumStatus();
      setStatus(nextStatus);
    } catch (err) {
      setStatus(DEFAULT_STATUS);
      setError(err instanceof Error ? err.message : 'Failed to load subscription status');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    ...status,
    isLoading,
    error,
    refresh,
  };
}
