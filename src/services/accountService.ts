import { signOut } from '@/features/auth/authService';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';

export async function deleteMyAccount(reason?: string): Promise<void> {
  assertSupabaseConfigured();

  const trimmedReason = reason?.trim();
  const { error } = await supabase.rpc('delete_my_account', {
    p_reason: trimmedReason ? trimmedReason : null,
  });

  if (error) {
    throw error;
  }

  await signOut();
}
