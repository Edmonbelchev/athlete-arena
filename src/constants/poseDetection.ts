import { Platform } from 'react-native';

import type { ExerciseType } from '@/constants/challenges';

const isNativeMobile = Platform.OS === 'ios' || Platform.OS === 'android';

/** Tunable thresholds for pose-based rep counting (MediaPipe landmarks). */

export const POSE_LANDMARK_MIN_VISIBILITY = isNativeMobile ? 0.35 : 0.45;

/** Minimum landmark confidence to use a point for rep counting. */
export const POSE_REP_MIN_VISIBILITY = isNativeMobile ? 0.35 : 0.5;

/** Lower bar while a pull-up set is active - wrists/face flicker more on phone. */
export const POSE_REP_MIN_VISIBILITY_ARMED = isNativeMobile ? 0.28 : 0.45;

export const POSE_QUALITY = {
  /** Keypoints that must be visible (of 6 tracked per exercise) before counting reps. */
  minVisibleTrackingPoints: isNativeMobile ? 2 : 3,
  /** Brief warm-up frames once tracking points are visible. */
  stableFramesRequired: isNativeMobile ? 1 : 2,
  /** Partial-tracking frames before resetting rep-engine state. */
  partialFramesBeforeReset: isNativeMobile ? 30 : 15,
  /** Partial-tracking frames before resetting an armed pull-up set. */
  partialFramesBeforeResetPullUpArmed: isNativeMobile ? 8 : 6,
  /** Partial-tracking frames before resetting an armed push-up set. */
  partialFramesBeforeResetPushUpArmed: isNativeMobile ? 45 : 30,
  /** Skeleton overlay visibility - slightly higher to reduce flicker. */
  skeletonMinVisibility: isNativeMobile ? 0.4 : 0.5,
} as const;

/** Stricter tracking warmup when the preview is wider than tall. */
export const POSE_QUALITY_LANDSCAPE = {
  minVisibleTrackingPoints: isNativeMobile ? 3 : 3,
  stableFramesRequired: isNativeMobile ? 6 : 4,
  /** Average landmark movement per frame above this resets the warmup. */
  maxWarmupJitter: isNativeMobile ? 0.036 : 0.03,
  /** Consecutive low-jitter frames required before reps can count. */
  calmFramesRequired: isNativeMobile ? 4 : 3,
  /** Extra frames after the quality gate first passes in landscape. */
  readyHoldFrames: isNativeMobile ? 3 : 2,
} as const;

/** Ignore mapped landmarks briefly after the preview layout changes. */
export const POSE_VIEW_SETTLE_MS = isNativeMobile ? 700 : 500;

/** Drop additional frames after layout settle in landscape previews. */
export const POSE_LANDSCAPE_POST_SETTLE_FRAMES = isNativeMobile ? 4 : 3;

/** Ramp landmark smoothing from heavy to normal after each reset. */
export const POSE_LANDMARK_WARMUP = {
  frames: isNativeMobile ? 20 : 14,
  startAlpha: isNativeMobile ? 0.24 : 0.32,
} as const;

export const PUSH_UP_THRESHOLDS = {
  /** Elbow angle (degrees) - arms extended at top of rep. */
  upAngle: 152,
  /** Elbow angle (degrees) - chest near floor at bottom. */
  downAngle: 98,
  /** Degrees of slack between phases to reduce jitter. */
  hysteresis: isNativeMobile ? 14 : 16,
} as const;

/** Push-up rep validation - horizontal plank with hands on the floor. */
export const PUSH_UP_POSTURE = {
  /** Shoulder and hip stay near the same height in a side-view plank. */
  maxShoulderHipYDelta: isNativeMobile ? 0.1 : 0.08,
  /** Reject upright torsos (standing and mimicking arm motion). */
  maxTorsoFromHorizontal: isNativeMobile ? 40 : 35,
  /** Wrists must sit at or below shoulder height (hands on the ground). */
  minWristBelowShoulder: isNativeMobile ? 0.02 : 0.025,
  /** Frames in a valid plank before rep counting begins. */
  readyFramesRequired: isNativeMobile ? 3 : 4,
  /** Consecutive frames at arm extension before rep counting begins (also counted during arming). */
  topHoldFramesBeforeReps: 1,
  /** Consecutive frames in the bottom zone before depth counts. */
  bottomHoldFrames: 1,
  /** Consecutive frames at full extension before a rep registers (0 = first frame). */
  topHoldFramesForRep: 0,
  /** Shoulder drop from the last top position required at the bottom. */
  minShoulderDropAtBottom: isNativeMobile ? 0.042 : 0.048,
  /** Fallback chest-depth check when top shoulder baseline is unavailable. */
  maxShoulderAboveWristAtBottom: isNativeMobile ? 0.16 : 0.14,
  /** Both shoulders visible across the frame when facing the camera. */
  minShoulderWidthFront: isNativeMobile ? 0.12 : 0.14,
  /** Shoulders sit above hips when facing the camera. */
  minShoulderAboveHipFront: isNativeMobile ? 0.04 : 0.05,
  /** Wrists extend clearly below shoulders relative to torso depth (front-view arming). */
  minArmDropToTorsoRatioFront: isNativeMobile ? 0.55 : 0.65,
  /** Wrists at hip height while upright - standing, not a floor push-up. */
  maxStandingWristAboveHip: isNativeMobile ? 0.03 : 0.025,
  /** Wrists may sit above the hip line in front-view camera perspective and still be on the floor. */
  maxWristAboveHipForFloor: isNativeMobile ? 0.06 : 0.05,
  /** Front-view plank: hips too far below shoulders means standing/bent-over, not a floor plank. */
  maxShoulderAboveHipFrontPlank: isNativeMobile ? 0.15 : 0.13,
  /** Above this shoulder-hip span in front view, wrists must sit clearly below hips (floor). */
  maxShoulderAboveHipFrontActive: isNativeMobile ? 0.13 : 0.11,
  /** Required wrist drop below hips when the torso looks bent-over (y grows down). */
  minWristBelowHipForPlank: isNativeMobile ? 0.015 : 0.018,
  /** Wrists must stay near ankle height when feet are visible (strong floor anchor). */
  maxWristAboveAnkleForFloor: isNativeMobile ? 0.1 : 0.08,
  /** Frames with hands off the floor before the set disarms (pre-counting). */
  offFloorFramesBeforeRelease: isNativeMobile ? 4 : 5,
  /** Out-of-plank frames before disarming an active counting set (~0.5s). */
  plankBreakFramesBeforeRelease: isNativeMobile ? 15 : 12,
  /** Longer grace while resuming after a counted set (~1.5s). */
  plankBreakFramesBeforeReleaseActive: isNativeMobile ? 45 : 36,
  /** Active reps: max upward drift from the floor line captured at arming (y grows down). */
  maxWristDriftUpFromFloor: isNativeMobile ? 0.04 : 0.035,
  /** Minimum wrist drop from shoulders while a front-view set is active. */
  minWristBelowShoulderActive: isNativeMobile ? 0.012 : 0.015,
} as const;

export const PULL_UP_THRESHOLDS = {
  /** Elbow angle (degrees) - hanging with arms extended. */
  upAngle: 165,
  /** Elbow angle (degrees) - bent enough at the top of a rep. */
  downAngle: 90,
  hysteresis: isNativeMobile ? 16 : 12,
} as const;

/** Pull-up rep validation - dead hang on bar + chin/head over bar at top. */
export const PULL_UP_POSTURE = {
  /** Chin (lower face) at or above the bar line (y grows downward). */
  chinOverBarMargin: isNativeMobile ? 0.055 : 0.025,
  /** Ear height proxy when filming from behind. */
  earOverBarMargin: isNativeMobile ? 0.055 : 0.035,
  /** Shoulder-at-bar fallback when no face/ears are visible. */
  shoulderNearBarMargin: isNativeMobile ? 0.2 : 0.16,
  /** Wrists stay near the captured bar line through the rep. */
  topWristNearBarMargin: isNativeMobile ? 0.2 : 0.1,
  /** Wrist Y must be at or above shoulders (negative = wrists higher on screen). */
  maxWristShoulderYDelta: isNativeMobile ? -0.01 : -0.015,
  /** Wrist → elbow → shoulder chain when reaching up to the bar. */
  armRaisedChainMargin: isNativeMobile ? 0.045 : 0.035,
  /** Head/chin must sit below the bar line on a dead hang. */
  minHeadBelowBar: isNativeMobile ? 0.012 : 0.018,
  /** Frames in a valid dead hang before counting begins. */
  readyFramesRequired: isNativeMobile ? 2 : 3,
  /** Consecutive top-posture frames before a rep registers (fallback; edge trigger is primary). */
  topPostureHoldFrames: 1,
  /** Frames to ignore a second top trigger after a rep (fast-rep cadence). */
  repCooldownFrames: isNativeMobile ? 10 : 12,
  /** Frames below the bar between reps before the next top can count. */
  minClearOfTopFrames: isNativeMobile ? 2 : 3,
  /** Wrists this far below the captured bar line means hands left the bar (y grows down). */
  leftBarWristDropMargin: isNativeMobile ? 0.06 : 0.05,
  /** Frames off-bar before the set disarms. */
  offBarFramesBeforeRelease: isNativeMobile ? 4 : 5,
  /** Wrists below hips by at least this much before the bar line is dropped (y grows down). */
  minWristBelowHipMargin: isNativeMobile ? 0.02 : 0.025,
} as const;

export const SQUAT_THRESHOLDS = {
  /** Knee angle (degrees) - standing upright. */
  standingAngle: 155,
  /** Knee angle (degrees) - bottom of squat. */
  bottomAngle: 100,
  hysteresis: isNativeMobile ? 15 : 20,
} as const;

/** Squat rep validation - both feet down and knees move together. */
export const SQUAT_POSTURE = {
  /** Left and right ankles stay near the same height when both feet are on the floor. */
  maxAnkleYDelta: isNativeMobile ? 0.12 : 0.1,
  /** Both knees bend by a similar amount during a real squat. */
  maxKneeAngleAsymmetry: 40,
  /** Left and right knees stay near the same depth while squatting. */
  maxKneeYDelta: isNativeMobile ? 0.14 : 0.12,
  /** Frames standing in a valid stance before rep counting begins. */
  readyFramesRequired: isNativeMobile ? 3 : 4,
  /** Consecutive frames at squat depth before bottom counts toward a rep. */
  bottomHoldFrames: isNativeMobile ? 2 : 3,
} as const;

export const BURPEE_THRESHOLDS = {
  /** Knee angle (degrees) - standing upright at top of rep (front view). */
  standingAngle: 155,
  /** Knee angle (degrees) - partial squat drop (front view). */
  dropAngle: 130,
  /** Degrees of slack between phases to reduce jitter (front view). */
  hysteresis: isNativeMobile ? 15 : 20,
} as const;

/** Burpee rep validation - partial squat drop + horizontal body on floor (plank or chest-down). */
export const BURPEE_POSTURE = {
  /** Front view: torso near horizontal on the floor. */
  maxTorsoFromHorizontalFront: isNativeMobile ? 55 : 50,
  /** Side view: torso near horizontal on the floor. */
  maxTorsoFromHorizontalSide: isNativeMobile ? 65 : 60,
  /** Side view: shoulder and hip stay near the same height on the floor. */
  maxShoulderHipYDeltaSide: isNativeMobile ? 0.22 : 0.2,
  /** Reject clearly upright torsos during the ground-phase check. */
  minUprightTorsoAngle: isNativeMobile ? 60 : 55,
  /** Both shoulders visible across the frame when facing the camera. */
  minShoulderWidthFront: isNativeMobile ? 0.12 : 0.14,
  /** Shoulders stacked - body in profile to the camera. */
  maxShoulderWidthSide: isNativeMobile ? 0.09 : 0.11,
  /** Shoulders sit above hips when facing the camera and standing. */
  minShoulderAboveHipFront: isNativeMobile ? 0.04 : 0.05,
  /** Both ankles near the same height during the standing/drop phases (front view). */
  maxAnkleYDelta: isNativeMobile ? 0.14 : 0.12,
  /** Both knees bend by a similar amount during the drop (front view). */
  maxKneeAngleAsymmetry: 45,
  /** Frames to ignore new rep progress after a rep registers. */
  repCooldownFrames: isNativeMobile ? 12 : 10,
} as const;

/** EMA smoothing for native camera landmarks (0 = frozen, 1 = raw). */
export const POSE_LANDMARK_SMOOTH_ALPHA = isNativeMobile ? 0.52 : 1;

/** Faster landmark follow for pull-ups so quick peaks are not smoothed away. */
export const POSE_LANDMARK_SMOOTH_ALPHA_PULL_UP = isNativeMobile ? 0.68 : 1;

export const POSE_GUIDANCE: Record<ExerciseType, { title: string; tips: readonly string[] }> = {
  push_ups: {
    title: 'Push-up setup',
    tips: [
      'Face the camera in portrait with your phone propped low',
      'Keep shoulders, hips, elbows, and wrists in frame',
      'Rep counting starts once you hold a plank with hands on the floor',
    ],
  },
  squats: {
    title: 'Squat setup',
    tips: [
      'Prop your phone in portrait and step back until both legs are visible',
      'Squat with both feet on the floor - one-legged moves will not count',
      'Face the camera and stand tall before you start',
    ],
  },
  pull_ups: {
    title: 'Pull-up setup',
    tips: [
      'Prop your phone in portrait where you can see the bar and your upper body',
      'Reach up and hang from the bar with arms fully extended',
      'Rep counting starts only in a dead hang; pull until your chin clears the bar',
    ],
  },
  burpees: {
    title: 'Burpee setup',
    tips: [
      'Prop your phone in portrait and keep your full body in frame',
      'Stand tall to start, then drop, kick back, and jump up',
      'Chest-to-floor counts - you do not need a push-up at the bottom',
    ],
  },
};
