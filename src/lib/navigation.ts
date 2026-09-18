import type { Href, Router } from 'expo-router';

type Routable = Pick<Router, 'back' | 'canGoBack' | 'replace' | 'dismiss' | 'canDismiss'>;

/** Wait for native purchase UI teardown before closing the paywall route. */
export function waitForUiSettle(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** Rough wait for stack modal dismiss animation before showing another modal/scroll surface. */
export function waitForModalDismiss(ms = 450): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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
