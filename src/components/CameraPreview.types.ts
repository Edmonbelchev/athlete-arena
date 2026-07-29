import type { PoseLandmark } from '@/features/challenges/pose/landmarks';

export type CameraFacing = 'front' | 'back';

export interface CameraPreviewProps {
  active?: boolean;
  onCameraReady?: () => void;
  /** Called each frame when pose landmarks are detected (web + dev build). */
  onLandmarksDetected?: (landmarks: PoseLandmark[]) => void;
}
