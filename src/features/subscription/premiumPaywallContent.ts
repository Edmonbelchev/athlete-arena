export type PremiumPaywallContext = 'default' | 'create_workout' | 'edit_workout' | 'membership';

export const PREMIUM_BENEFITS = [
  'Create custom workouts',
  'Edit saved workout templates',
  'Share workouts with friends',
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
    case 'membership':
      return {
        title: 'Upgrade to Premium',
        subtitle: 'Unlock custom workout create, edit, and share. Arena workouts stay free for everyone.',
        ctaLabel: 'See plans',
      };
    default:
      return {
        title: 'Go Premium',
        subtitle: 'Unlock custom workout create, edit, and share. Arena workouts stay free for everyone.',
        ctaLabel: 'See plans',
      };
  }
}
