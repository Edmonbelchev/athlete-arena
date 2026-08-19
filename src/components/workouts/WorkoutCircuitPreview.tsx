import { StyleSheet, Text, View } from 'react-native';

import { formatExerciseLabel } from '@/constants/challenges';
import { getCustomWorkoutTypeDefinition } from '@/constants/customWorkouts';
import { Radius, Spacing } from '@/constants/theme';
import type { CustomWorkoutExercise, CustomWorkoutType } from '@/types/customWorkouts';
import { useTheme } from '@/hooks/use-theme';

interface WorkoutCircuitPreviewProps {
  workoutType: CustomWorkoutType;
  exercises: CustomWorkoutExercise[];
}

export function WorkoutCircuitPreview({ workoutType, exercises }: WorkoutCircuitPreviewProps) {
  const theme = useTheme();
  const typeDefinition = getCustomWorkoutTypeDefinition(workoutType);

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
