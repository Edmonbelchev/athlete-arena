import type { SupabaseClientOptions } from '@supabase/supabase-js';

export function applyRealtimeTransport(
  _options: SupabaseClientOptions<'public'>,
): void {
  // React Native provides a built-in WebSocket; no Node `ws` transport needed.
}
