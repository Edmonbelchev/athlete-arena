/** Tunable thresholds for pose-based rep counting (MediaPipe landmarks). */

export const POSE_LANDMARK_MIN_VISIBILITY = 0.45;

export const PUSH_UP_THRESHOLDS = {
  /** Elbow angle (degrees) - arms extended at top of rep. */
  upAngle: 155,
  /** Elbow angle (degrees) - chest near floor at bottom. */
  downAngle: 92,
  /** Degrees of slack between phases to reduce jitter. */
  hysteresis: 8,
  /** Consecutive frames at bottom before a rep can complete. */
  minHoldFrames: 4,
} as const;

export const SQUAT_THRESHOLDS = {
  /** Knee angle (degrees) - standing upright. */
  standingAngle: 158,
  /** Knee angle (degrees) - bottom of squat. */
  bottomAngle: 98,
  hysteresis: 8,
  minHoldFrames: 4,
} as const;

export const POSE_GUIDANCE: Record<
  'push_ups' | 'squats',
  { title: string; tips: readonly string[] }
> = {
  push_ups: {
    title: 'Push-up setup',
    tips: [
      'Place your phone so your upper body and arms stay in frame',
      'Side view works best - keep shoulders, elbows, and wrists visible',
      'Go all the way down, then fully extend arms for each rep',
    ],
  },
  squats: {
    title: 'Squat setup',
    tips: [
      'Step back until your hips, knees, and ankles are visible',
      'Face the camera or stand at a slight angle',
      'Squat deep enough that your thighs break parallel',
    ],
  },
};
