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

import { CoinIcon } from '@/components/ui/CoinIcon';
import { getSegmentShortLabel, SPIN_RARITY_COLORS } from '@/constants/spinWheel';
import { useTheme } from '@/hooks/use-theme';
import type { SpinSegment } from '@/types/spin';

const SPIN_DURATION_MS = 4200;
const FULL_TURNS = 5;
const HUB_SIZE_RATIO = 0.32;
/** Width of the light-studded frame around the wheel. */
const RIM_WIDTH = 14;
const RIM_BULBS = 16;

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
  const radius = center - RIM_WIDTH;
  const hubSize = radius * HUB_SIZE_RATIO;
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
      {/* Static frame with marquee bulbs; the wheel turns inside it. */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={center - 1} fill="#1E293B" />
        <Circle cx={center} cy={center} r={center - 1} stroke={theme.streak} strokeWidth={2} fill="none" />
        {Array.from({ length: RIM_BULBS }, (_, index) => {
          const point = polarToCartesian(center, center, center - RIM_WIDTH / 2, (index * 360) / RIM_BULBS);
          return (
            <Circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={3}
              fill={index % 2 === 0 ? '#FDE68A' : '#FFFFFF'}
            />
          );
        })}
      </Svg>
      <Animated.View style={[animatedStyle, { width: size, height: size }]}>
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
        </Svg>
      </Animated.View>

      <View
        pointerEvents="none"
        style={[
          styles.hub,
          {
            width: hubSize,
            height: hubSize,
            borderRadius: hubSize / 2,
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
          },
        ]}>
        <CoinIcon size={hubSize * 0.52} />
      </View>

      <View pointerEvents="none" style={styles.pointer}>
        <Svg width={32} height={48} viewBox="0 0 32 48">
          <Path
            d="M16 46.5 L2.5 15 A13.5 13.5 0 1 1 29.5 15 Z"
            fill={theme.streak}
            stroke="#FFFFFF"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Circle cx={16} cy={15} r={4.5} fill="#FFFFFF" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  hub: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  pointer: {
    position: 'absolute',
    // Keeps the tip on the wheel's rim, with the head above the frame.
    top: -23,
  },
});
