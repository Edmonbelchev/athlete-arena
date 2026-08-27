import type { ExerciseType } from '@/constants/challenges';
import { POSE_REP_MIN_VISIBILITY } from '@/constants/poseDetection';
import type { WorkoutCoachSeverity } from '@/features/challenges/workoutGuidance';

import type { RepEngine } from './pose/createRepEngine';
import { PoseLandmarkIndex, type PoseLandmark } from './pose/landmarks';
import type { PoseQualityResult, PoseTrackingStatus } from './pose/poseQuality';
import { PullUpRepEngine } from './pose/pullUpRepEngine';
import { PushUpRepEngine } from './pose/pushUpRepEngine';
import { SquatRepEngine } from './pose/squatRepEngine';
import { JumpingSquatRepEngine } from './pose/jumpingSquatRepEngine';
import { JumpingJackRepEngine } from './pose/jumpingJackRepEngine';

function isLandmarkVisible(
  landmark: PoseLandmark | undefined,
  minVisibility: number = POSE_REP_MIN_VISIBILITY,
): boolean {
  return Boolean(landmark && (landmark.visibility ?? 1) >= minVisibility);
}

/** Looser body presence check — person is in frame even if tracking is not ready yet. */
export function hasVisiblePerson(landmarks: PoseLandmark[]): boolean {
  if (landmarks.length === 0) {
    return false;
  }

  const presencePoints = [
    PoseLandmarkIndex.NOSE,
    PoseLandmarkIndex.LEFT_SHOULDER,
    PoseLandmarkIndex.RIGHT_SHOULDER,
    PoseLandmarkIndex.LEFT_HIP,
    PoseLandmarkIndex.RIGHT_HIP,
    PoseLandmarkIndex.LEFT_ELBOW,
    PoseLandmarkIndex.RIGHT_ELBOW,
  ];

  let visibleCount = 0;
  for (const index of presencePoints) {
    if (isLandmarkVisible(landmarks[index], POSE_REP_MIN_VISIBILITY * 0.75)) {
      visibleCount += 1;
    }
  }

  return visibleCount >= 2;
}

function getSetupSeverity(
  exerciseType: ExerciseType,
  engine: RepEngine,
  trackingStatus: PoseTrackingStatus,
): WorkoutCoachSeverity {
  switch (exerciseType) {
    case 'pull_ups':
      return (engine as PullUpRepEngine).armed ? 'ready' : 'setup';
    case 'push_ups': {
      const pushUpEngine = engine as PushUpRepEngine;
      if (pushUpEngine.repCountingActive) {
        return 'ready';
      }
      return 'setup';
    }
    case 'squats':
      return (engine as SquatRepEngine).armed ? 'ready' : 'setup';
    case 'jumping_squats':
      return (engine as JumpingSquatRepEngine).armed ? 'ready' : 'setup';
    case 'jumping_jacks':
      return (engine as JumpingJackRepEngine).armed ? 'ready' : 'setup';
    default:
      return trackingStatus === 'ready' ? 'ready' : 'setup';
  }
}

export function getCoachSeverity(
  exerciseType: ExerciseType,
  engine: RepEngine,
  landmarks: PoseLandmark[],
  _quality: PoseQualityResult,
  trackingStatus: PoseTrackingStatus,
): WorkoutCoachSeverity {
  if (exerciseType === 'push_ups') {
    const pushUpEngine = engine as PushUpRepEngine;
    if (pushUpEngine.repCountingActive) {
      return 'ready';
    }
  }

  if (!hasVisiblePerson(landmarks)) {
    return 'tracking';
  }

  return getSetupSeverity(exerciseType, engine, trackingStatus);
}
