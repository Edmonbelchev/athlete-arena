import type { ExerciseType } from '@/constants/challenges';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';

import { PullUpRepEngine } from './pullUpRepEngine';
import { BurpeeRepEngine } from './burpeeRepEngine';
import { PushUpRepEngine } from './pushUpRepEngine';
import type { PoseLandmark } from './landmarks';
import { SquatRepEngine } from './squatRepEngine';

export interface RepEngine {
  phase: ExercisePhase;
  update: (landmarks: PoseLandmark[]) => boolean;
  reset: () => void;
}

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

  if (exerciseType === 'burpees') {
    return new BurpeeRepEngine();
  }

  throw new Error(`Unsupported exercise type: ${String(exerciseType)}`);
}
