import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { PREMIUM_ENTITLEMENT_ID } from '@/constants/subscription';
import { env } from '@/lib/env';
import {
  formatSubscriptionPlanLabel,
  type PremiumSubscriptionDetails,
} from '@/types/subscription';

export function getRevenueCatApiKey(): string | null {
  if (Platform.OS === 'ios') {
    return env.revenueCatIosApiKey || null;
  }

  if (Platform.OS === 'android') {
    return env.revenueCatAndroidApiKey || null;
  }

  return null;
}

export function isRevenueCatConfigured(): boolean {
  return Boolean(getRevenueCatApiKey());
}

export function customerHasPremiumEntitlement(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
}

export function getPremiumSubscriptionDetails(
  customerInfo: CustomerInfo,
): PremiumSubscriptionDetails | null {
  const entitlement = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
  if (!entitlement) {
    return null;
  }

  return {
    planLabel: formatSubscriptionPlanLabel(entitlement.productIdentifier),
    productId: entitlement.productIdentifier,
    expiresAt: entitlement.expirationDate,
    willRenew: entitlement.willRenew,
    source: 'revenuecat',
  };
}

export function getSubscriptionManagementUrl(customerInfo: CustomerInfo): string | null {
  return customerInfo.managementURL ?? null;
}

export async function getRevenueCatAppUserId(): Promise<string | null> {
  if (!isRevenueCatConfigured()) {
    return null;
  }

  return Purchases.getAppUserID();
}

export async function configureRevenueCat(): Promise<void> {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    return;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
  }

  Purchases.configure({ apiKey });
}

export async function identifyRevenueCatUser(userId: string): Promise<CustomerInfo | null> {
  if (!isRevenueCatConfigured()) {
    return null;
  }

  const { customerInfo } = await Purchases.logIn(userId);
  return customerInfo;
}

export async function logoutRevenueCatUser(): Promise<void> {
  if (!isRevenueCatConfigured()) {
    return;
  }

  const isAnonymous = await Purchases.isAnonymous();
  if (isAnonymous) {
    return;
  }

  await Purchases.logOut();
}

export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isRevenueCatConfigured()) {
    return null;
  }

  return Purchases.getCustomerInfo();
}

export async function waitForPremiumEntitlement(maxAttempts = 5, delayMs = 400): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const customerInfo = await Purchases.getCustomerInfo();
    if (customerHasPremiumEntitlement(customerInfo)) {
      return true;
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}

export async function presentPremiumPaywall(): Promise<boolean> {
  if (!isRevenueCatConfigured()) {
    return false;
  }

  const result = await RevenueCatUI.presentPaywall();

  // StoreKit sandbox sometimes reports CANCELLED even after a successful purchase.
  // Trust RevenueCat entitlements over PAYWALL_RESULT.
  const hasPremium = await waitForPremiumEntitlement();
  const reportedPurchase =
    result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;

  if (__DEV__) {
    const customerInfo = await Purchases.getCustomerInfo();
    console.log('[revenuecat] paywall closed', {
      result,
      reportedPurchase,
      hasPremium,
      activeEntitlements: Object.keys(customerInfo.entitlements.active),
    });
  }

  return hasPremium;
}

export async function restorePremiumPurchases(): Promise<boolean> {
  if (!isRevenueCatConfigured()) {
    return false;
  }

  const customerInfo = await Purchases.restorePurchases();
  return customerHasPremiumEntitlement(customerInfo);
}
