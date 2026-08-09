import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { EmoteDisplay } from '@/components/shop/EmoteDisplay';
import { formatXpAndCoins } from '@/constants/coins';
import { formatRaceTime } from '@/constants/friendChallenges';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FriendChallengeCompleteVariant = 'finished' | 'winner' | 'lost' | 'tie';

const NORMAL_CONFETTI_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#818CF8', '#34D399'] as const;
const WINNER_CONFETTI_COLORS = ['#F59E0B', '#FBBF24', '#10B981', '#6366F1', '#F97316', '#34D399'] as const;

interface FriendChallengeCompleteOverlayProps {
  variant: FriendChallengeCompleteVariant;
  raceTimeSeconds: number | null;
  opponentName: string;
  opponentTimeSeconds: number | null;
  xp: number;
  coins: number;
  emote: string | null | undefined;
}

function ConfettiPiece({
  index,
  variant,
}: {
  index: number;
  variant: FriendChallengeCompleteVariant;
}) {
  const colors = variant === 'winner' ? WINNER_CONFETTI_COLORS : NORMAL_CONFETTI_COLORS;
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  const left = `${6 + ((index * 43) % 88)}%` as `${number}%`;
  const color = colors[index % colors.length];
  const size = variant === 'winner' ? 7 + (index % 3) * 2 : 6 + (index % 3) * 2;
  const delay = 60 + index * 40;
  const fallDistance = variant === 'winner' ? 160 + (index % 5) * 28 : 130 + (index % 4) * 22;

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 180 }));
    translateY.value = withDelay(
      delay,
      withTiming(fallDistance, { duration: 950, easing: Easing.out(Easing.cubic) }),
    );
    translateX.value = withDelay(
      delay,
      withTiming((index % 2 === 0 ? -1 : 1) * (14 + (index % 5) * 9), {
        duration: 950,
        easing: Easing.out(Easing.quad),
      }),
    );
    rotate.value = withDelay(
      delay,
      withTiming(index % 2 === 0 ? 240 : -240, { duration: 950, easing: Easing.out(Easing.quad) }),
    );
  }, [delay, fallDistance, index, opacity, rotate, translateX, translateY]);

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

function PulsingRing({ accentColor }: { accentColor: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.14, { duration: 700, easing: Easing.out(Easing.quad) }),
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
      style={StyleSheet.flatten([styles.pulseRing, ringStyle, { borderColor: accentColor }])}
    />
  );
}

function getOverlayCopy(
  variant: FriendChallengeCompleteVariant,
  raceTimeSeconds: number | null,
  opponentName: string,
  opponentTimeSeconds: number | null,
): { eyebrow: string; title: string; subtitle: string | null } {
  const myTimeLabel = raceTimeSeconds !== null ? formatRaceTime(raceTimeSeconds) : '--:--';
  const opponentTimeLabel =
    opponentTimeSeconds !== null ? formatRaceTime(opponentTimeSeconds) : '--:--';

  switch (variant) {
    case 'finished':
      return {
        eyebrow: 'RACE FINISHED',
        title: myTimeLabel,
        subtitle: `Waiting for ${opponentName} to finish…`,
      };
    case 'winner':
      return {
        eyebrow: 'YOU WON THE RACE',
        title: myTimeLabel,
        subtitle: `You ${myTimeLabel} · ${opponentName} ${opponentTimeLabel}`,
      };
    case 'lost':
      return {
        eyebrow: 'RACE COMPLETE',
        title: myTimeLabel,
        subtitle: `${opponentName} won · You ${myTimeLabel} · ${opponentName} ${opponentTimeLabel}`,
      };
    case 'tie':
      return {
        eyebrow: 'TIE RACE',
        title: myTimeLabel,
        subtitle: `Both finished in ${myTimeLabel}`,
      };
  }
}

export function FriendChallengeCompleteOverlay({
  variant,
  raceTimeSeconds,
  opponentName,
  opponentTimeSeconds,
  xp,
  coins,
  emote,
}: FriendChallengeCompleteOverlayProps) {
  const theme = useTheme();
  const copy = getOverlayCopy(variant, raceTimeSeconds, opponentName, opponentTimeSeconds);
  const confettiCount = variant === 'winner' ? 20 : 12;
  const accentColor =
    variant === 'winner' ? theme.streak : variant === 'lost' ? theme.primary : theme.success;
  const iconBackground =
    variant === 'winner' ? theme.streak : variant === 'lost' ? theme.primary : theme.success;
  const showEmote = variant === 'winner' || variant === 'finished' || variant === 'tie';
  const rewardLabel =
    coins > 0 ? `${formatXpAndCoins(xp, coins)} earned` : xp > 0 ? `+${xp} XP earned` : null;

  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.overlay} pointerEvents="none">
      <View style={StyleSheet.flatten([styles.backdrop, { backgroundColor: `${theme.background}CC` }])} />

      <View style={styles.confettiLayer}>
        {Array.from({ length: confettiCount }, (_, index) => (
          <ConfettiPiece key={index} index={index} variant={variant} />
        ))}
      </View>

      <View style={styles.content}>
        <Animated.View entering={ZoomIn.springify().damping(14).delay(120)} style={styles.iconStack}>
          <PulsingRing accentColor={accentColor} />
          <View
            style={StyleSheet.flatten([
              styles.iconCircle,
              { backgroundColor: iconBackground, borderColor: theme.background },
            ])}>
            <Text style={[styles.iconGlyph, variant === 'winner' && styles.iconGlyphTrophy]}>
              {variant === 'winner' ? '🏆' : '✓'}
            </Text>
          </View>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.springify().damping(16).delay(220)}
          style={StyleSheet.flatten([styles.eyebrow, { color: theme.textSecondary }])}>
          {copy.eyebrow}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.springify().damping(16).delay(300)}
          style={StyleSheet.flatten([styles.title, { color: theme.text }])}>
          {copy.title}
        </Animated.Text>

        {showEmote ? (
          <Animated.View entering={FadeInUp.springify().damping(16).delay(380)} style={styles.emoteWrap}>
            <EmoteDisplay emoji={emote} />
          </Animated.View>
        ) : null}

        {rewardLabel ? (
          <Animated.Text
            entering={FadeInUp.springify().damping(16).delay(440)}
            style={StyleSheet.flatten([styles.reward, { color: theme.xp }])}>
            {rewardLabel}
          </Animated.Text>
        ) : null}

        {copy.subtitle ? (
          <Animated.Text
            entering={FadeInUp.springify().damping(16).delay(520)}
            style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
            {copy.subtitle}
          </Animated.Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  confetti: {
    position: 'absolute',
    top: '12%',
  },
  content: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
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
  iconGlyph: {
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 42,
  },
  iconGlyphTrophy: {
    fontSize: 34,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  emoteWrap: {
    minHeight: 44,
    justifyContent: 'center',
  },
  reward: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
});
