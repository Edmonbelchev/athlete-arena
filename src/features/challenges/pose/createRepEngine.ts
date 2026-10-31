import type { ExerciseType } from '@/constants/challenges';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';

import { PullUpRepEngine } from './pullUpRepEngine';
import { JumpingJackRepEngine } from './jumpingJackRepEngine';
import { JumpingSquatRepEngine } from './jumpingSquatRepEngine';
import { LungeRepEngine } from './lungeRepEngine';
import { HalfBurpeeRepEngine } from './halfBurpeeRepEngine';
import { BurpeeRepEngine } from './burpeeRepEngine';
import { PlankHoldEngine } from './plankHoldEngine';
import { PushUpRepEngine } from './pushUpRepEngine';
import { SitUpRepEngine } from './sitUpRepEngine';
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

  if (exerciseType === 'jumping_squats') {
    return new JumpingSquatRepEngine();
  }

  if (exerciseType === 'lunges') {
    return new LungeRepEngine();
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

  if (exerciseType === 'half_burpees') {
    return new HalfBurpeeRepEngine();
  }

  if (exerciseType === 'jumping_jacks') {
    return new JumpingJackRepEngine();
  }

  if (exerciseType === 'sit_ups') {
    return new SitUpRepEngine();
  }

  if (exerciseType === 'plank') {
    return new PlankHoldEngine();
  }

  throw new Error(`Unsupported exercise type: ${String(exerciseType)}`);
}
