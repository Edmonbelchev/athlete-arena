import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendChallengesByFriend } from '@/components/friends/FriendChallengesByFriend';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  groupChallengesByFriend,
  isActiveFriendChallenge,
} from '@/features/friends/friendChallengeGroups';
import { useFriendChallenges } from '@/features/friends/useFriendChallenges';
import { useChallengeNotificationRefresh } from '@/features/notifications/useChallengeNotificationRefresh';
import { formatUserError } from '@/lib/errors';
import {
  acceptFriendChallenge,
  declineFriendChallenge,
} from '@/services/friendChallengeService';
import { useTheme } from '@/hooks/use-theme';

export default function FriendChallengesScreen() {
  const theme = useTheme();
  const {
    challenges,
    isLoading,
    error: challengesError,
    refresh: refreshChallenges,
  } = useFriendChallenges();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeChallenges = useMemo(
    () => challenges.filter(isActiveFriendChallenge),
    [challenges],
  );
  const groups = useMemo(() => groupChallengesByFriend(activeChallenges), [activeChallenges]);

  const handleRefresh = useCallback(async () => {
    setActionError(null);
    setIsRefreshing(true);
    try {
      await refreshChallenges();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshChallenges]);

  useFocusEffect(
    useCallback(() => {
      void handleRefresh();
    }, [handleRefresh]),
  );

  useChallengeNotificationRefresh(handleRefresh);

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

  const displayError = challengesError ?? actionError;

  if (isLoading && challenges.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Challenges', headerShown: true }} />
        <View style={StyleSheet.flatten([styles.loading, { backgroundColor: theme.background }])}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Challenges', headerShown: true }} />
      <SafeAreaView
        edges={['bottom']}
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={theme.primary}
            />
          }>
          <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
            Active speed races grouped by friend. Swipe within each section to browse races with the same
            person.
          </Text>

          {displayError ? (
            <View style={styles.errorBlock}>
              <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{displayError}</Text>
              <PrimaryButton label="Try Again" variant="secondary" onPress={() => void handleRefresh()} />
            </View>
          ) : null}

          <FriendChallengesByFriend
            groups={groups}
            busyChallengeId={busyId}
            onAccept={(participantId) => void handleAcceptChallenge(participantId)}
            onDecline={(participantId) => void handleDeclineChallenge(participantId)}
          />
        </ScrollView>
      </SafeAreaView>
    </>
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
});
