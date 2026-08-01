import type { ExerciseType } from '@/constants/challenges';
import {
  DIP_THRESHOLDS,
  PULL_UP_THRESHOLDS,
  PUSH_UP_THRESHOLDS,
} from '@/constants/poseDetection';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';

import { ElbowRepEngine } from './elbowRepEngine';
import type { PoseLandmark } from './landmarks';
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
  minHoldFrames: number;
}): AngleThresholdConfig {
  return {
    high: thresholds.upAngle,
    low: thresholds.downAngle,
    hysteresis: thresholds.hysteresis,
    minHoldFrames: thresholds.minHoldFrames,
  };
}

const ELBOW_THRESHOLDS: Record<'push_ups' | 'pull_ups' | 'dips', AngleThresholdConfig> = {
  push_ups: toElbowThresholds(PUSH_UP_THRESHOLDS),
  pull_ups: toElbowThresholds(PULL_UP_THRESHOLDS),
  dips: toElbowThresholds(DIP_THRESHOLDS),
};

export function createRepEngine(exerciseType: ExerciseType): RepEngine {
  if (exerciseType === 'squats') {
    return new SquatRepEngine();
  }

  return new ElbowRepEngine(ELBOW_THRESHOLDS[exerciseType]);
}
