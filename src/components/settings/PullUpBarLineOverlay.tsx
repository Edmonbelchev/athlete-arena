import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

interface PullUpBarLineOverlayProps {
  /** Normalized y (0 = top, 1 = bottom) of the captured bar line. */
  barLineY: number | null;
  visible: boolean;
}

const BAR_COLOR = '#FBBF24';
const BAR_DASH = '10 6';

export function PullUpBarLineOverlay({ barLineY, visible }: PullUpBarLineOverlayProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width !== layout.width || height !== layout.height) {
      setLayout({ width, height });
    }
  }

  const showLine =
    visible && barLineY !== null && layout.width > 0 && layout.height > 0;
  const lineY = showLine ? barLineY * layout.height : 0;

  return (
    <View style={styles.overlay} onLayout={handleLayout} pointerEvents="none">
      {showLine ? (
        <>
          <Svg width={layout.width} height={layout.height}>
            <Line
              x1={0}
              y1={lineY}
              x2={layout.width}
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
