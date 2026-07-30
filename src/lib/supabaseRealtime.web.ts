import type { SupabaseClientOptions } from '@supabase/supabase-js';

export function applyRealtimeTransport(options: SupabaseClientOptions<'public'>): void {
  if (typeof window !== 'undefined') {
    return;
  }

  try {
    // Static web export SSR runs in Node and needs a WebSocket implementation.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WebSocket = require('ws');
    options.realtime = { transport: WebSocket };
  } catch {
    // Realtime is client-only; SSR only needs auth/rest.
  }
}
