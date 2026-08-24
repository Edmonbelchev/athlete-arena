const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
const visualGuideCacheVersion = process.env.EXPO_PUBLIC_VISUAL_GUIDE_CACHE_VERSION?.trim() ?? '';
const revenueCatIosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ?? '';
const revenueCatAndroidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() ?? '';

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  visualGuideCacheVersion,
  revenueCatIosApiKey,
  revenueCatAndroidApiKey,
  isSupabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
} as const;

export function getSupabaseConfigError(): string | null {
  if (!supabaseUrl && !supabaseAnonKey) {
    return 'Missing EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.';
  }

  if (!supabaseUrl) {
    return 'Missing EXPO_PUBLIC_SUPABASE_URL in .env';
  }

  if (!supabaseAnonKey) {
    return 'Missing EXPO_PUBLIC_SUPABASE_ANON_KEY in .env';
  }

  if (!supabaseUrl.startsWith('https://')) {
    return 'EXPO_PUBLIC_SUPABASE_URL must start with https://';
  }

  return null;
}
