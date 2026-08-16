import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FriendChallengeHistoryCard } from '@/components/friends/FriendChallengeHistoryCard';
import { FriendChallengesCarousel } from '@/components/home/FriendChallengesCarousel';
import { HomeSection } from '@/components/home/HomeSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useFriendChallengesWithFriend } from '@/features/friends/useFriendChallengesWithFriend';
import { useChallengeNotificationRefresh } from '@/features/notifications/useChallengeNotificationRefresh';
import { formatUserError } from '@/lib/errors';
import {
  acceptFriendChallenge,
  declineFriendChallenge,
} from '@/services/friendChallengeService';
import { useTheme } from '@/hooks/use-theme';

interface FriendChallengesWithFriendContentProps {
  friendId: string;
  friendName: string;
  friendUsername?: string;
}

export function FriendChallengesWithFriendContent({
  friendId,
  friendName,
  friendUsername,
}: FriendChallengesWithFriendContentProps) {
  const theme = useTheme();
  const router = useRouter();
  const {
    activeChallenges,
    historyChallenges,
    isLoading,
    error,
    refresh,
  } = useFriendChallengesWithFriend(friendId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const displayError = error ?? actionError;

  const handleRefresh = useCallback(async () => {
    setActionError(null);
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useChallengeNotificationRefresh(handleRefresh);

  function handleCreateChallenge() {
    router.push({
      pathname: '/friends/challenge/create',
      params: {
        friendId,
        username: friendUsername ?? friendName,
        displayName: friendName,
      },
    });
  }

  async function handleAcceptChallenge(participantId: string) {
    setBusyId(participantId);
    setActionError(null);
    try {
      await acceptFriendChallenge(participantId);
      router.push({
        pathname: '/challenge/friend/[participantId]',
        params: { participantId },
      });
    } catch (err) {
      setActionError(formatUserError(err, 'Failed to accept challenge'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeclineChallenge(participantId: string) {
    setBusyId(participantId);
    setActionError(null);
    try {
      await declineFriendChallenge(participantId);
      await refresh();
    } catch (err) {
      setActionError(formatUserError(err, 'Failed to decline challenge'));
    } finally {
      setBusyId(null);
    }
  }

  const subtitle = useMemo(() => {
    if (activeChallenges.length === 0 && historyChallenges.length === 0) {
      return 'No races with this friend yet';
    }

    const parts: string[] = [];
    if (activeChallenges.length > 0) {
      parts.push(`${activeChallenges.length} active`);
    }
    if (historyChallenges.length > 0) {
      parts.push(`${historyChallenges.length} completed`);
    }
    return parts.join(' · ');
  }, [activeChallenges.length, historyChallenges.length]);

  if (isLoading && activeChallenges.length === 0 && historyChallenges.length === 0) {
    return (
      <View style={StyleSheet.flatten([styles.loading, { backgroundColor: theme.background }])}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

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
      <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>{subtitle}</Text>

      <PrimaryButton label={`Challenge ${friendName}`} onPress={handleCreateChallenge} />

      {displayError ? (
        <View style={styles.errorBlock}>
          <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{displayError}</Text>
          <PrimaryButton label="Try Again" variant="secondary" onPress={() => void handleRefresh()} />
        </View>
      ) : null}

      {activeChallenges.length > 0 ? (
        <HomeSection title="Active Races" subtitle={`Swipe through races with ${friendName}`}>
          <FriendChallengesCarousel
            challenges={activeChallenges}
            busyChallengeId={busyId}
            onAccept={(participantId) => void handleAcceptChallenge(participantId)}
            onDecline={(participantId) => void handleDeclineChallenge(participantId)}
          />
        </HomeSection>
      ) : null}

      {historyChallenges.length > 0 ? (
        <HomeSection title="History" subtitle="Completed races with this friend">
          <View
            style={StyleSheet.flatten([
              styles.historyContainer,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ])}>
            {historyChallenges.map((challenge) => (
              <FriendChallengeHistoryCard key={challenge.participantId} challenge={challenge} />
            ))}
          </View>
        </HomeSection>
      ) : null}

      {activeChallenges.length === 0 && historyChallenges.length === 0 ? (
        <View
          style={StyleSheet.flatten([
            styles.emptyCard,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ])}>
          <Text style={StyleSheet.flatten([styles.emptyCopy, { color: theme.textSecondary }])}>
            No races with {friendName} yet. Tap the button above to start one.
          </Text>
        </View>
      ) : null}
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
    gap: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  errorBlock: {
    gap: Spacing.two,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  historyContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  emptyCard: {
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});
