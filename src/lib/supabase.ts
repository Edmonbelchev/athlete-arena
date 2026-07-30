import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';

import { env, getSupabaseConfigError } from '@/lib/env';
import type { Database } from '@/types/database';

import { applyRealtimeTransport } from './supabaseRealtime';
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

  applyRealtimeTransport(options);

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
