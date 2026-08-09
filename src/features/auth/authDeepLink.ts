import { assertSupabaseConfigured, supabase } from '@/lib/supabase';

export type AuthDeepLinkResult = 'recovery' | 'signup' | 'magiclink' | null;

function parseParamString(paramString: string): Record<string, string> {
  if (!paramString) {
    return {};
  }

  return Object.fromEntries(
    paramString.split('&').flatMap((part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        return [];
      }

      const key = decodeURIComponent(part.slice(0, separatorIndex));
      const value = decodeURIComponent(part.slice(separatorIndex + 1));
      return [[key, value]];
    }),
  );
}

export function parseAuthParamsFromUrl(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  const hashParams = hashIndex >= 0 ? parseParamString(url.slice(hashIndex + 1)) : {};
  const queryParams =
    queryIndex >= 0
      ? parseParamString(url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined))
      : {};

  return { ...queryParams, ...hashParams };
}

export async function handleAuthDeepLink(url: string): Promise<AuthDeepLinkResult> {
  assertSupabaseConfigured();

  const params = parseAuthParamsFromUrl(url);

  if (params.error || params.error_description) {
    throw new Error(params.error_description ?? params.error ?? 'Auth link failed.');
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (!accessToken || !refreshToken) {
    return null;
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }

  if (params.type === 'recovery') {
    return 'recovery';
  }

  if (params.type === 'signup') {
    return 'signup';
  }

  if (params.type === 'magiclink') {
    return 'magiclink';
  }

  return null;
}
