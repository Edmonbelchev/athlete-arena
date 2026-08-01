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
  /** Frames in plank before rep counting begins (avoids setup false positives). */
  readyStableFrames: 4,
  /** Shoulder rise from bottom required to validate a rep top. */
  minShoulderRise: 0.025,
} as const;

/** Front-facing push-ups — elbow angle is flattened; use shoulder travel too. */
export const PUSH_UP_FRONT_VIEW = {
  upAngle: 145,
  downAngle: 105,
  hysteresis: 10,
  minHoldFrames: 3,
  readyStableFrames: 4,
  minShoulderDrop: 0.028,
  minShoulderRise: 0.022,
  /** Hips and shoulders level within this y distance in plank. */
  maxShoulderHipYOffset: 0.1,
  /** Standing when hips sit this far below shoulders. */
  minStandingTorsoSpan: 0.13,
  hipToShoulderSpanRatio: 0.42,
  /** Slightly lower visibility — head turn often occludes one arm. */
  minLandmarkVisibility: 0.42,
} as const;

export const PUSH_UP_SIDE_VIEW = {
  upAngle: 152,
  downAngle: 92,
  hysteresis: 8,
  minHoldFrames: 4,
  readyStableFrames: 4,
  minShoulderDrop: 0.02,
  minShoulderRise: 0.025,
  maxShoulderHipYOffset: 0.11,
  minStandingTorsoSpan: 0.13,
  hipToShoulderSpanRatio: 0.42,
  minLandmarkVisibility: 0.45,
} as const;

export const PULL_UP_THRESHOLDS = {
  /** Elbow angle (degrees) - hanging with arms extended. */
  upAngle: 160,
  /** Elbow angle (degrees) - chin above bar. */
  downAngle: 90,
  hysteresis: 8,
  minHoldFrames: 4,
} as const;

/** Normalized landmark checks for real pull-up posture (side view, y grows downward). */
export const PULL_UP_POSTURE = {
  /** Wrists must sit above shoulders by at least this amount at dead hang. */
  hangWristAboveShoulderMargin: 0.035,
  /** Hips must sit below shoulders when hanging. */
  hangHipBelowShoulderMargin: 0.07,
  /** Minimum shoulder-to-hip vertical span while hanging. */
  minTorsoSpan: 0.14,
  /** Shoulders must rise at least this much from hang to the top of a rep. */
  minShoulderPullElevation: 0.045,
  /** Wrists stay near the overhead bar line at the top of the rep. */
  topWristAboveShoulderMargin: 0.02,
  /** Upper arm within this many degrees of vertical at dead hang. */
  maxUpperArmFromVertical: 40,
  /** Feet planted on the ground when ankles are visible. */
  standingAnkleBelowHipMin: 0.18,
  standingAnkleBelowHipMax: 0.55,
  standingAnkleHipXMax: 0.08,
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
  /** Minimum hip drop (normalized y) from standing before a rep counts at the bottom. */
  minHipDrop: 0.04,
} as const;

/** Stricter depth rules for side-profile squats (knee angle alone under-counts depth). */
export const SQUAT_SIDE_VIEW_THRESHOLDS = {
  standingAngle: 155,
  /** Require deeper knee bend than front view. */
  bottomAngle: 82,
  hysteresis: 6,
  minHoldFrames: 5,
  minHipDrop: 0.07,
  /** Hips overlap shoulders below this hip-to-shoulder x span ratio. */
  hipToShoulderSpanRatio: 0.45,
  /** Profile knee must sit near hip height for a valid bottom position. */
  kneeBelowHipMargin: 0.03,
} as const;

import type { ExerciseType } from '@/constants/challenges';

export const POSE_GUIDANCE: Record<ExerciseType, { title: string; tips: readonly string[] }> = {
  push_ups: {
    title: 'Push-up setup',
    tips: [
      'Face or side view both work — keep shoulders, elbows, and wrists in frame',
      'Get into a steady plank before reps count; setup movement will not count',
      'You do not need to look at the camera — keep your arms visible',
    ],
  },
  squats: {
    title: 'Squat setup',
    tips: [
      'Step back until hips, knees, and ankles stay in frame',
      'Front view works best for auto counting — side view requires deeper squats',
      'Rep counting pauses if your legs leave the frame',
    ],
  },
  pull_ups: {
    title: 'Pull-up setup',
    tips: [
      'Mount the phone side-on and use a pull-up bar — reps need an overhead hang',
      'Hang with arms fully extended, then pull until your shoulders rise near the bar',
      'Standing arm curls will not count — wrists must stay above your shoulders',
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
