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
import { LeaderboardPodium } from '@/components/leaderboard/LeaderboardPodium';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useLeaderboard } from '@/features/leaderboard/useLeaderboard';
import { useTheme } from '@/hooks/use-theme';
import {
  getLeaderboardPeriodLabel,
  getLeaderboardScopeLabel,
  getLeaderboardScopeSubtitle,
  getLeaderboardXpLabel,
  type LeaderboardPeriod,
  type LeaderboardScope,
} from '@/types/leaderboard';

const PERIODS: LeaderboardPeriod[] = ['weekly', 'all_time'];
const SCOPES: LeaderboardScope[] = ['global', 'friends'];

const SCOPE_ICONS: Record<LeaderboardScope, 'crown' | 'friends'> = {
  global: 'crown',
  friends: 'friends',
};

const PERIOD_ICONS: Record<LeaderboardPeriod, 'flame' | 'star'> = {
  weekly: 'flame',
  all_time: 'star',
};

export function LeaderboardScreenContent() {
  const theme = useTheme();
  const router = useRouter();
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const { entries, isLoading, error, refresh } = useLeaderboard(period, scope);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

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

  const currentUserEntry = useMemo(
    () => dedupedEntries.find((entry) => entry.isCurrentUser),
    [dedupedEntries],
  );

  const podiumEntries = useMemo(
    () => dedupedEntries.filter((entry) => entry.rank <= 3),
    [dedupedEntries],
  );

  const visibleEntries = useMemo(() => {
    const topEntries = dedupedEntries.filter((entry) => entry.rank <= 50 && entry.rank > 3);
    const currentUserOutsideTop = dedupedEntries.find(
      (entry) => entry.isCurrentUser && entry.rank > 50,
    );

    if (!currentUserOutsideTop) {
      return topEntries;
    }

    return [...topEntries, currentUserOutsideTop];
  }, [dedupedEntries]);

  const xpLabel = getLeaderboardXpLabel(period);

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
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />
      }>
      <TabScreenHeader
        title="Leaderboard"
        subtitle="Climb the ranks · Weekly & all-time"
        rightSlot={
          <View style={[styles.headerBadge, { backgroundColor: `${theme.accent}22` }]}>
            <AppIcon name="crown" size={22} color={theme.accent} weight="bold" />
          </View>
        }
      />

      <View
        style={[
          styles.filterCard,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Board</Text>
          <View style={styles.segmentRow}>
            {SCOPES.map((option) => {
              const isActive = option === scope;

              return (
                <Pressable
                  key={option}
                  onPress={() => setScope(option)}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: isActive ? theme.accent : theme.backgroundSelected,
                      borderColor: isActive ? theme.accent : 'transparent',
                    },
                  ]}>
                  <AppIcon
                    name={SCOPE_ICONS[option]}
                    size={15}
                    color={isActive ? '#FFFFFF' : theme.textSecondary}
                    weight="semibold"
                  />
                  <Text
                    style={[
                      styles.segmentLabel,
                      { color: isActive ? '#FFFFFF' : theme.text },
                    ]}>
                    {getLeaderboardScopeLabel(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.filterDivider, { backgroundColor: theme.border }]} />

        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Period</Text>
          <View style={styles.segmentRow}>
            {PERIODS.map((option) => {
              const isActive = option === period;

              return (
                <Pressable
                  key={option}
                  onPress={() => setPeriod(option)}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: isActive ? theme.primary : theme.backgroundSelected,
                      borderColor: isActive ? theme.primary : 'transparent',
                    },
                  ]}>
                  <AppIcon
                    name={PERIOD_ICONS[option]}
                    size={15}
                    color={isActive ? '#FFFFFF' : theme.textSecondary}
                    weight="semibold"
                  />
                  <Text
                    style={[
                      styles.segmentLabel,
                      { color: isActive ? '#FFFFFF' : theme.text },
                    ]}>
                    {getLeaderboardPeriodLabel(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.helperText, { color: theme.textSecondary }]}>
          {getLeaderboardScopeSubtitle(scope, period)}
        </Text>
      </View>

      {isLoading && dedupedEntries.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}

      {error ? (
        <View
          style={[
            styles.messageCard,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <AppIcon name="quiz" size={28} color={theme.danger} weight="semibold" />
          <Text style={[styles.messageTitle, { color: theme.text }]}>Could not load leaderboard</Text>
          <Text style={[styles.messageBody, { color: theme.textSecondary }]}>{error}</Text>
          <PrimaryButton label="Try again" onPress={() => void refresh()} />
        </View>
      ) : null}

      {!isLoading && !error && dedupedEntries.length === 0 ? (
        <View
          style={[
            styles.messageCard,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <AppIcon name="medal" size={32} color={theme.textSecondary} weight="semibold" />
          <Text style={[styles.messageTitle, { color: theme.text }]}>No rankings yet</Text>
          <Text style={[styles.messageBody, { color: theme.textSecondary }]}>
            {scope === 'friends'
              ? period === 'weekly'
                ? 'You and your friends have not earned XP this week yet. Complete a challenge to get on the board.'
                : 'Add friends and earn XP together to see who leads your crew.'
              : period === 'weekly'
                ? 'Complete a challenge this week to appear on the board.'
                : 'Earn XP from daily challenges, friend races, and achievements to climb the board.'}
          </Text>
          {scope === 'friends' ? (
            <PrimaryButton
              label="Find friends"
              variant="secondary"
              onPress={() => router.push('/friends/add')}
            />
          ) : null}
        </View>
      ) : null}

      {currentUserEntry && dedupedEntries.length > 0 ? (
        <Pressable
          onPress={() => handleEntryPress(currentUserEntry.userId, true)}
          style={({ pressed }) => [
            styles.heroCard,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.primary,
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <View style={[styles.heroGlow, { backgroundColor: `${theme.primary}16` }]} />
          <View style={styles.heroLeft}>
            <ProfileAvatar
              uri={currentUserEntry.avatarUrl}
              name={currentUserEntry.displayName ?? currentUserEntry.username}
              size={52}
              shopAvatar={currentUserEntry.avatar}
              frame={currentUserEntry.frame}
            />
            <View style={styles.heroCopy}>
              <Text style={[styles.heroEyebrow, { color: theme.textSecondary }]}>Your standing</Text>
              <Text style={[styles.heroTitle, { color: theme.text }]}>
                #{currentUserEntry.rank}
                {currentUserEntry.rank === 1 ? ' · Champion' : currentUserEntry.rank <= 3 ? ' · Podium' : ''}
              </Text>
            </View>
          </View>
          <View style={[styles.heroXp, { backgroundColor: `${theme.xp}18` }]}>
            <AppIcon name="bolt" size={16} color={theme.xp} weight="bold" />
            <Text style={[styles.heroXpValue, { color: theme.text }]}>
              {currentUserEntry.xpAmount.toLocaleString()}
            </Text>
            <Text style={[styles.heroXpLabel, { color: theme.textSecondary }]}>{xpLabel}</Text>
          </View>
        </Pressable>
      ) : null}

      {podiumEntries.length > 0 ? (
        <LeaderboardPodium
          entries={podiumEntries}
          period={period}
          onPress={(entry) => handleEntryPress(entry.userId, entry.isCurrentUser)}
        />
      ) : null}

      {visibleEntries.length > 0 ? (
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <AppIcon name="medal" size={16} color={theme.textSecondary} weight="semibold" />
            <Text style={[styles.listTitle, { color: theme.text }]}>
              {podiumEntries.length > 0 ? 'The rest of the pack' : 'Rankings'}
            </Text>
          </View>
          <View style={styles.list}>
            {visibleEntries.map((entry, index) => {
              const showDivider =
                entry.rank > 50 && index > 0 && visibleEntries[index - 1]?.rank <= 50;

              return (
                <View key={entry.userId} style={styles.listItemWrap}>
                  {showDivider ? (
                    <View style={styles.outsideTopDivider}>
                      <View style={[styles.outsideTopLine, { backgroundColor: theme.border }]} />
                      <Text style={[styles.outsideTopLabel, { color: theme.textSecondary }]}>
                        Your rank
                      </Text>
                      <View style={[styles.outsideTopLine, { backgroundColor: theme.border }]} />
                    </View>
                  ) : null}
                  <LeaderboardListItem
                    entry={entry}
                    xpLabel={xpLabel}
                    onPress={() => handleEntryPress(entry.userId, entry.isCurrentUser)}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  headerBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  filterSection: {
    gap: Spacing.two,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  filterDivider: {
    height: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.two,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  helperText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: Radius.xl,
    padding: Spacing.three,
    overflow: 'hidden',
    gap: Spacing.two,
  },
  heroGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    top: -48,
    right: -24,
  },
  heroLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  heroXp: {
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: 2,
    minWidth: 88,
  },
  heroXpValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  heroXpLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  loading: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  messageBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
  listSection: {
    gap: Spacing.two,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.half,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  list: {
    gap: Spacing.two,
  },
  listItemWrap: {
    gap: Spacing.one,
  },
  outsideTopDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  outsideTopLine: {
    flex: 1,
    height: 1,
  },
  outsideTopLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
