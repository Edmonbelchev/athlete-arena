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
  getPremiumSubscriptionDetails,
  getRevenueCatCustomerInfo,
  getSubscriptionManagementUrl,
  identifyRevenueCatUser,
  isRevenueCatConfigured,
  presentPremiumPaywall,
  restorePremiumPurchases,
} from '@/services/revenueCatService';
import { getMyPremiumStatus, syncMyRevenueCatSubscription, type PremiumStatus } from '@/services/subscriptionService';
import type { PremiumSubscriptionDetails } from '@/types/subscription';

interface PremiumContextValue extends PremiumStatus {
  subscription: PremiumSubscriptionDetails | null;
  managementUrl: string | null;
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
  const [revenueCatSubscription, setRevenueCatSubscription] = useState<PremiumSubscriptionDetails | null>(
    null,
  );
  const [managementUrl, setManagementUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyRevenueCatCustomerInfo = useCallback(
    (customerInfo: NonNullable<Awaited<ReturnType<typeof getRevenueCatCustomerInfo>>>) => {
      setRevenueCatPremium(customerHasPremiumEntitlement(customerInfo));
      setRevenueCatSubscription(getPremiumSubscriptionDetails(customerInfo));
      setManagementUrl(getSubscriptionManagementUrl(customerInfo));
    },
    [],
  );

  const refreshRevenueCat = useCallback(async () => {
    if (!isRevenueCatConfigured()) {
      setRevenueCatPremium(false);
      setRevenueCatSubscription(null);
      setManagementUrl(null);
      return;
    }

    try {
      const customerInfo = await getRevenueCatCustomerInfo();
      if (customerInfo) {
        applyRevenueCatCustomerInfo(customerInfo);
      } else {
        setRevenueCatPremium(false);
        setRevenueCatSubscription(null);
        setManagementUrl(null);
      }
    } catch {
      setRevenueCatPremium(false);
      setRevenueCatSubscription(null);
      setManagementUrl(null);
    }
  }, [applyRevenueCatCustomerInfo]);

  const syncSupabaseFromRevenueCat = useCallback(async (): Promise<boolean> => {
    if (!session?.user.id || !isRevenueCatConfigured()) {
      return false;
    }

    try {
      const customerInfo = await getRevenueCatCustomerInfo();
      if (!customerInfo || !customerHasPremiumEntitlement(customerInfo)) {
        return false;
      }

      const details = getPremiumSubscriptionDetails(customerInfo);
      await syncMyRevenueCatSubscription(details?.expiresAt ?? null);
      return true;
    } catch (err) {
      if (__DEV__) {
        console.warn('[premium] Failed to sync RevenueCat subscription to Supabase:', err);
      }
      return false;
    }
  }, [session?.user.id]);

  const refresh = useCallback(async () => {
    if (!session) {
      setSupabaseStatus(DEFAULT_STATUS);
      setRevenueCatPremium(false);
      setRevenueCatSubscription(null);
      setManagementUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let nextSupabaseStatus = await getMyPremiumStatus();
      await refreshRevenueCat();

      if (!nextSupabaseStatus.isPremium) {
        const synced = await syncSupabaseFromRevenueCat();
        if (synced) {
          nextSupabaseStatus = await getMyPremiumStatus();
        }
      }

      setSupabaseStatus(nextSupabaseStatus);
    } catch (err) {
      setSupabaseStatus(DEFAULT_STATUS);
      setRevenueCatPremium(false);
      setRevenueCatSubscription(null);
      setManagementUrl(null);
      setError(err instanceof Error ? err.message : 'Failed to load subscription status');
    } finally {
      setIsLoading(false);
    }
  }, [refreshRevenueCat, session, syncSupabaseFromRevenueCat]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isRevenueCatConfigured()) {
      return;
    }

    const listener = (customerInfo: Parameters<typeof customerHasPremiumEntitlement>[0]) => {
      applyRevenueCatCustomerInfo(customerInfo);
    };

    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyRevenueCatCustomerInfo]);

  const subscription = useMemo((): PremiumSubscriptionDetails | null => {
    if (revenueCatSubscription) {
      return revenueCatSubscription;
    }

    if (!supabaseStatus.isPremium) {
      return null;
    }

    return {
      planLabel: supabaseStatus.provider === 'manual' ? 'Premium access' : 'Premium',
      productId: null,
      expiresAt: supabaseStatus.expiresAt,
      willRenew: false,
      source: 'supabase',
    };
  }, [revenueCatSubscription, supabaseStatus]);

  const showPremiumPaywall = useCallback(async () => {
    if (!session?.user.id) {
      return false;
    }

    if (isRevenueCatConfigured()) {
      try {
        await identifyRevenueCatUser(session.user.id);
      } catch {
        // Paywall can still open; purchase may fail to attach without login.
      }
    }

    const unlocked = await presentPremiumPaywall();
    setRevenueCatPremium(unlocked);

    if (unlocked) {
      await syncSupabaseFromRevenueCat();
      await refresh();
    } else {
      await refreshRevenueCat();
    }

    return unlocked;
  }, [refresh, refreshRevenueCat, session?.user.id, syncSupabaseFromRevenueCat]);

  const restorePurchases = useCallback(async () => {
    if (!session?.user.id) {
      return false;
    }

    if (isRevenueCatConfigured()) {
      try {
        await identifyRevenueCatUser(session.user.id);
      } catch {
        // Restore may still work for the cached RevenueCat user.
      }
    }

    const restored = await restorePremiumPurchases();

    if (restored) {
      await syncSupabaseFromRevenueCat();
    }

    await refresh();
    return restored || supabaseStatus.isPremium || revenueCatPremium;
  }, [refresh, revenueCatPremium, session?.user.id, supabaseStatus.isPremium, syncSupabaseFromRevenueCat]);

  const value = useMemo(
    () => ({
      isPremium: supabaseStatus.isPremium || revenueCatPremium,
      provider: supabaseStatus.isPremium ? supabaseStatus.provider : revenueCatPremium ? 'revenuecat' : null,
      expiresAt: subscription?.expiresAt ?? supabaseStatus.expiresAt,
      subscription,
      managementUrl,
      isLoading,
      error,
      refresh,
      showPremiumPaywall,
      restorePurchases,
    }),
    [
      supabaseStatus,
      revenueCatPremium,
      subscription,
      managementUrl,
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
