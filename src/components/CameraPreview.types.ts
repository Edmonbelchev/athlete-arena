import type { ExerciseType } from '@/constants/challenges';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';

export type CameraFacing = 'front' | 'back';

export interface CameraPreviewProps {
  active?: boolean;
  onCameraReady?: () => void;
  /** Called each frame when pose landmarks are detected (web + dev build). */
  onLandmarksDetected?: (landmarks: PoseLandmark[]) => void;
  /** Pull-up bar reference line (normalized y) shown during pull-up challenges. */
  pullUpBarLineY?: number | null;
  /** Exercise being performed — drives rep-cycle progress bar. */
  exerciseType?: ExerciseType;
  /** Current pose phase from the rep engine. */
  repPhase?: ExercisePhase;
  /** Whether pose tracking is ready to count reps. */
  repTrackingReady?: boolean;
}
