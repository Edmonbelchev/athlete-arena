import { StyleSheet, Text, View } from 'react-native';

import { formatWorkoutTimeLimit } from '@/constants/customWorkouts';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatWorkoutSessionScore, type WorkoutSessionHistoryEntry } from '@/types/catalogWorkouts';

interface WorkoutHistoryPanelProps {
  sessions: WorkoutSessionHistoryEntry[];
  emptyLabel?: string;
}

function formatSessionDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function WorkoutHistoryPanel({
  sessions,
  emptyLabel = 'No completed runs yet.',
}: WorkoutHistoryPanelProps) {
  const theme = useTheme();

  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>Your history</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Only your own runs are shown here.
      </Text>

      {sessions.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>{emptyLabel}</Text>
      ) : (
        <View style={styles.list}>
          {sessions.map((session) => (
            <View
              key={session.sessionId}
              style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>
                  {formatWorkoutSessionScore(session)}
                </Text>
                <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                  {session.workoutType === 'for_time'
                    ? formatSessionDate(session.completedAt)
                    : `${formatWorkoutTimeLimit(session.timeLimitSeconds)} cap · ${formatSessionDate(session.completedAt)}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    paddingTop: Spacing.two,
  },
  list: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  row: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  rowCopy: {
    gap: Spacing.half,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
});
