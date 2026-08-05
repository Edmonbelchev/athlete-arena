import { memo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
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
}

function isVisible(landmark: PoseLandmark | undefined, minVisibility: number): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= minVisibility);
}

export const PoseSkeletonOverlay = memo(function PoseSkeletonOverlay({
  landmarks,
  visible,
}: PoseSkeletonOverlayProps) {
  const theme = useTheme();
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width !== layout.width || height !== layout.height) {
      setLayout({ width, height });
    }
  }

  if (!visible || !landmarks?.length || layout.width <= 0 || layout.height <= 0) {
    return <View style={styles.overlay} onLayout={handleLayout} pointerEvents="none" />;
  }

  const style = {
    ...DEFAULT_SKELETON_STYLE,
    lineColor: theme.primary,
    minVisibility: POSE_QUALITY.skeletonMinVisibility,
  };

  const { width, height } = layout;

  return (
    <View style={styles.overlay} onLayout={handleLayout} pointerEvents="none">
      <Svg width={width} height={height}>
        {POSE_CONNECTIONS.map(([startIndex, endIndex]) => {
          const start = landmarks[startIndex];
          const end = landmarks[endIndex];

          if (!isVisible(start, style.minVisibility) || !isVisible(end, style.minVisibility)) {
            return null;
          }

          return (
            <Line
              key={`${startIndex}-${endIndex}`}
              x1={start.x * width}
              y1={start.y * height}
              x2={end.x * width}
              y2={end.y * height}
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
              cx={landmark.x * width}
              cy={landmark.y * height}
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
    ...StyleSheet.absoluteFill,
  },
});
