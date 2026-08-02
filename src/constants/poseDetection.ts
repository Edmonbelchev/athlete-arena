/** Tunable thresholds for pose-based rep counting (MediaPipe landmarks). */

export const POSE_LANDMARK_MIN_VISIBILITY = 0.45;

/** Minimum landmark confidence to use a point for rep counting. */
export const POSE_REP_MIN_VISIBILITY = 0.5;

export const POSE_QUALITY = {
  /** Keypoints that must be visible (of 6 tracked per exercise) before counting reps. */
  minVisibleTrackingPoints: 3,
  /** Brief warm-up frames once tracking points are visible. */
  stableFramesRequired: 2,
  /** Partial-tracking frames before resetting rep-engine state. */
  partialFramesBeforeReset: 15,
  /** Skeleton overlay visibility — slightly higher to reduce flicker. */
  skeletonMinVisibility: 0.5,
} as const;

export const PUSH_UP_THRESHOLDS = {
  /** Elbow angle (degrees) - arms extended at top of rep. */
  upAngle: 150,
  /** Elbow angle (degrees) - chest near floor at bottom. */
  downAngle: 95,
  /** Degrees of slack between phases to reduce jitter. */
  hysteresis: 8,
  /** Consecutive frames at bottom before a rep can complete. */
  minHoldFrames: 4,
} as const;

export const PULL_UP_THRESHOLDS = {
  /** Elbow angle (degrees) - hanging with arms extended. */
  upAngle: 160,
  /** Elbow angle (degrees) - bent enough at the top of a rep. */
  downAngle: 90,
  hysteresis: 8,
  minHoldFrames: 4,
} as const;

/** Pull-up rep validation — arms ROM + chin/head over bar (no leg/knee checks). */
export const PULL_UP_POSTURE = {
  /** Chin (lower face) at or above the bar line (y grows downward). */
  chinOverBarMargin: 0.015,
  /** Ear height proxy when filming from behind. */
  earOverBarMargin: 0.03,
  /** Shoulder-at-bar fallback when no face/ears are visible. */
  shoulderNearBarMargin: 0.04,
  /** Wrists stay near the captured bar line through the rep. */
  topWristNearBarMargin: 0.08,
  /** Frames with arms extended before counting begins. */
  readyFramesRequired: 3,
} as const;

export const DIP_THRESHOLDS = {
  /** Elbow angle (degrees) - arms locked out at top. */
  upAngle: 150,
  /** Elbow angle (degrees) - bottom of dip. */
  downAngle: 95,
  hysteresis: 8,
  minHoldFrames: 4,
} as const;

export const SQUAT_THRESHOLDS = {
  /** Knee angle (degrees) - standing upright. */
  standingAngle: 155,
  /** Knee angle (degrees) - bottom of squat. */
  bottomAngle: 100,
  hysteresis: 8,
  /** Consecutive frames at bottom before a rep can complete. */
  minHoldFrames: 4,
} as const;

import type { ExerciseType } from '@/constants/challenges';

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
      'Lower back to a full hang — the rep counts when your arms are extended again',
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
