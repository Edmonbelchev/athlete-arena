import type { AppIconName } from '@/constants/icons';

export type PremiumPaywallContext =
  | 'default'
  | 'create_workout'
  | 'edit_workout'
  | 'start_workout'
  | 'membership'
  | 'challenge_requests'
  | 'avatar_races'
  | 'quest_swaps';

export interface PremiumBenefit {
  title: string;
  detail: string;
  icon: AppIconName;
}

/** Everything Premium includes; shown on the paywall and the Membership screen. */
export const PREMIUM_BENEFIT_DETAILS: PremiumBenefit[] = [
  { title: 'Create custom workouts', detail: 'Build AMRAP, EMOM and For Time circuits.', icon: 'dumbbell' },
  { title: 'Edit saved workout templates', detail: 'Tweak your workouts any time.', icon: 'settings' },
  { title: 'Share workouts with friends', detail: 'Send your circuits to anyone.', icon: 'friends' },
  { title: 'Unlimited friend challenge requests', detail: 'No monthly cap on races.', icon: 'swords' },
  {
    title: 'Elf and Orc avatar races (worth 10,000 coins)',
    detail: 'Both legendary races, with ears, tusks and hairstyles.',
    icon: 'star',
  },
  { title: 'Unlimited daily quest swaps', detail: 'Swap quests free, as often as you like.', icon: 'swap' },
];

export const PREMIUM_BENEFITS = PREMIUM_BENEFIT_DETAILS.map((benefit) => benefit.title);

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
        subtitle:
          'Unlock custom workouts, unlimited challenge requests and quest swaps, and the Elf and Orc races. Arena workouts stay free for everyone.',
        ctaLabel: 'See plans',
      };
    case 'avatar_races':
      return {
        title: 'Play as an Elf or Orc',
        subtitle: 'Premium includes both legendary races - no coins needed. Keep your whole look, with race ears, tusks and hairstyles.',
        ctaLabel: 'See plans',
      };
    case 'quest_swaps':
      return {
        title: 'Unlimited quest swaps',
        subtitle: 'Free accounts get one free swap a day, then pay 50 coins. Premium swaps daily quests as often as you like.',
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
          'Unlock custom workouts, unlimited challenge requests and quest swaps, the Elf and Orc races, and more. Arena workouts stay free for everyone.',
        ctaLabel: 'See plans',
      };
  }
}
