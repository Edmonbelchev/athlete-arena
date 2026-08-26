import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { PremiumPaywallContent } from '@/components/subscription/PremiumPaywallModal';
import {
  type PremiumPaywallContext,
} from '@/features/subscription/premiumPaywallContent';
import { usePremium } from '@/features/subscription/usePremium';
import { leaveScreen } from '@/lib/navigation';

const PAYWALL_CONTEXTS = new Set<PremiumPaywallContext>([
  'default',
  'create_workout',
  'edit_workout',
  'membership',
  'challenge_requests',
]);

function parsePaywallContext(value: string | undefined): PremiumPaywallContext {
  if (value && PAYWALL_CONTEXTS.has(value as PremiumPaywallContext)) {
    return value as PremiumPaywallContext;
  }

  return 'default';
}

export default function PremiumPaywallScreen() {
  const router = useRouter();
  const { context, skipIntro } = useLocalSearchParams<{
    context?: string;
    skipIntro?: string;
  }>();
  const { completePremiumPaywall, triggerPaywallRestore, paywallRestoreLoading } = usePremium();
  const closedRef = useRef(false);

  const paywallContext = parsePaywallContext(context);
  const initialStep = skipIntro === '1' ? 'paywall' : 'intro';

  function finish(unlocked: boolean) {
    if (closedRef.current) {
      return;
    }

    closedRef.current = true;
    completePremiumPaywall(unlocked);
    leaveScreen(router);
  }

  useEffect(() => {
    return () => {
      if (!closedRef.current) {
        completePremiumPaywall(false);
      }
    };
  }, [completePremiumPaywall]);

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: false,
          gestureEnabled: true,
        }}
      />
      <PremiumPaywallContent
        context={paywallContext}
        initialStep={initialStep}
        restoreLoading={paywallRestoreLoading}
        onRestore={() => {
          void triggerPaywallRestore().then((restored) => {
            if (restored) {
              finish(true);
            }
          });
        }}
        onClose={finish}
      />
    </>
  );
}
