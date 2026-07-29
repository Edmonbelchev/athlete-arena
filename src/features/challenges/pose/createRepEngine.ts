import type { ExerciseType } from '@/constants/challenges';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';

import type { PoseLandmark } from './landmarks';
import { PushUpRepEngine } from './pushUpRepEngine';
import { SquatRepEngine } from './squatRepEngine';

export interface RepEngine {
  phase: ExercisePhase;
  update: (landmarks: PoseLandmark[]) => boolean;
  reset: () => void;
}

export function createRepEngine(exerciseType: ExerciseType): RepEngine {
  if (exerciseType === 'push_ups') {
    return new PushUpRepEngine();
  }
  return new SquatRepEngine();
}
