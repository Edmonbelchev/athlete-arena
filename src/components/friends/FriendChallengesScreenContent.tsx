import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FriendChallengePartnersList } from '@/components/friends/FriendChallengePartnersList';
import { HomeSection } from '@/components/home/HomeSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useFriendChallengePartners } from '@/features/friends/useFriendChallengePartners';
import { useChallengeNotificationRefresh } from '@/features/notifications/useChallengeNotificationRefresh';
import { useTheme } from '@/hooks/use-theme';

interface FriendChallengesScreenContentProps {
  onRefresh?: () => void;
}

export function FriendChallengesScreenContent({ onRefresh }: FriendChallengesScreenContentProps) {
  const theme = useTheme();
  const { partners, activePartners, historyOnlyPartners, isLoading, error, refresh } =
    useFriendChallengePartners();
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  if (isLoading && partners.length === 0) {
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
      <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
        Open a friend to see active races and your full head-to-head history.
      </Text>

      {error ? (
        <View style={styles.errorBlock}>
          <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
          <PrimaryButton label="Try Again" variant="secondary" onPress={() => void handleRefresh()} />
        </View>
      ) : null}

      {activePartners.length > 0 ? (
        <HomeSection title="Active Races" subtitle="Friends with races in progress">
          <FriendChallengePartnersList partners={activePartners} />
        </HomeSection>
      ) : null}

      {historyOnlyPartners.length > 0 ? (
        <HomeSection title="Race History" subtitle="Past races with friends">
          <FriendChallengePartnersList
            partners={historyOnlyPartners}
            emptyTitle="No completed races yet"
            emptyCopy="Finish a friend challenge to see it here."
          />
        </HomeSection>
      ) : null}

      {partners.length === 0 ? <FriendChallengePartnersList partners={partners} /> : null}
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
