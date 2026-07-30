import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendListItem } from '@/components/ui/FriendListItem';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useFriendChallenges } from '@/features/friends/useFriendChallenges';
import { useFriends } from '@/features/friends/useFriends';
import {
  acceptFriendChallenge,
  declineFriendChallenge,
} from '@/services/friendChallengeService';
import { respondFriendRequest } from '@/services/friendsService';
import { FriendChallengeCard } from '@/components/ui/FriendChallengeCard';
import { formatUserError } from '@/lib/errors';
import { useTheme } from '@/hooks/use-theme';
import { useChallengeNotificationRefresh } from '@/features/notifications/useChallengeNotificationRefresh';

export default function FriendsScreen() {
  const theme = useTheme();
  const { friends, requests, isLoading, error, refresh } = useFriends();
  const {
    challenges,
    isLoading: isChallengesLoading,
    error: challengesError,
    refresh: refreshChallenges,
  } = useFriendChallenges();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setActionError(null);
    await Promise.all([refresh(), refreshChallenges()]);
  }, [refresh, refreshChallenges]);

  useFocusEffect(
    useCallback(() => {
      void handleRefresh();
    }, [handleRefresh]),
  );

  useChallengeNotificationRefresh(handleRefresh);

  async function handleRespondRequest(friendshipId: string, accept: boolean) {
    setBusyId(friendshipId);
    setActionError(null);
    try {
      await respondFriendRequest(friendshipId, accept);
      await refresh();
    } catch (err) {
      setActionError(formatUserError(err, 'Failed to respond to request'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleAcceptChallenge(participantId: string) {
    setBusyId(participantId);
    setActionError(null);
    try {
      await acceptFriendChallenge(participantId);
      await refreshChallenges();
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
      await refreshChallenges();
    } catch (err) {
      setActionError(formatUserError(err, 'Failed to decline challenge'));
    } finally {
      setBusyId(null);
    }
  }

  const loading = isLoading || isChallengesLoading;
  const displayError = error ?? challengesError ?? actionError;

  if (loading) {
    return (
      <View style={StyleSheet.flatten([styles.loading, { backgroundColor: theme.background }])}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
      <ScrollView contentContainerStyle={styles.content}>
        <TabScreenHeader
          title="Friends"
          rightSlot={
            <PrimaryButton
              label="Add Friend"
              variant="secondary"
              onPress={() => router.push('/friends/add')}
            />
          }
        />

        {displayError ? (
          <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{displayError}</Text>
        ) : null}

        {requests.length > 0 ? (
          <View style={styles.section}>
            <Text style={StyleSheet.flatten([styles.sectionTitle, { color: theme.textSecondary }])}>
              FRIEND REQUESTS
            </Text>
            {requests.map((request) => (
              <View
                key={request.friendshipId}
                style={StyleSheet.flatten([
                  styles.requestCard,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ])}>
                <Text style={StyleSheet.flatten([styles.requestName, { color: theme.text }])}>
                  {request.displayName ?? request.username}
                </Text>
                <Text style={StyleSheet.flatten([styles.requestMeta, { color: theme.textSecondary }])}>
                  @{request.username}
                </Text>
                <View style={styles.requestActions}>
                  <PrimaryButton
                    label="Accept"
                    loading={busyId === request.friendshipId}
                    onPress={() => void handleRespondRequest(request.friendshipId, true)}
                  />
                  <PrimaryButton
                    label="Decline"
                    variant="secondary"
                    disabled={busyId === request.friendshipId}
                    onPress={() => void handleRespondRequest(request.friendshipId, false)}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {challenges.length > 0 ? (
          <View style={styles.section}>
            <Text style={StyleSheet.flatten([styles.sectionTitle, { color: theme.textSecondary }])}>
              ACTIVE CHALLENGES
            </Text>
            {challenges.map((challenge) => (
              <FriendChallengeCard
                key={challenge.participantId}
                challenge={challenge}
                loading={busyId === challenge.participantId}
                onAccept={() => void handleAcceptChallenge(challenge.participantId)}
                onDecline={() => void handleDeclineChallenge(challenge.participantId)}
                onStart={() =>
                  router.push({
                    pathname: '/challenge/friend/[participantId]',
                    params: { participantId: challenge.participantId },
                  })
                }
              />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={StyleSheet.flatten([styles.sectionTitle, { color: theme.textSecondary }])}>
            YOUR FRIENDS ({friends.length})
          </Text>
          {friends.length === 0 ? (
            <Text style={StyleSheet.flatten([styles.empty, { color: theme.textSecondary }])}>
              No friends yet. Search by username to send a request.
            </Text>
          ) : (
            friends.map((friend) => (
              <FriendListItem
                key={friend.friendId}
                friend={friend}
                onPress={() =>
                  router.push({
                    pathname: '/friends/[userId]',
                    params: { userId: friend.friendId, username: friend.username },
                  })
                }
                onChallenge={() =>
                  router.push({
                    pathname: '/friends/challenge/create',
                    params: { friendId: friend.friendId, username: friend.username },
                  })
                }
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  requestCard: {
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    gap: Spacing.two,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '700',
  },
  requestMeta: {
    fontSize: 13,
  },
  requestActions: {
    gap: Spacing.two,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
