export interface PremiumSubscriptionDetails {
  planLabel: string;
  productId: string | null;
  expiresAt: string | null;
  willRenew: boolean;
  source: 'revenuecat' | 'supabase';
}

export function formatSubscriptionPlanLabel(productId: string | null | undefined): string {
  if (!productId) {
    return 'Premium';
  }

  const normalized = productId.toLowerCase();

  if (normalized.includes('year') || normalized.includes('annual')) {
    return 'Yearly';
  }

  if (normalized.includes('month')) {
    return 'Monthly';
  }

  return 'Premium';
}

export function formatSubscriptionDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return '—';
  }

  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
