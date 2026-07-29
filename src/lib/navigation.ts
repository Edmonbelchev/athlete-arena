import type { Href, Router } from 'expo-router';

type Routable = Pick<Router, 'back' | 'canGoBack' | 'replace' | 'dismiss' | 'canDismiss'>;

export function leaveScreen(router: Routable, fallback: Href = '/(tabs)/profile'): void {
  if (typeof router.canDismiss === 'function' && router.canDismiss()) {
    router.dismiss();
    return;
  }

  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
