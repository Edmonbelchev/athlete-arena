export type PremiumPaywallContext =
  | 'default'
  | 'create_workout'
  | 'edit_workout'
  | 'start_workout'
  | 'membership'
  | 'challenge_requests';

export const PREMIUM_BENEFITS = [
  'Create custom workouts',
  'Edit saved workout templates',
  'Share workouts with friends',
  'Unlimited friend challenge requests',
] as const;

export interface PremiumPaywallContent {
  title: string;
  subtitle: string;
  ctaLabel: string;
}

export function getPremiumPaywallContent(context: PremiumPaywallContext): PremiumPaywallContent {
  switch (context) {
    case 'create_workout':
      return {
        title: 'Unlock custom workouts',
        subtitle: 'Build your own circuits, save them to your library, and share them with friends.',
        ctaLabel: 'See plans',
      };
    case 'edit_workout':
      return {
        title: 'Edit your workouts',
        subtitle: 'Premium lets you update saved templates anytime.',
        ctaLabel: 'See plans',
      };
    case 'start_workout':
      return {
        title: 'Unlock your workouts',
        subtitle: 'Renew Premium to start the custom workouts you created. Arena workouts stay free for everyone.',
        ctaLabel: 'See plans',
      };
    case 'membership':
      return {
        title: 'Upgrade to Premium',
        subtitle: 'Unlock custom workouts and unlimited friend challenge requests. Arena workouts stay free for everyone.',
        ctaLabel: 'See plans',
      };
    case 'challenge_requests':
      return {
        title: 'Unlimited challenge requests',
        subtitle: 'Free accounts can send 10 friend challenges per month. Premium removes the cap.',
        ctaLabel: 'See plans',
      };
    default:
      return {
        title: 'Go Premium',
        subtitle:
          'Unlock custom workouts, unlimited friend challenge requests, and more. Arena workouts stay free for everyone.',
        ctaLabel: 'See plans',
      };
  }
}
