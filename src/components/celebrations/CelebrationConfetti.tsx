import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const CONFETTI_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#F97316', '#818CF8', '#34D399'] as const;

function ConfettiPiece({ index, startDelay }: { index: number; startDelay: number }) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  const left = `${6 + ((index * 47) % 88)}%` as `${number}%`;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const size = 6 + (index % 3) * 2;
  const delay = startDelay + index * 40;

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSequence(withTiming(1, { duration: 160 }), withDelay(800, withTiming(0, { duration: 400 }))),
    );
    translateY.value = withDelay(
      delay,
      withTiming(220 + (index % 4) * 40, { duration: 1300, easing: Easing.out(Easing.cubic) }),
    );
    translateX.value = withDelay(
      delay,
      withTiming((index % 2 === 0 ? -1 : 1) * (14 + (index % 5) * 9), {
        duration: 1300,
        easing: Easing.out(Easing.quad),
      }),
    );
    rotate.value = withDelay(
      delay,
      withTiming(index % 2 === 0 ? 260 : -260, { duration: 1300, easing: Easing.out(Easing.quad) }),
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
      style={[styles.piece, style, { left, width: size, height: size * 1.6, borderRadius: size / 3, backgroundColor: color }]}
    />
  );
}

/** One burst of falling confetti; change `burstKey` to fire again. */
export function CelebrationConfetti({
  burstKey = 0,
  pieces = 18,
  startDelay = 0,
}: {
  burstKey?: number | string;
  pieces?: number;
  startDelay?: number;
}) {
  return (
    <Animated.View key={burstKey} style={styles.layer} pointerEvents="none">
      {Array.from({ length: pieces }, (_, index) => (
        <ConfettiPiece key={index} index={index} startDelay={startDelay} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  piece: {
    position: 'absolute',
    top: '8%',
  },
});
