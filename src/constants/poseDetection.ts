import { Platform } from 'react-native';

import type { ExerciseType } from '@/constants/challenges';

const isNativeMobile = Platform.OS === 'ios' || Platform.OS === 'android';

/** Tunable thresholds for pose-based rep counting (MediaPipe landmarks). */

export const POSE_LANDMARK_MIN_VISIBILITY = isNativeMobile ? 0.35 : 0.45;

/** Minimum landmark confidence to use a point for rep counting. */
export const POSE_REP_MIN_VISIBILITY = isNativeMobile ? 0.35 : 0.5;

/** Lower bar while a pull-up set is active — wrists/face flicker more on phone. */
export const POSE_REP_MIN_VISIBILITY_ARMED = isNativeMobile ? 0.28 : 0.45;

export const POSE_QUALITY = {
  /** Keypoints that must be visible (of 6 tracked per exercise) before counting reps. */
  minVisibleTrackingPoints: isNativeMobile ? 2 : 3,
  /** Brief warm-up frames once tracking points are visible. */
  stableFramesRequired: isNativeMobile ? 1 : 2,
  /** Partial-tracking frames before resetting rep-engine state. */
  partialFramesBeforeReset: isNativeMobile ? 30 : 15,
  /** Longer leash once pull-ups are armed — avoids jitter resets mid-set. */
  partialFramesBeforeResetArmed: isNativeMobile ? 50 : 25,
  /** Skeleton overlay visibility — slightly higher to reduce flicker. */
  skeletonMinVisibility: isNativeMobile ? 0.4 : 0.5,
} as const;

export const PUSH_UP_THRESHOLDS = {
  /** Elbow angle (degrees) - arms extended at top of rep. */
  upAngle: 150,
  /** Elbow angle (degrees) - chest near floor at bottom. */
  downAngle: 95,
  /** Degrees of slack between phases to reduce jitter. */
  hysteresis: isNativeMobile ? 12 : 8,
} as const;

export const PULL_UP_THRESHOLDS = {
  /** Elbow angle (degrees) - hanging with arms extended. */
  upAngle: 165,
  /** Elbow angle (degrees) - bent enough at the top of a rep. */
  downAngle: 90,
  hysteresis: isNativeMobile ? 14 : 8,
} as const;

/** Pull-up rep validation — arms ROM + chin/head over bar (no leg/knee checks). */
export const PULL_UP_POSTURE = {
  /** Chin (lower face) at or above the bar line (y grows downward). */
  chinOverBarMargin: isNativeMobile ? 0.03 : 0.01,
  /** Ear height proxy when filming from behind. */
  earOverBarMargin: isNativeMobile ? 0.045 : 0.03,
  /** Shoulder-at-bar fallback when no face/ears are visible. */
  shoulderNearBarMargin: isNativeMobile ? 0.18 : 0.15,
  /** Wrists stay near the captured bar line through the rep. */
  topWristNearBarMargin: isNativeMobile ? 0.14 : 0.08,
  /** Frames with arms extended before counting begins. */
  readyFramesRequired: isNativeMobile ? 2 : 3,
} as const;

export const DIP_THRESHOLDS = {
  /** Elbow angle (degrees) - arms locked out at top. */
  upAngle: 150,
  /** Elbow angle (degrees) - bottom of dip. */
  downAngle: 95,
  hysteresis: isNativeMobile ? 12 : 8,
} as const;

export const SQUAT_THRESHOLDS = {
  /** Knee angle (degrees) - standing upright. */
  standingAngle: 155,
  /** Knee angle (degrees) - bottom of squat. */
  bottomAngle: 100,
  hysteresis: isNativeMobile ? 12 : 8,
} as const;

/** EMA smoothing for native camera landmarks (0 = frozen, 1 = raw). */
export const POSE_LANDMARK_SMOOTH_ALPHA = isNativeMobile ? 0.52 : 1;

export const POSE_GUIDANCE: Record<ExerciseType, { title: string; tips: readonly string[] }> = {
  push_ups: {
    title: 'Push-up setup',
    tips: [
      'Keep shoulders, elbows, and wrists in frame',
      'Side view works best — go all the way down, then fully extend',
      'Rep counting pauses if your arms leave the frame',
    ],
  },
  squats: {
    title: 'Squat setup',
    tips: [
      'Step back until hips, knees, and ankles stay in frame',
      'Face the camera or stand at a slight angle',
      'Rep counting pauses if your legs leave the frame',
    ],
  },
  pull_ups: {
    title: 'Pull-up setup',
    tips: [
      'Keep your head and arms in frame — legs/knees do not matter',
      'Hang with arms fully extended, then pull until your chin clears the bar',
      'Rep counts as soon as your chin clears the bar with good form',
      'Front or back camera angles both work',
    ],
  },
  dips: {
    title: 'Dip setup',
    tips: [
      'Side view works best — keep shoulders, elbows, and wrists visible',
      'Lower until your elbows bend, then press back to full extension',
      'Rep counting pauses if your arms leave the frame',
    ],
  },
};
