import Purchases from 'react-native-purchases';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth';
import {
  configureRevenueCat,
  customerHasPremiumEntitlement,
  identifyRevenueCatUser,
  isRevenueCatConfigured,
  logoutRevenueCatUser,
} from '@/services/revenueCatService';

export function RevenueCatBootstrap(): null {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!isRevenueCatConfigured()) {
      if (__DEV__) {
        console.warn(
          '[revenuecat] SDK not configured. Set EXPO_PUBLIC_REVENUECAT_IOS_API_KEY in .env and rebuild the native app.',
        );
      }
      return;
    }

    let cancelled = false;

    async function bootstrapRevenueCat() {
      await configureRevenueCat();
      if (cancelled) {
        return;
      }

      if (!userId) {
        await logoutRevenueCatUser().catch(() => {});
        return;
      }

      try {
        const customerInfo = await identifyRevenueCatUser(userId);
        if (__DEV__ && customerInfo) {
          const appUserId = await Purchases.getAppUserID();
          console.log('[revenuecat] linked to Supabase user', {
            appUserId,
            activeEntitlements: Object.keys(customerInfo.entitlements.active),
            hasPremium: customerHasPremiumEntitlement(customerInfo),
          });
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[revenuecat] Failed to identify user:', error);
        }
      }
    }

    void bootstrapRevenueCat();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return null;
}
