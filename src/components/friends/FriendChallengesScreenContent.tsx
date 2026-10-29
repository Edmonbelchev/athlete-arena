import { router, useFocusEffect } from 'expo-router';
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

import { FriendChallengeActionRow } from '@/components/friends/FriendChallengeActionRow';
import { FriendChallengePartnersList } from '@/components/friends/FriendChallengePartnersList';
import { HomeSection } from '@/components/home/HomeSection';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import {
  buildFriendChallengeOverview,
  type FriendChallengeRivalSummary,
} from '@/features/friends/friendChallengeOverview';
import { useFriendChallenges } from '@/features/friends/useFriendChallenges';
import { useChallengeNotificationRefresh } from '@/features/notifications/useChallengeNotificationRefresh';
import { useTheme } from '@/hooks/use-theme';

interface FriendChallengesScreenContentProps {
  onRefresh?: () => void;
}

function SummaryTile({ value, label, color }: { value: string; label: string; color: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.summaryTile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function RivalRow({ rival }: { rival: FriendChallengeRivalSummary }) {
  const theme = useTheme();
  const leading = rival.wins > rival.losses;
  const trailing = rival.losses > rival.wins;
  const recordColor = leading ? theme.success : trailing ? theme.danger : theme.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View races with ${rival.displayName}`}
      onPress={() =>
        router.push({
          pathname: '/friends/challenges/[friendId]',
          params: { friendId: rival.friendId, username: rival.username, displayName: rival.displayName },
        })
      }
      style={({ pressed }) => [
        styles.rivalRow,
        { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.88 : 1 },
      ]}>
      <ProfileAvatar name={rival.displayName} size={40} />
      <View style={styles.rivalCopy}>
        <Text style={[styles.rivalName, { color: theme.text }]} numberOfLines={1}>
          {rival.displayName}
        </Text>
        <Text style={[styles.rivalMeta, { color: theme.textSecondary }]} numberOfLines={1}>
          @{rival.username}
          {rival.activeCount > 0 ? ` · ${rival.activeCount} active` : ''}
        </Text>
      </View>
      <View style={styles.recordBlock}>
        <Text style={[styles.recordValue, { color: recordColor }]}>
          {rival.wins}–{rival.losses}
          {rival.ties > 0 ? `–${rival.ties}` : ''}
        </Text>
        <Text style={[styles.recordLabel, { color: theme.textSecondary }]}>W–L{rival.ties > 0 ? '–T' : ''}</Text>
      </View>
    </Pressable>
  );
}

export function FriendChallengesScreenContent({ onRefresh }: FriendChallengesScreenContentProps) {
  const theme = useTheme();
  const { session } = useAuth();
  const { challenges, isLoading, error, refresh } = useFriendChallenges();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const overview = useMemo(
    () => buildFriendChallengeOverview(challenges, session?.user.id ?? ''),
    [challenges, session?.user.id],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      onRefresh?.();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, refresh]);

  useChallengeNotificationRefresh(handleRefresh);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (isLoading && challenges.length === 0) {
    return (
      <View style={StyleSheet.flatten([styles.loading, { backgroundColor: theme.background }])}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const hasAnyChallenge = challenges.length > 0;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={theme.primary}
        />
      }>
      {error ? (
        <View style={styles.errorBlock}>
          <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
          <PrimaryButton label="Try Again" variant="secondary" onPress={() => void handleRefresh()} />
        </View>
      ) : null}

      {hasAnyChallenge ? (
        <View style={styles.summaryRow}>
          <SummaryTile
            value={String(overview.yourMove.length)}
            label="Your move"
            color={overview.yourMove.length > 0 ? theme.streak : theme.text}
          />
          <SummaryTile value={String(overview.waiting.length)} label="Waiting" color={theme.text} />
          <SummaryTile value={`${overview.wins}–${overview.losses}`} label="Record" color={theme.primary} />
        </View>
      ) : null}

      {overview.yourMove.length > 0 ? (
        <HomeSection title="Your move" subtitle="Respond or race now" badge={overview.yourMove.length}>
          <View style={styles.list}>
            {overview.yourMove.map((challenge) => (
              <FriendChallengeActionRow key={challenge.participantId} challenge={challenge} />
            ))}
          </View>
        </HomeSection>
      ) : null}

      {overview.waiting.length > 0 ? (
        <HomeSection title="Waiting on friends" subtitle="You finished - their turn">
          <View style={styles.list}>
            {overview.waiting.map((challenge) => (
              <FriendChallengeActionRow key={challenge.participantId} challenge={challenge} />
            ))}
          </View>
        </HomeSection>
      ) : null}

      {overview.rivals.length > 0 ? (
        <HomeSection title="Rivals" subtitle="Your head-to-head record with each friend">
          <View style={styles.list}>
            {overview.rivals.map((rival) => (
              <RivalRow key={rival.friendId} rival={rival} />
            ))}
          </View>
        </HomeSection>
      ) : null}

      {!hasAnyChallenge && !error ? <FriendChallengePartnersList partners={[]} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  summaryTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  list: {
    gap: Spacing.two,
  },
  rivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  rivalCopy: {
    flex: 1,
    gap: 2,
  },
  rivalName: {
    fontSize: 16,
    fontWeight: '800',
  },
  rivalMeta: {
    fontSize: 13,
    fontWeight: '600',
  },
  recordBlock: {
    alignItems: 'flex-end',
  },
  recordValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  recordLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  errorBlock: {
    gap: Spacing.two,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
