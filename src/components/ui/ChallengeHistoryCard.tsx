import { StyleSheet, Text, View } from 'react-native';

import { formatExerciseLabel } from '@/constants/challenges';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import {
  getHistoryKindLabel,
  getHistoryResultLabel,
  getHistoryScoreLine,
  getHistoryStatusColorKey,
  type ChallengeHistoryEntry,
} from '@/types/challengeHistory';
import { useTheme } from '@/hooks/use-theme';

interface ChallengeHistoryCardProps {
  entry: ChallengeHistoryEntry;
}

function formatHistoryDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ChallengeHistoryCard({ entry }: ChallengeHistoryCardProps) {
  const theme = useTheme();
  const { session } = useAuth();
  const myUserId = session?.user.id;
  const resultLabel = getHistoryResultLabel(entry, myUserId);
  const statusColorKey = getHistoryStatusColorKey(entry, myUserId);
  const statusColor =
    statusColorKey === 'success'
      ? theme.success
      : statusColorKey === 'danger'
        ? theme.danger
        : statusColorKey === 'xp'
          ? theme.xp
          : theme.textSecondary;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.kind, { color: theme.textSecondary }]}>{getHistoryKindLabel(entry)}</Text>
        <Text style={[styles.date, { color: theme.textSecondary }]}>{formatHistoryDate(entry.resultAt)}</Text>
      </View>

      <Text style={[styles.title, { color: theme.text }]}>
        {entry.targetReps} {formatExerciseLabel(entry.exerciseType, true)}
      </Text>

      <Text style={[styles.score, { color: theme.text }]}>{getHistoryScoreLine(entry)}</Text>

      <Text style={[styles.result, { color: statusColor }]}>{resultLabel}</Text>
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
  score: {
    fontSize: 14,
    fontWeight: '600',
  },
  result: {
    fontSize: 14,
    fontWeight: '700',
  },
});
