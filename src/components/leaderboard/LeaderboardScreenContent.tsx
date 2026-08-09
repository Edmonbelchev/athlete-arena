import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LeaderboardListItem } from '@/components/leaderboard/LeaderboardListItem';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useLeaderboard } from '@/features/leaderboard/useLeaderboard';
import {
  getLeaderboardPeriodLabel,
  getLeaderboardPeriodSubtitle,
  type LeaderboardPeriod,
} from '@/types/leaderboard';
import { useTheme } from '@/hooks/use-theme';

const PERIODS: LeaderboardPeriod[] = ['weekly', 'all_time'];

export function LeaderboardScreenContent() {
  const theme = useTheme();
  const router = useRouter();
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const { entries, isLoading, error, refresh } = useLeaderboard(period);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const visibleEntries = useMemo(() => {
    const topEntries = entries.filter((entry) => entry.rank <= 50);
    const currentUserOutsideTop = entries.find((entry) => entry.isCurrentUser && entry.rank > 50);

    if (!currentUserOutsideTop) {
      return topEntries;
    }

    return [...topEntries, currentUserOutsideTop];
  }, [entries]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  function handleEntryPress(userId: string, isCurrentUser: boolean) {
    if (isCurrentUser) {
      router.push('/(tabs)/profile');
      return;
    }

    router.push({
      pathname: '/friends/[userId]',
      params: { userId },
    });
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />
      }>
      <View style={styles.periodSwitcher}>
        {PERIODS.map((option) => {
          const isActive = option === period;

          return (
            <Pressable
              key={option}
              onPress={() => setPeriod(option)}
              style={[
                styles.periodButton,
                {
                  backgroundColor: isActive ? theme.primary : theme.backgroundElement,
                  borderColor: isActive ? theme.primary : theme.border,
                },
              ]}>
              <Text
                style={[
                  styles.periodLabel,
                  { color: isActive ? '#FFFFFF' : theme.text },
                ]}>
                {getLeaderboardPeriodLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.helperText, { color: theme.textSecondary }]}>
        {getLeaderboardPeriodSubtitle(period)}
      </Text>

      {isLoading && visibleEntries.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}

      {error ? (
        <View style={[styles.messageCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Text style={[styles.messageTitle, { color: theme.text }]}>Could not load leaderboard</Text>
          <Text style={[styles.messageBody, { color: theme.textSecondary }]}>{error}</Text>
          <PrimaryButton label="Try again" onPress={() => void refresh()} />
        </View>
      ) : null}

      {!isLoading && !error && visibleEntries.length === 0 ? (
        <View style={[styles.messageCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Text style={[styles.messageTitle, { color: theme.text }]}>No rankings yet</Text>
          <Text style={[styles.messageBody, { color: theme.textSecondary }]}>
            {period === 'weekly'
              ? 'Complete a challenge this week to appear on the board.'
              : 'Earn XP from daily challenges, friend races, and achievements to climb the board.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {visibleEntries.map((entry, index) => {
          const showDivider =
            entry.rank > 50 && index > 0 && visibleEntries[index - 1]?.rank <= 50;

          return (
            <View key={`${entry.userId}-${entry.rank}`} style={styles.listItemWrap}>
              {showDivider ? (
                <Text style={[styles.outsideTopLabel, { color: theme.textSecondary }]}>
                  Your rank
                </Text>
              ) : null}
              <LeaderboardListItem
                entry={entry}
                onPress={() => handleEntryPress(entry.userId, entry.isCurrentUser)}
              />
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  periodSwitcher: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  periodButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  loading: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  messageBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  list: {
    gap: Spacing.two,
  },
  listItemWrap: {
    gap: Spacing.one,
  },
  outsideTopLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingTop: Spacing.one,
  },
});
