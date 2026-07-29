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

export const SQUAT_THRESHOLDS = {
  /** Knee angle (degrees) - standing upright. */
  standingAngle: 155,
  /** Knee angle (degrees) - bottom of squat. */
  bottomAngle: 100,
  hysteresis: 8,
  /** Consecutive frames at bottom before a rep can complete. */
  minHoldFrames: 4,
} as const;

export const POSE_GUIDANCE: Record<
  'push_ups' | 'squats',
  { title: string; tips: readonly string[] }
> = {
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
};
