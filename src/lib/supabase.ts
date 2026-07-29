import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';

import { env, getSupabaseConfigError } from '@/lib/env';
import type { Database } from '@/types/database';

import { supabaseStorage } from './supabaseStorage';

const configError = getSupabaseConfigError();

if (configError && __DEV__) {
  console.warn(`[supabase] ${configError}`);
}

function getClientOptions(): SupabaseClientOptions<'public'> {
  const options: SupabaseClientOptions<'public'> = {
    auth: {
      storage: supabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  };

  if (typeof window === 'undefined') {
    try {
      // Node SSR (static web export) needs a WebSocket implementation.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const WebSocket = require('ws');
      options.realtime = { transport: WebSocket };
    } catch {
      // Realtime is client-only; SSR only needs auth/rest.
    }
  }

  return options;
}

export const supabase = createClient<Database>(
  env.supabaseUrl || 'https://placeholder.supabase.co',
  env.supabaseAnonKey || 'placeholder',
  getClientOptions(),
);

export function assertSupabaseConfigured(): void {
  const error = getSupabaseConfigError();
  if (error) {
    throw new Error(error);
  }
}

export { configError as supabaseConfigError };
