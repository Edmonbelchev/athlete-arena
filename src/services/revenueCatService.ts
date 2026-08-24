import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { PREMIUM_ENTITLEMENT_ID } from '@/constants/subscription';
import { env } from '@/lib/env';

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

export async function presentPremiumPaywall(): Promise<boolean> {
  if (!isRevenueCatConfigured()) {
    return false;
  }

  const result = await RevenueCatUI.presentPaywall();
  return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
}

export async function restorePremiumPurchases(): Promise<boolean> {
  if (!isRevenueCatConfigured()) {
    return false;
  }

  const customerInfo = await Purchases.restorePurchases();
  return customerHasPremiumEntitlement(customerInfo);
}
