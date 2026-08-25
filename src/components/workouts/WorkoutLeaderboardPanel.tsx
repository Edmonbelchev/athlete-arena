import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { LeaderboardListItem } from '@/components/leaderboard/LeaderboardListItem';
import { LeaderboardPodium } from '@/components/leaderboard/LeaderboardPodium';
import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LeaderboardEntry } from '@/types/leaderboard';
import {
  getWorkoutLeaderboardPeriodLabel,
  getWorkoutLeaderboardScoreLabel,
  type WorkoutLeaderboardEntry,
  type WorkoutLeaderboardMetric,
  type WorkoutLeaderboardPeriod,
} from '@/types/catalogWorkouts';
import { formatRaceTime } from '@/constants/friendChallenges';

interface WorkoutLeaderboardPanelProps {
  entries: WorkoutLeaderboardEntry[];
  period: WorkoutLeaderboardPeriod;
  metric: WorkoutLeaderboardMetric | null;
  onPeriodChange: (period: WorkoutLeaderboardPeriod) => void;
  isLoading?: boolean;
  error?: string | null;
}

const PERIODS: WorkoutLeaderboardPeriod[] = ['weekly', 'all_time'];

function mapToLeaderboardEntry(entry: WorkoutLeaderboardEntry): LeaderboardEntry {
  return {
    rank: entry.rank,
    userId: entry.userId,
    username: entry.username,
    displayName: entry.displayName,
    level: entry.level,
    xpAmount: entry.scoreAmount,
    avatarUrl: entry.avatarUrl,
    avatar: entry.avatar,
    frame: entry.frame,
    isCurrentUser: entry.isCurrentUser,
  };
}

function getScoreParts(
  entry: WorkoutLeaderboardEntry,
  metric: WorkoutLeaderboardMetric | null,
): { display: string; subLabel: string } {
  if (metric === 'fastest_time') {
    return {
      display: formatRaceTime(entry.scoreAmount),
      subLabel: 'finish time',
    };
  }

  return {
    display: `${entry.scoreAmount} rounds`,
    subLabel: `${entry.tiebreakAmount} reps`,
  };
}

export function WorkoutLeaderboardPanel({
  entries,
  period,
  metric,
  onPeriodChange,
  isLoading = false,
  error = null,
}: WorkoutLeaderboardPanelProps) {
  const theme = useTheme();

  const dedupedEntries = useMemo(() => {
    const seen = new Set<string>();
    return entries.filter((entry) => {
      if (seen.has(entry.userId)) {
        return false;
      }
      seen.add(entry.userId);
      return true;
    });
  }, [entries]);

  const podiumEntries = useMemo(
    () => dedupedEntries.filter((entry) => entry.rank <= 3).map(mapToLeaderboardEntry),
    [dedupedEntries],
  );

  const listEntries = useMemo(
    () =>
      dedupedEntries
        .filter((entry) => entry.rank > 3 && entry.rank <= 50)
        .map(mapToLeaderboardEntry),
    [dedupedEntries],
  );

  const scoreDisplays = useMemo(
    () =>
      Object.fromEntries(
        dedupedEntries.map((entry) => {
          const parts = getScoreParts(entry, metric);
          return [entry.userId, { value: parts.display, subLabel: parts.subLabel }];
        }),
      ),
    [dedupedEntries, metric],
  );

  const entryByUserId = useMemo(
    () => new Map(dedupedEntries.map((entry) => [entry.userId, entry])),
    [dedupedEntries],
  );

  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Leaderboard</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Ranked by {getWorkoutLeaderboardScoreLabel(metric).toLowerCase()} · {getWorkoutLeaderboardPeriodLabel(period)}
          </Text>
        </View>
        <AppIcon name="crown" size={20} color={theme.streak} weight="semibold" />
      </View>

      <View style={styles.segmentRow}>
        {PERIODS.map((option) => {
          const isActive = option === period;
          return (
            <Pressable
              key={option}
              onPress={() => onPeriodChange(option)}
              style={[
                styles.segmentButton,
                {
                  backgroundColor: isActive ? theme.primary : theme.backgroundSelected,
                  borderColor: isActive ? theme.primary : 'transparent',
                },
              ]}>
              <Text style={[styles.segmentLabel, { color: isActive ? '#FFFFFF' : theme.text }]}>
                {getWorkoutLeaderboardPeriodLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
      ) : dedupedEntries.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          No scores yet. Be the first to post a result.
        </Text>
      ) : (
        <View style={styles.body}>
          {podiumEntries.length > 0 ? (
            <LeaderboardPodium
              entries={podiumEntries}
              period="all_time"
              scoreDisplays={scoreDisplays}
            />
          ) : null}
          <View style={styles.list}>
            {listEntries.map((entry) => {
              const workoutEntry = entryByUserId.get(entry.userId);
              const parts = workoutEntry ? getScoreParts(workoutEntry, metric) : null;

              return (
                <LeaderboardListItem
                  key={entry.userId}
                  entry={entry}
                  scoreDisplay={parts?.display}
                  scoreSubLabel={parts?.subLabel}
                />
              );
            })}
          </View>
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
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.half,
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
  segmentRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  loader: {
    paddingVertical: Spacing.four,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
  body: {
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
});
