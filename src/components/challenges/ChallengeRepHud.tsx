import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { formatHoldSeconds, isHoldExercise, type ExerciseType } from '@/constants/challenges';
import { formatRaceTime, formatRaceTimeLimit } from '@/constants/friendChallenges';
import { Radius, Spacing } from '@/constants/theme';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';
import { useRepFeedback } from '@/hooks/use-rep-feedback';
import { useTheme } from '@/hooks/use-theme';
import { useWorkoutLayout } from '@/hooks/use-workout-layout';

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
  /** Reps, or seconds held for hold exercises. */
  currentReps: number;
  targetReps: number;
  exerciseType?: ExerciseType;
  completed?: boolean;
  raceTimer?: ChallengeRepHudRaceTimer | null;
}

export function ChallengeRepHud({
  currentReps,
  targetReps,
  exerciseType,
  completed = false,
  raceTimer = null,
}: ChallengeRepHudProps) {
  const isHold = isHoldExercise(exerciseType);
  // Holds tick every second; give feedback every 10 seconds instead.
  const feedbackCount = isHold ? Math.floor(currentReps / 10) : currentReps;
  const theme = useTheme();
  const { preferences } = useUserSettings();
  const { isLandscape } = useWorkoutLayout();
  const prevRepsRef = useRef(feedbackCount);
  const countScale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  useRepFeedback(feedbackCount, {
    enabled: !completed,
    soundEnabled: preferences.repSoundEnabled,
  });

  useEffect(() => {
    if (completed || feedbackCount <= prevRepsRef.current) {
      prevRepsRef.current = feedbackCount;
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

    prevRepsRef.current = feedbackCount;
  }, [completed, countScale, feedbackCount, flashOpacity, ringOpacity, ringScale]);

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
      <Animated.View style={StyleSheet.flatten([styles.hud, isLandscape ? styles.hudCompact : null, hudStyle])}>
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
        <Text style={StyleSheet.flatten([styles.label, { color: 'rgba(255,255,255,0.82)' }])}>
          {isHold ? 'HOLD' : 'REPS'}
        </Text>
        <Text
          style={StyleSheet.flatten([
            styles.count,
            isLandscape ? styles.countCompact : null,
            { color: completed ? theme.success : '#FFFFFF' },
          ])}>
          {isHold ? formatHoldSeconds(currentReps) : currentReps}
          <Text style={StyleSheet.flatten([styles.target, isLandscape ? styles.targetCompact : null])}> / {isHold ? formatHoldSeconds(targetReps) : targetReps}</Text>
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
  /** Landscape: the camera is short, so the HUD shrinks to keep the body visible. */
  hudCompact: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: 0,
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
  countCompact: {
    fontSize: 30,
    lineHeight: 34,
  },
  target: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.75)',
  },
  targetCompact: {
    fontSize: 19,
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
