import type { AppIconName } from '@/constants/icons';

export interface OnboardingFeature {
  icon: AppIconName;
  title: string;
  description: string;
}

export interface OnboardingBenefit {
  exercise: string;
  muscles: string;
  note: string;
}

export const ONBOARDING_WELCOME = {
  title: 'Welcome to Athlete Arena',
  description:
    'A fitness challenge app that uses your camera to count reps, track streaks, and compete with friends — no gym equipment required beyond your body.',
};

export const ONBOARDING_HOW_IT_WORKS: OnboardingFeature[] = [
  {
    icon: 'target',
    title: 'Daily shared challenge',
    description:
      'Everyone gets the same exercise and rep target each day. Complete it to earn XP and coins.',
  },
  {
    icon: 'camera',
    title: 'Camera rep counting',
    description:
      'Your front camera tracks movement with pose detection. Position yourself in frame and the app counts valid reps.',
  },
  {
    icon: 'friends',
    title: 'Friend speed races',
    description:
      'Challenge friends to finish a set fastest. Accept races, run your attempt, and compare results.',
  },
  {
    icon: 'medal',
    title: 'XP, levels & achievements',
    description:
      'Build streaks, level up from XP, unlock achievements, and spend coins on emotes in the shop.',
  },
];

export const ONBOARDING_BENEFITS_INTRO =
  'Regular strength training supports muscle and bone health. Major health organizations recommend muscle-strengthening activity at least twice per week for adults. Here is what each exercise in the app mainly works:';

export const ONBOARDING_EXERCISE_BENEFITS: OnboardingBenefit[] = [
  {
    exercise: 'Push-ups',
    muscles: 'Chest, shoulders, triceps, and core stabilizers',
    note: 'A familiar bodyweight pushing exercise you can scale by angle or knee variation.',
  },
  {
    exercise: 'Squats',
    muscles: 'Quadriceps, glutes, hamstrings, and core',
    note: 'Supports lower-body strength and everyday movements like sitting and standing.',
  },
  {
    exercise: 'Pull-ups',
    muscles: 'Back (lats), biceps, and grip',
    note: 'A demanding pulling movement — progress takes time; use assisted variations if needed.',
  },
];

export const ONBOARDING_GENERAL_NOTE =
  'This app is not medical advice. Start within your ability, rest when needed, and consult a professional if you have injuries or health concerns. Consistency matters more than max reps in a single session.';

export const ONBOARDING_CAMERA = {
  title: 'Try the camera (optional)',
  description:
    'Grant camera access and do a few push-ups in frame. This is a practice run — nothing is saved to your profile.',
  targetReps: 3,
  exerciseType: 'push_ups' as const,
};

export const ONBOARDING_DONE = {
  title: 'You are ready',
  description:
    'Check today\'s challenge on Home, add friends from the Friends tab, and come back daily to keep your streak alive.',
};

export const ONBOARDING_STEP_COUNT = 5;
