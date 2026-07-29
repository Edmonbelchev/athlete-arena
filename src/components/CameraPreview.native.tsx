import type { CameraPreviewProps } from '@/components/CameraPreview.types';
import { ExpoGoCameraPreview } from '@/components/CameraPreview.expo';
import { isExpoGo } from '@/lib/runtime';

type VisionPreviewComponent = typeof import('@/components/CameraPreview.vision').VisionCameraPreview;

function getVisionPreview(): VisionPreviewComponent {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/components/CameraPreview.vision').VisionCameraPreview;
}

/**
 * Native camera preview - Vision Camera + MediaPipe in dev builds, expo-camera in Expo Go.
 */
export function CameraPreview(props: CameraPreviewProps) {
  if (isExpoGo()) {
    return <ExpoGoCameraPreview {...props} />;
  }

  const VisionCameraPreview = getVisionPreview();
  return <VisionCameraPreview {...props} />;
}

export type { CameraPreviewProps } from '@/components/CameraPreview.types';
