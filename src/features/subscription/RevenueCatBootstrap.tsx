import { useEffect } from 'react';

import { useAuth } from '@/features/auth';
import {
  configureRevenueCat,
  identifyRevenueCatUser,
  isRevenueCatConfigured,
  logoutRevenueCatUser,
} from '@/services/revenueCatService';

export function RevenueCatBootstrap(): null {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!isRevenueCatConfigured()) {
      return;
    }

    void configureRevenueCat();
  }, []);

  useEffect(() => {
    if (!isRevenueCatConfigured()) {
      return;
    }

    if (!userId) {
      void logoutRevenueCatUser().catch(() => {});
      return;
    }

    void identifyRevenueCatUser(userId).catch((error) => {
      if (__DEV__) {
        console.warn('[revenuecat] Failed to identify user:', error);
      }
    });
  }, [userId]);

  return null;
}
