import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { getSegmentShortLabel, SPIN_RARITY_COLORS } from '@/constants/spinWheel';
import { useTheme } from '@/hooks/use-theme';
import type { SpinSegment } from '@/types/spin';

const SPIN_DURATION_MS = 4200;
const FULL_TURNS = 5;

export interface SpinTarget {
  index: number;
  /** Changing this re-triggers the animation, even for the same index. */
  nonce: number;
}

interface SpinWheelProps {
  segments: SpinSegment[];
  size?: number;
  target: SpinTarget | null;
  onSpinEnd?: () => void;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDegrees: number) {
  const angleRadians = ((angleDegrees - 90) * Math.PI) / 180;

  return {
    x: cx + radius * Math.cos(angleRadians),
    y: cy + radius * Math.sin(angleRadians),
  };
}

function describeSegment(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

export function SpinWheel({ segments, size = 280, target, onSpinEnd }: SpinWheelProps) {
  const theme = useTheme();
  const rotation = useSharedValue(0);

  const center = size / 2;
  const radius = center - 6;
  const step = segments.length > 0 ? 360 / segments.length : 360;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  useEffect(() => {
    if (!target || segments.length === 0) {
      return;
    }

    // Bring the middle of the winning segment under the pointer at 12 o'clock.
    const segmentCenter = (target.index + 0.5) * step;
    const desired = (360 - (segmentCenter % 360)) % 360;
    const current = ((rotation.value % 360) + 360) % 360;
    const delta = (desired - current + 360) % 360;

    rotation.value = withTiming(
      rotation.value + FULL_TURNS * 360 + delta,
      { duration: SPIN_DURATION_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished && onSpinEnd) {
          runOnJS(onSpinEnd)();
        }
      },
    );
    // Only re-run when a new spin is requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.nonce]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={animatedStyle}>
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={radius} fill={theme.backgroundSelected} />

          {segments.map((segment, index) => (
            <Path
              key={segment.rewardId}
              d={describeSegment(center, center, radius, index * step, (index + 1) * step)}
              fill={SPIN_RARITY_COLORS[segment.rarity]}
              stroke={theme.backgroundElement}
              strokeWidth={2}
            />
          ))}

          {segments.map((segment, index) => {
            const labelAngle = index * step + step / 2;
            const labelPoint = polarToCartesian(center, center, radius * 0.64, labelAngle);

            return (
              <SvgText
                key={`${segment.rewardId}-label`}
                x={labelPoint.x}
                y={labelPoint.y}
                fill="#FFFFFF"
                fontSize={segment.grantsMultiplier ? 22 : 20}
                fontWeight="900"
                textAnchor="middle"
                alignmentBaseline="middle"
                transform={`rotate(${labelAngle}, ${labelPoint.x}, ${labelPoint.y})`}>
                {getSegmentShortLabel(segment)}
              </SvgText>
            );
          })}

          <Circle
            cx={center}
            cy={center}
            r={radius * 0.16}
            fill={theme.backgroundElement}
            stroke={theme.border}
            strokeWidth={2}
          />
        </Svg>
      </Animated.View>

      <View
        pointerEvents="none"
        style={[
          styles.pointer,
          { borderTopColor: theme.text },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  pointer: {
    position: 'absolute',
    top: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
