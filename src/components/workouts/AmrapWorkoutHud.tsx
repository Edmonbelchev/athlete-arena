import { StyleSheet, Text, View } from 'react-native';

import { formatExerciseCount, formatExerciseLabel, isHoldExercise } from '@/constants/challenges';
import { formatRaceTime } from '@/constants/friendChallenges';
import { RepProgressBar } from '@/components/workouts/RepProgressBar';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CustomWorkoutExercise } from '@/types/customWorkouts';

interface AmrapWorkoutHudProps {
  workoutTypeLabel: string;
  currentExercise: CustomWorkoutExercise;
  currentExerciseReps: number;
  completedRounds: number;
  secondsRemaining: number | null;
  timeLimitSeconds: number;
  timerStarted?: boolean;
  /** Single-exercise AMRAP: max reps until the cap - no rounds, target or progress bar. */
  singleExercise?: boolean;
}

export function AmrapWorkoutHud({
  workoutTypeLabel,
  currentExercise,
  currentExerciseReps,
  completedRounds,
  secondsRemaining,
  timeLimitSeconds,
  timerStarted = true,
  singleExercise = false,
}: AmrapWorkoutHudProps) {
  const theme = useTheme();

  if (singleExercise) {
    return (
      <View style={styles.wrap} pointerEvents="none">
        <View style={styles.topRow}>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>TIME LEFT</Text>
            <Text style={[styles.chipValue, { color: theme.streak }]}>
              {formatRaceTime(timerStarted ? (secondsRemaining ?? 0) : timeLimitSeconds)}
            </Text>
          </View>
        </View>

        <View style={styles.mainHud}>
          <Text style={styles.exerciseLabel}>{formatExerciseLabel(currentExercise.exerciseType, true)}</Text>
          <Text style={styles.repCount}>{formatExerciseCount(currentExercise.exerciseType, currentExerciseReps)}</Text>
          <Text style={styles.meta}>
            {formatRaceTime(timeLimitSeconds)} {workoutTypeLabel} · as many{' '}
            {isHoldExercise(currentExercise.exerciseType) ? 'seconds' : 'reps'} as possible
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.topRow}>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>ROUND</Text>
          <Text style={styles.chipValue}>{completedRounds + 1}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>TIME LEFT</Text>
          <Text style={[styles.chipValue, { color: theme.streak }]}>
            {formatRaceTime(timerStarted ? (secondsRemaining ?? 0) : timeLimitSeconds)}
          </Text>
        </View>
      </View>

      <View style={styles.mainHud}>
        <Text style={styles.exerciseLabel}>{formatExerciseLabel(currentExercise.exerciseType, true)}</Text>
        <Text style={styles.repCount}>
          {formatExerciseCount(currentExercise.exerciseType, currentExerciseReps)}
          <Text style={styles.repTarget}> / {formatExerciseCount(currentExercise.exerciseType, currentExercise.targetReps)}</Text>
        </Text>
        {timerStarted ? (
          <Text style={styles.meta}>
            {formatRaceTime(timeLimitSeconds)} {workoutTypeLabel} · {completedRounds} full round
            {completedRounds === 1 ? '' : 's'} completed
          </Text>
        ) : null}
        <RepProgressBar current={currentExerciseReps} target={currentExercise.targetReps} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 4,
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    flex: 1,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: 2,
  },
  chipLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  chipValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  mainHud: {
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
    overflow: 'hidden',
  },
  exerciseLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  repCount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  repTarget: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.75)',
  },
  meta: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '600',
  },
});
