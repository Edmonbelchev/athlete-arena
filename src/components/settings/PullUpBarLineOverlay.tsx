import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

interface PullUpBarLineOverlayProps {
  /** Normalized y (0 = top, 1 = bottom) of the captured bar line. */
  barLineY: number | null;
  visible: boolean;
  /** Match MediapipeCamera view dimensions used by ViewCoordinator. */
  viewWidth?: number;
  viewHeight?: number;
}

const BAR_COLOR = '#FBBF24';
const BAR_DASH = '10 6';

function sanitizeOverlayDimension(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.round(value);
}

function sanitizeBarLineY(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(1, Math.max(0, value));
}

export function PullUpBarLineOverlay({
  barLineY,
  visible,
  viewWidth = 0,
  viewHeight = 0,
}: PullUpBarLineOverlayProps) {
  const safeBarLineY = sanitizeBarLineY(barLineY);
  const width = sanitizeOverlayDimension(viewWidth);
  const height = sanitizeOverlayDimension(viewHeight);
  const showLine = visible && safeBarLineY !== null && width > 0 && height > 0;
  const lineY = showLine ? safeBarLineY! * height : 0;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {showLine ? (
        <>
          <Svg width={width} height={height}>
            <Line
              x1={0}
              y1={lineY}
              x2={width}
              y2={lineY}
              stroke={BAR_COLOR}
              strokeWidth={3}
              strokeDasharray={BAR_DASH}
              strokeLinecap="round"
            />
          </Svg>
          <View style={StyleSheet.flatten([styles.label, { top: Math.max(lineY - 22, 8) }])}>
            <Text style={styles.labelText}>BAR</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  label: {
    position: 'absolute',
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  labelText: {
    color: BAR_COLOR,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
