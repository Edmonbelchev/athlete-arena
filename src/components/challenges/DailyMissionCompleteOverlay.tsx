import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { EmoteDisplay } from '@/components/shop/EmoteDisplay';
import { formatXpAndCoins } from '@/constants/coins';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CONFETTI_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#F97316', '#818CF8', '#34D399'] as const;
const CONFETTI_PIECES = 14;

interface DailyMissionCompleteOverlayProps {
  targetReps: number;
  exerciseLabel: string;
  xp: number;
  coins: number;
  emote: string | null | undefined;
}

function ConfettiPiece({ index }: { index: number }) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  const left = `${8 + ((index * 47) % 84)}%` as `${number}%`;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const size = 6 + (index % 3) * 2;
  const delay = 80 + index * 45;

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 180 }));
    translateY.value = withDelay(
      delay,
      withTiming(140 + (index % 4) * 24, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
    translateX.value = withDelay(
      delay,
      withTiming((index % 2 === 0 ? -1 : 1) * (12 + (index % 5) * 8), {
        duration: 900,
        easing: Easing.out(Easing.quad),
      }),
    );
    rotate.value = withDelay(
      delay,
      withTiming(index % 2 === 0 ? 220 : -220, { duration: 900, easing: Easing.out(Easing.quad) }),
    );
  }, [delay, index, opacity, rotate, translateX, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={StyleSheet.flatten([
        styles.confetti,
        style,
        {
          left,
          width: size,
          height: size * 1.6,
          borderRadius: size / 3,
          backgroundColor: color,
        },
      ])}
    />
  );
}

function PulsingRing() {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 700, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 700, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0.2, { duration: 700 }), withTiming(0.55, { duration: 700 })),
      -1,
      false,
    );
  }, [opacity, scale]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={StyleSheet.flatten([
        styles.pulseRing,
        ringStyle,
        { borderColor: theme.success },
      ])}
    />
  );
}

export function DailyMissionCompleteOverlay({
  targetReps,
  exerciseLabel,
  xp,
  coins,
  emote,
}: DailyMissionCompleteOverlayProps) {
  const theme = useTheme();

  return (
    <View style={styles.overlay}>
      <View style={StyleSheet.flatten([styles.backdrop, { backgroundColor: theme.background }])} />

      <View style={styles.confettiLayer} pointerEvents="none">
        {Array.from({ length: CONFETTI_PIECES }, (_, index) => (
          <ConfettiPiece key={index} index={index} />
        ))}
      </View>

      <View style={styles.content}>
        <View style={styles.iconStack}>
          <PulsingRing />
          <View style={StyleSheet.flatten([styles.iconCircle, { backgroundColor: theme.success, borderColor: theme.background }])}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
        </View>

        <Text style={StyleSheet.flatten([styles.eyebrow, { color: theme.textSecondary }])}>
          MISSION COMPLETE
        </Text>

        <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>
          {targetReps} {exerciseLabel}
        </Text>

        <View style={styles.emoteWrap}>
          <EmoteDisplay emoji={emote} />
        </View>

        <Text style={StyleSheet.flatten([styles.reward, { color: theme.xp }])}>
          {formatXpAndCoins(xp, coins)} earned
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 2,
  },
  confetti: {
    position: 'absolute',
    top: '18%',
  },
  content: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    zIndex: 3,
  },
  iconStack: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  pulseRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 42,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  emoteWrap: {
    minHeight: 44,
    justifyContent: 'center',
  },
  reward: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
});
