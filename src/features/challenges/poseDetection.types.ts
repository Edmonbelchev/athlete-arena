import type { ExerciseType } from '@/constants/challenges';

/** Push-up pose phases - for future MediaPipe / ML Kit integration. */
export type PushUpPhase = 'UP' | 'DESCENDING' | 'DOWN' | 'ASCENDING';

/** Squat pose phases - for future MediaPipe / ML Kit integration. */
export type SquatPhase = 'STANDING' | 'DESCENDING' | 'BOTTOM' | 'ASCENDING';

/** Burpee pose phases - compound squat + plank + jump. */
export type BurpeePhase = 'STANDING' | 'DROP' | 'PLANK' | 'JUMP';

export type ExercisePhase = PushUpPhase | SquatPhase | BurpeePhase;

export interface PoseFrame {
  timestamp: number;
  /** Normalized landmark coordinates - shape depends on detector implementation. */
  landmarks: unknown;
}

export interface PoseDetectorCallbacks {
  onRepDetected: () => void;
  onPhaseChange?: (phase: ExercisePhase) => void;
}

/** Contract for a future pose-based rep counter implementation. */
export interface PoseDetector {
  exerciseType: ExerciseType;
  start: () => void;
  stop: () => void;
  processFrame: (frame: PoseFrame) => void;
}
