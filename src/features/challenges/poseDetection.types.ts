import type { ExerciseType } from '@/constants/challenges';

/** Push-up pose phases - for future MediaPipe / ML Kit integration. */
export type PushUpPhase = 'UP' | 'DESCENDING' | 'DOWN' | 'ASCENDING';

/** Squat pose phases - for future MediaPipe / ML Kit integration. */
export type SquatPhase = 'STANDING' | 'DESCENDING' | 'BOTTOM' | 'ASCENDING';

/** Burpee pose phases - compound squat + plank + jump. */
export type BurpeePhase = 'STANDING' | 'DROP' | 'FLOOR' | 'JUMP';

/** Jumping jack pose phases - closed stance ↔ open stance. */
export type JumpingJackPhase = 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING';

/** Jump squat pose phases - squat depth then explosive jump. */
export type JumpingSquatPhase = SquatPhase | 'JUMP';

/** Lunge pose phases - same stand → depth → stand cycle as squats. */
export type LungePhase = SquatPhase;

/** Sit-up phases - lying back → torso up → back down. */
export type SitUpPhase = 'LYING' | 'RISING' | 'TOP' | 'LOWERING';

/** Plank hold phases - getting into position → timer running → form broken (timer paused). */
export type PlankPhase = 'SETUP' | 'HOLDING' | 'PAUSED';

export type ExercisePhase =
  | PushUpPhase
  | SquatPhase
  | BurpeePhase
  | JumpingJackPhase
  | JumpingSquatPhase
  | SitUpPhase
  | PlankPhase;

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
