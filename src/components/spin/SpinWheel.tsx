import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { CoinIcon } from '@/components/ui/CoinIcon';
import { getSegmentShortLabel, SPIN_RARITY_COLORS } from '@/constants/spinWheel';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SpinSegment } from '@/types/spin';

const SPIN_DURATION_MS = 4200;
const FULL_TURNS = 5;
const HUB_SIZE_RATIO = 0.32;

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
        </Svg>

        {segments.map((segment, index) => {
          const labelAngle = index * step + step / 2;
          const labelPoint = polarToCartesian(center, center, radius * 0.64, labelAngle);

          return (
            <View
              key={`${segment.rewardId}-label`}
              pointerEvents="none"
              style={[
                styles.labelAnchor,
                { left: labelPoint.x, top: labelPoint.y },
              ]}>
              <Text
                style={[
                  styles.segmentLabel,
                  segment.grantsMultiplier ? styles.segmentLabelMultiplier : null,
                  { transform: [{ rotate: `${labelAngle}deg` }] },
                ]}>
                {getSegmentShortLabel(segment)}
              </Text>
            </View>
          );
        })}
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
  hub: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  labelAnchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    fontFamily: Fonts.display,
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.6,
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: 'rgba(15, 23, 42, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  segmentLabelMultiplier: {
    fontSize: 22,
    letterSpacing: 0.2,
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
