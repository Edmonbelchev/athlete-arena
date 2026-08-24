import { assertSupabaseConfigured, supabase } from '@/lib/supabase';

export interface PremiumStatus {
  isPremium: boolean;
  provider: string | null;
  expiresAt: string | null;
}

export async function getMyPremiumStatus(): Promise<PremiumStatus> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_my_premium_status');

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    isPremium: Boolean(row?.is_premium),
    provider: row?.provider ?? null,
    expiresAt: row?.expires_at ?? null,
  };
}

/** Upserts server-side premium after RevenueCat restore or purchase. */
export async function syncMyRevenueCatSubscription(expiresAt: string | null): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('sync_my_revenuecat_subscription', {
    p_expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }
}
