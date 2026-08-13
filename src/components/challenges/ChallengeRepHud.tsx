import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { formatRaceTime, formatRaceTimeLimit } from '@/constants/friendChallenges';
import { Radius, Spacing } from '@/constants/theme';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';
import { useRepFeedback } from '@/hooks/use-rep-feedback';
import { useTheme } from '@/hooks/use-theme';

export type ChallengeRepHudRaceTimer =
  | { kind: 'hint'; message: string }
  | {
      kind: 'running';
      elapsedSeconds: number;
      secondsRemaining: number | null;
      timeLimitSeconds: number | null;
    }
  | { kind: 'expired' };

interface ChallengeRepHudProps {
  currentReps: number;
  targetReps: number;
  completed?: boolean;
  raceTimer?: ChallengeRepHudRaceTimer | null;
}

export function ChallengeRepHud({
  currentReps,
  targetReps,
  completed = false,
  raceTimer = null,
}: ChallengeRepHudProps) {
  const theme = useTheme();
  const { preferences } = useUserSettings();
  const prevRepsRef = useRef(currentReps);
  const countScale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  useRepFeedback(currentReps, {
    enabled: !completed,
    soundEnabled: preferences.repSoundEnabled,
  });

  useEffect(() => {
    if (completed || currentReps <= prevRepsRef.current) {
      prevRepsRef.current = currentReps;
      return;
    }

    countScale.value = withSequence(
      withTiming(1.1, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
    );

    ringScale.value = 1;
    ringOpacity.value = 0.42;
    ringScale.value = withTiming(1.45, { duration: 340, easing: Easing.out(Easing.cubic) });
    ringOpacity.value = withTiming(0, { duration: 340, easing: Easing.out(Easing.quad) });

    flashOpacity.value = withSequence(
      withTiming(0.28, { duration: 70 }),
      withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }),
    );

    prevRepsRef.current = currentReps;
  }, [completed, countScale, currentReps, flashOpacity, ringOpacity, ringScale]);

  const hudStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={StyleSheet.flatten([styles.hud, hudStyle])}>
        <Animated.View
          style={StyleSheet.flatten([
            styles.flash,
            flashStyle,
            { backgroundColor: theme.success },
          ])}
        />
        <Animated.View
          style={StyleSheet.flatten([
            styles.ring,
            ringStyle,
            { borderColor: 'rgba(255,255,255,0.55)' },
          ])}
        />
        <Text style={StyleSheet.flatten([styles.label, { color: 'rgba(255,255,255,0.82)' }])}>REPS</Text>
        <Text
          style={StyleSheet.flatten([
            styles.count,
            { color: completed ? theme.success : '#FFFFFF' },
          ])}>
          {currentReps}
          <Text style={styles.target}> / {targetReps}</Text>
        </Text>
        {raceTimer?.kind === 'hint' ? (
          <Text style={styles.timerHint}>{raceTimer.message}</Text>
        ) : null}
        {raceTimer?.kind === 'running' ? (
          <View style={styles.timerBlock}>
            <View style={styles.timerDivider} />
            <Text style={styles.timerLabel}>TIME</Text>
            <Text style={StyleSheet.flatten([styles.timerValue, { color: theme.streak }])}>
              {formatRaceTime(raceTimer.elapsedSeconds)}
            </Text>
            {raceTimer.timeLimitSeconds ? (
              <Text style={styles.timerMeta}>
                {formatRaceTimeLimit(raceTimer.timeLimitSeconds)} ·{' '}
                {formatRaceTime(raceTimer.secondsRemaining ?? 0)} left
              </Text>
            ) : (
              <Text style={styles.timerMeta}>Fastest to finish wins</Text>
            )}
          </View>
        ) : null}
        {raceTimer?.kind === 'expired' ? (
          <View style={styles.timerBlock}>
            <View style={styles.timerDivider} />
            <Text style={StyleSheet.flatten([styles.timerLabel, { color: theme.danger }])}>TIME CAP</Text>
            <Text style={StyleSheet.flatten([styles.timerValue, { color: theme.danger }])}>Reached</Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    zIndex: 4,
  },
  hud: {
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
    overflow: 'hidden',
  },
  flash: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.md,
  },
  ring: {
    position: 'absolute',
    top: '18%',
    left: Spacing.two,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  count: {
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  target: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.75)',
  },
  timerHint: {
    marginTop: Spacing.half,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
    maxWidth: 148,
  },
  timerBlock: {
    marginTop: Spacing.one,
    gap: 2,
  },
  timerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: Spacing.half,
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.72)',
  },
  timerValue: {
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  timerMeta: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.62)',
  },
});
