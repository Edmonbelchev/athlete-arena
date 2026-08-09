import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

import { getAuthErrorMessage } from './authErrors';
import { handleAuthDeepLink } from './authDeepLink';

export function AuthDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!env.isSupabaseConfigured) {
      return;
    }

    let isMounted = true;

    async function processUrl(url: string) {
      try {
        const result = await handleAuthDeepLink(url);
        if (!isMounted) {
          return;
        }

        if (result === 'recovery') {
          router.replace('/reset-password');
          return;
        }

        if (result === 'signup' || result === 'magiclink') {
          router.replace('/(auth)/login');
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[auth] Deep link failed:', getAuthErrorMessage(error));
        }
      }
    }

    void Linking.getInitialURL().then((url) => {
      if (url) {
        void processUrl(url);
      }
    });

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      void processUrl(url);
    });

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password');
      }
    });

    return () => {
      isMounted = false;
      urlSubscription.remove();
      authSubscription.unsubscribe();
    };
  }, [router]);

  return null;
}
