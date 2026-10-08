import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { previewWorkoutSessionXpRange } from '@/features/workouts/workoutXp';
import { useTheme } from '@/hooks/use-theme';
import type { CustomWorkoutExercise, CustomWorkoutType } from '@/types/customWorkouts';

interface WorkoutXpPreviewCardProps {
  workoutType: CustomWorkoutType;
  exercises: CustomWorkoutExercise[];
  timeLimitSeconds: number;
}

export function WorkoutXpPreviewCard({
  workoutType,
  exercises,
  timeLimitSeconds,
}: WorkoutXpPreviewCardProps) {
  const theme = useTheme();

  const preview = previewWorkoutSessionXpRange(workoutType, exercises, timeLimitSeconds);

  if (!preview || preview.maxXp <= 0) {
    return null;
  }

  const rangeLabel =
    preview.minXp === preview.maxXp
      ? `${preview.maxXp} XP`
      : `${preview.minXp}–${preview.maxXp} XP`;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>XP reward</Text>
      <Text style={[styles.lead, { color: theme.textSecondary }]}>{preview.hint}</Text>
      <Text style={[styles.range, { color: theme.xp }]}>{rangeLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  lead: {
    fontSize: 14,
    lineHeight: 20,
  },
  range: {
    fontSize: 22,
    fontWeight: '900',
  },
});
