import type { ExerciseType } from '@/constants/challenges';
import { DIP_THRESHOLDS } from '@/constants/poseDetection';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';

import { ElbowRepEngine } from './elbowRepEngine';
import type { PoseLandmark } from './landmarks';
import { PullUpRepEngine } from './pullUpRepEngine';
import { PushUpRepEngine } from './pushUpRepEngine';
import type { AngleThresholdConfig } from './repEngineUtils';
import { SquatRepEngine } from './squatRepEngine';

export interface RepEngine {
  phase: ExercisePhase;
  update: (landmarks: PoseLandmark[]) => boolean;
  reset: () => void;
}

function toElbowThresholds(thresholds: {
  upAngle: number;
  downAngle: number;
  hysteresis: number;
}): AngleThresholdConfig {
  return {
    high: thresholds.upAngle,
    low: thresholds.downAngle,
    hysteresis: thresholds.hysteresis,
  };
}

const DIP_ELBOW_THRESHOLDS = toElbowThresholds(DIP_THRESHOLDS);

export function createRepEngine(exerciseType: ExerciseType): RepEngine {
  if (exerciseType === 'squats') {
    return new SquatRepEngine();
  }

  if (exerciseType === 'pull_ups') {
    return new PullUpRepEngine();
  }

  if (exerciseType === 'push_ups') {
    return new PushUpRepEngine();
  }

  return new ElbowRepEngine(DIP_ELBOW_THRESHOLDS);
}
