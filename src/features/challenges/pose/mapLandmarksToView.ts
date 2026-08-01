import type { Landmark, ViewCoordinator } from 'react-native-mediapipe-posedetection';

import type { PoseLandmark } from '@/features/challenges/pose/landmarks';

export interface PoseFrameInfo {
  inputImageWidth: number;
  inputImageHeight: number;
}

/** Map detector landmarks into view-normalized coordinates for skeleton overlay. */
export function mapLandmarksToViewNormalized(
  landmarks: Landmark[],
  frameInfo: PoseFrameInfo,
  viewCoordinator: ViewCoordinator,
  viewWidth: number,
  viewHeight: number,
): PoseLandmark[] {
  if (viewWidth <= 0 || viewHeight <= 0) {
    return [];
  }

  const frame = viewCoordinator.getFrameDims({
    inputImageWidth: frameInfo.inputImageWidth,
    inputImageHeight: frameInfo.inputImageHeight,
    inferenceTime: 0,
  });

  return landmarks.map((landmark) => {
    const point = viewCoordinator.convertPoint(frame, { x: landmark.x, y: landmark.y });

    return {
      x: point.x / viewWidth,
      y: point.y / viewHeight,
      z: landmark.z,
      visibility: landmark.visibility ?? landmark.presence,
    };
  });
}
