import { StyleSheet, Text, View } from 'react-native';

import { formatExerciseLabel } from '@/constants/challenges';
import { getCustomWorkoutTypeDefinition } from '@/constants/customWorkouts';
import { Radius, Spacing } from '@/constants/theme';
import {
  expandLadderSteps,
  expandRoundsSteps,
  formatRepScheme,
  isLadderForTimeStructure,
  isRoundsForTimeStructure,
} from '@/features/workouts/forTimeStructure';
import type {
  CustomWorkoutExercise,
  CustomWorkoutType,
  ForTimeStructureConfig,
} from '@/types/customWorkouts';
import { useTheme } from '@/hooks/use-theme';

interface WorkoutCircuitPreviewProps {
  workoutType: CustomWorkoutType;
  exercises: CustomWorkoutExercise[];
  structureConfig?: ForTimeStructureConfig | null;
}

export function WorkoutCircuitPreview({
  workoutType,
  exercises,
  structureConfig = null,
}: WorkoutCircuitPreviewProps) {
  const theme = useTheme();
  const typeDefinition = getCustomWorkoutTypeDefinition(workoutType);
  const isLadder = workoutType === 'for_time' && isLadderForTimeStructure(structureConfig);
  const isRounds = workoutType === 'for_time' && isRoundsForTimeStructure(structureConfig);

  if (isLadder) {
    const repScheme = structureConfig.repScheme;

    return (
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>{typeDefinition.label} · Rep ladder</Text>
        <Text style={[styles.ladderScheme, { color: theme.primary }]}>{formatRepScheme(repScheme)} reps</Text>
        {repScheme.map((tierReps, tierIndex) => (
          <View
            key={`tier-${tierReps}-${tierIndex}`}
            style={[
              styles.tierBlock,
              tierIndex < repScheme.length - 1 ? styles.rowBorder : null,
              { borderBottomColor: theme.border },
            ]}>
            <Text style={[styles.tierLabel, { color: theme.textSecondary }]}>{tierReps} reps</Text>
            {exercises.map((exercise) => (
              <Text key={`${tierIndex}-${exercise.exerciseType}`} style={[styles.exercise, { color: theme.text }]}>
                {tierReps} {formatExerciseLabel(exercise.exerciseType)}
              </Text>
            ))}
          </View>
        ))}
        <Text style={[styles.footer, { color: theme.textSecondary }]}>
          {repScheme.length} tiers · {expandLadderSteps(exercises, repScheme).length} total steps
        </Text>
      </View>
    );
  }

  if (isRounds) {
    const { rounds } = structureConfig;

    return (
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>{typeDefinition.label} · Rounds circuit</Text>
        <Text style={[styles.ladderScheme, { color: theme.primary }]}>
          {rounds} {rounds === 1 ? 'round' : 'rounds'}
        </Text>
        <View style={[styles.tierBlock, { borderBottomColor: theme.border }]}>
          <Text style={[styles.tierLabel, { color: theme.textSecondary }]}>Each round</Text>
          {exercises.map((exercise) => (
            <Text key={exercise.exerciseType} style={[styles.exercise, { color: theme.text }]}>
              {exercise.targetReps} {formatExerciseLabel(exercise.exerciseType)}
            </Text>
          ))}
        </View>
        <Text style={[styles.footer, { color: theme.textSecondary }]}>
          {rounds} rounds · {expandRoundsSteps(exercises, rounds).length} total steps
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>{typeDefinition.label} workout</Text>
      {exercises.map((exercise, index) => (
        <View
          key={`${exercise.exerciseType}-${index}`}
          style={[styles.row, index < exercises.length - 1 ? styles.rowBorder : null, { borderBottomColor: theme.border }]}>
          <Text style={[styles.step, { color: theme.primary }]}>{index + 1}</Text>
          <Text style={[styles.exercise, { color: theme.text }]}>
            {exercise.targetReps} {formatExerciseLabel(exercise.exerciseType)}
          </Text>
        </View>
      ))}
      <Text style={[styles.footer, { color: theme.textSecondary }]}>{typeDefinition.description}</Text>
    </View>
  );
}

/** @deprecated Use WorkoutCircuitPreview */
export const AmrapCircuitPreview = WorkoutCircuitPreview;

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  ladderScheme: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  tierBlock: {
    gap: Spacing.half,
    paddingBottom: Spacing.two,
  },
  tierLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.half,
  },
  step: {
    width: 24,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  exercise: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
