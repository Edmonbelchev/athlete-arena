import Purchases from 'react-native-purchases';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/features/auth';
import {
  customerHasPremiumEntitlement,
  getRevenueCatCustomerInfo,
  isRevenueCatConfigured,
  presentPremiumPaywall,
  restorePremiumPurchases,
} from '@/services/revenueCatService';
import { getMyPremiumStatus, type PremiumStatus } from '@/services/subscriptionService';

interface PremiumContextValue extends PremiumStatus {
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  showPremiumPaywall: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
}

const DEFAULT_STATUS: PremiumStatus = {
  isPremium: false,
  provider: null,
  expiresAt: null,
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [supabaseStatus, setSupabaseStatus] = useState<PremiumStatus>(DEFAULT_STATUS);
  const [revenueCatPremium, setRevenueCatPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshRevenueCat = useCallback(async () => {
    if (!isRevenueCatConfigured()) {
      setRevenueCatPremium(false);
      return;
    }

    try {
      const customerInfo = await getRevenueCatCustomerInfo();
      setRevenueCatPremium(customerInfo ? customerHasPremiumEntitlement(customerInfo) : false);
    } catch {
      setRevenueCatPremium(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!session) {
      setSupabaseStatus(DEFAULT_STATUS);
      setRevenueCatPremium(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextSupabaseStatus = await getMyPremiumStatus();
      setSupabaseStatus(nextSupabaseStatus);
      await refreshRevenueCat();
    } catch (err) {
      setSupabaseStatus(DEFAULT_STATUS);
      setRevenueCatPremium(false);
      setError(err instanceof Error ? err.message : 'Failed to load subscription status');
    } finally {
      setIsLoading(false);
    }
  }, [refreshRevenueCat, session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isRevenueCatConfigured()) {
      return;
    }

    const listener = (customerInfo: Parameters<typeof customerHasPremiumEntitlement>[0]) => {
      setRevenueCatPremium(customerHasPremiumEntitlement(customerInfo));
    };

    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  const showPremiumPaywall = useCallback(async () => {
    const unlocked = await presentPremiumPaywall();
    if (unlocked) {
      await refresh();
    }
    return unlocked;
  }, [refresh]);

  const restorePurchases = useCallback(async () => {
    const restored = await restorePremiumPurchases();
    await refresh();
    return restored || supabaseStatus.isPremium || revenueCatPremium;
  }, [refresh, revenueCatPremium, supabaseStatus.isPremium]);

  const value = useMemo(
    () => ({
      isPremium: supabaseStatus.isPremium || revenueCatPremium,
      provider: supabaseStatus.isPremium ? supabaseStatus.provider : revenueCatPremium ? 'revenuecat' : null,
      expiresAt: supabaseStatus.expiresAt,
      isLoading,
      error,
      refresh,
      showPremiumPaywall,
      restorePurchases,
    }),
    [
      supabaseStatus,
      revenueCatPremium,
      isLoading,
      error,
      refresh,
      showPremiumPaywall,
      restorePurchases,
    ],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const context = useContext(PremiumContext);

  if (!context) {
    throw new Error('usePremium must be used within PremiumProvider');
  }

  return context;
}
