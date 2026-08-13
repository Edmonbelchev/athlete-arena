import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { POSE_QUALITY } from '@/constants/poseDetection';
import {
  DEFAULT_SKELETON_STYLE,
  POSE_CONNECTIONS,
} from '@/features/challenges/pose/drawPoseSkeleton';
import { isLandmarkDrawable, type PoseLandmark } from '@/features/challenges/pose/landmarks';
import { useTheme } from '@/hooks/use-theme';

interface PoseSkeletonOverlayProps {
  landmarks: PoseLandmark[] | null;
  visible: boolean;
  /** Match MediapipeCamera view dimensions used by ViewCoordinator. */
  viewWidth?: number;
  viewHeight?: number;
}

function isVisible(landmark: PoseLandmark | undefined, minVisibility: number): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= minVisibility);
}

export const PoseSkeletonOverlay = memo(function PoseSkeletonOverlay({
  landmarks,
  visible,
  viewWidth = 0,
  viewHeight = 0,
}: PoseSkeletonOverlayProps) {
  const theme = useTheme();

  if (!visible || !landmarks?.length || viewWidth <= 0 || viewHeight <= 0) {
    return <View style={styles.overlay} pointerEvents="none" />;
  }

  const style = {
    ...DEFAULT_SKELETON_STYLE,
    lineColor: theme.primary,
    minVisibility: POSE_QUALITY.skeletonMinVisibility,
  };

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Svg width={viewWidth} height={viewHeight}>
        {POSE_CONNECTIONS.map(([startIndex, endIndex]) => {
          const start = landmarks[startIndex];
          const end = landmarks[endIndex];

          if (!isVisible(start, style.minVisibility) || !isVisible(end, style.minVisibility)) {
            return null;
          }

          return (
            <Line
              key={`${startIndex}-${endIndex}`}
              x1={start.x * viewWidth}
              y1={start.y * viewHeight}
              x2={end.x * viewWidth}
              y2={end.y * viewHeight}
              stroke={style.lineColor}
              strokeWidth={style.lineWidth}
              strokeLinecap="round"
            />
          );
        })}

        {landmarks.map((landmark, index) => {
          if (
            !isLandmarkDrawable(landmark) ||
            (landmark.visibility ?? 1) < style.minVisibility
          ) {
            return null;
          }

          return (
            <Circle
              key={index}
              cx={landmark.x * viewWidth}
              cy={landmark.y * viewHeight}
              r={style.jointRadius}
              fill={style.jointColor}
            />
          );
        })}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
