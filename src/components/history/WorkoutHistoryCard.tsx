import { StyleSheet, Text, View } from 'react-native';

import { getCustomWorkoutTypeLabel } from '@/constants/customWorkouts';
import { formatRaceTime } from '@/constants/friendChallenges';
import { Radius, Spacing } from '@/constants/theme';
import { formatWorkoutSessionScore } from '@/types/catalogWorkouts';
import type { SoloWorkoutHistoryEntry } from '@/types/activityHistory';
import { useTheme } from '@/hooks/use-theme';

interface WorkoutHistoryCardProps {
  entry: SoloWorkoutHistoryEntry;
}

function formatHistoryDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function WorkoutHistoryCard({ entry }: WorkoutHistoryCardProps) {
  const theme = useTheme();
  const scoreLabel = formatWorkoutSessionScore({
    sessionId: entry.entryId,
    title: entry.workoutTitle,
    workoutType: entry.workoutType,
    timeLimitSeconds: entry.timeLimitSeconds,
    completedRounds: entry.completedRounds,
    totalReps: entry.totalReps,
    elapsedSeconds: entry.elapsedSeconds,
    exerciseBreakdown: [],
    startedAt: entry.resultAt,
    completedAt: entry.resultAt,
  });

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.kind, { color: theme.textSecondary }]}>Solo workout</Text>
        <Text style={[styles.date, { color: theme.textSecondary }]}>{formatHistoryDate(entry.resultAt)}</Text>
      </View>

      <Text style={[styles.title, { color: theme.text }]}>{entry.workoutTitle}</Text>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>
        {getCustomWorkoutTypeLabel(entry.workoutType)}
        {entry.workoutType === 'for_time' && entry.elapsedSeconds !== null
          ? ` · ${formatRaceTime(entry.elapsedSeconds)}`
          : ''}
      </Text>
      <Text style={[styles.score, { color: theme.text }]}>{scoreLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.one,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  kind: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  date: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
  },
  score: {
    fontSize: 14,
    fontWeight: '600',
  },
});
