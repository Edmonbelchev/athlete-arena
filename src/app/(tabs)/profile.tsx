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
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeProgressBlock } from '@/components/home/HomeProgressBlock';
import { HomeSection } from '@/components/home/HomeSection';
import { ProfileAchievementSection } from '@/components/profile/ProfileAchievementSection';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileQuickActions } from '@/components/profile/ProfileQuickActions';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StatCard } from '@/components/ui/StatCard';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAchievementPreview } from '@/features/achievements/useAchievementPreview';
import { getAuthErrorMessage } from '@/features/auth/authErrors';
import { useAuth } from '@/features/auth';
import { usePremium } from '@/features/subscription/usePremium';
import { useProfile } from '@/features/profile/useProfile';
import { useProfileStats } from '@/features/profile/useProfileStats';
import { xpProgressInCurrentLevel } from '@/features/xp/levelUtils';
import { formatUserError } from '@/lib/errors';
import { deleteMyAccount } from '@/services/accountService';
import { getEquippedTitleName } from '@/services/titleService';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const { session, signOut } = useAuth();
  const { isPremium } = usePremium();
  const { profile, isLoading: isProfileLoading, error: profileError } = useProfile();
  const {
    stats,
    isLoading: isStatsLoading,
    error: statsError,
    refresh: refreshStats,
  } = useProfileStats();
  const {
    achievements,
    unlockedCount,
    isLoading: isAchievementsLoading,
    error: achievementsError,
    refresh: refreshAchievements,
  } = useAchievementPreview();
  const [equippedTitleName, setEquippedTitleName] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const isLoading = isProfileLoading || isStatsLoading;
  const error = profileError ?? statsError;

  const handleRefresh = useCallback(
    async (options?: { bypassCache?: boolean }) => {
      if (!session?.user.id) {
        return;
      }

      await Promise.all([
        refreshStats(options),
        refreshAchievements(),
        getEquippedTitleName(session.user.id).then(setEquippedTitleName),
      ]);
    },
    [refreshAchievements, refreshStats, session?.user.id],
  );

  useFocusEffect(
    useCallback(() => {
      void handleRefresh();
    }, [handleRefresh]),
  );

  const username = profile?.username ?? session?.user.email?.split('@')[0] ?? 'user';
  const displayName = profile?.display_name ?? username;
  const totalXp = profile?.total_xp ?? 0;
  const xpProgress = xpProgressInCurrentLevel(totalXp);

  const quickActions = useMemo(
    () => [
      {
        id: 'stats',
        label: 'Stats',
        icon: 'bolt' as const,
        onPress: () => router.push('/profile/stats'),
      },
      {
        id: 'goals',
        label: 'Goals',
        icon: 'target' as const,
        onPress: () => router.push('/profile/goals'),
      },
      {
        id: 'achievements',
        label: 'Achievements',
        icon: 'medal' as const,
        onPress: () => router.push('/profile/achievements'),
      },
      {
        id: 'titles',
        label: 'Titles',
        icon: 'crown' as const,
        onPress: () => router.push('/profile/titles'),
      },
      {
        id: 'history',
        label: 'History',
        icon: 'history' as const,
        onPress: () => router.push('/profile/history'),
      },
      {
        id: 'membership',
        label: 'Membership',
        icon: 'crown' as const,
        onPress: () => router.push('/profile/subscription'),
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: 'settings' as const,
        onPress: () => router.push('/profile/settings'),
      },
      {
        id: 'support',
        label: 'Support',
        icon: 'support' as const,
        onPress: () => router.push('/profile/support'),
      },
      {
        id: 'edit',
        label: 'Edit Profile',
        icon: 'profile' as const,
        onPress: () => router.push('/profile/edit'),
      },
    ],
    [],
  );

  async function handleLogout() {
    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      await signOut();
    } catch (err) {
      setLogoutError(getAuthErrorMessage(err));
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleDeleteAccount(reason: string) {
    setDeleteError(null);
    setIsDeletingAccount(true);

    try {
      await deleteMyAccount(reason);
      setIsDeleteModalVisible(false);
    } catch (err) {
      setDeleteError(formatUserError(err, 'Failed to delete account'));
    } finally {
      setIsDeletingAccount(false);
    }
  }

  function openDeleteModal() {
    setDeleteError(null);
    setIsDeleteModalVisible(true);
  }

  function closeDeleteModal() {
    if (isDeletingAccount) {
      return;
    }

    setDeleteError(null);
    setIsDeleteModalVisible(false);
  }

  if (isLoading && !profile) {
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
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isAchievementsLoading}
            onRefresh={() => void handleRefresh({ bypassCache: true })}
            tintColor={theme.primary}
          />
        }>
        <TabScreenHeader title="Profile" />

        {error ? (
          <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
        ) : null}

        <ProfileHero
          displayName={displayName}
          username={username}
          equippedTitleName={equippedTitleName}
          level={profile?.level ?? xpProgress.level}
          coinBalance={profile?.coin_balance ?? 0}
          avatarUrl={profile?.avatar_url}
          showPremiumCrown={isPremium}
          onEdit={() => router.push('/profile/edit')}
        />

        <HomeSection title="Progress" subtitle="Level and streak at a glance">
          <HomeProgressBlock
            level={xpProgress.level}
            currentXp={xpProgress.currentLevelXp}
            targetXp={xpProgress.xpToNextLevel}
            streak={profile?.current_streak ?? 0}
          />
        </HomeSection>

        <HomeSection title="Stats" subtitle="Lifetime performance">
          <View style={styles.statsGrid}>
            <StatCard label="Push-ups" value={stats.totalPushUps.toLocaleString()} accentColor={theme.primary} />
            <StatCard label="Squats" value={stats.totalSquats.toLocaleString()} accentColor={theme.primary} />
            <StatCard label="Pull-ups" value={stats.totalPullUps.toLocaleString()} accentColor={theme.primary} />
            <StatCard label="Burpees" value={stats.totalBurpees.toLocaleString()} accentColor={theme.primary} />
            <StatCard label="Missions Done" value={stats.completedChallenges} />
          </View>
          <PrimaryButton
            label="View All Stats"
            variant="secondary"
            onPress={() => router.push('/profile/stats')}
          />
        </HomeSection>

        <ProfileAchievementSection
          achievements={achievements}
          unlockedCount={unlockedCount}
          isLoading={isAchievementsLoading}
          error={achievementsError}
          onViewAll={() => router.push('/profile/achievements')}
        />

        <ProfileQuickActions actions={quickActions} />

        {logoutError ? (
          <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{logoutError}</Text>
        ) : null}

        <PrimaryButton
          label="Log Out"
          variant="danger"
          loading={isLoggingOut}
          onPress={() => void handleLogout()}
        />

        <Pressable
          accessibilityRole="button"
          disabled={isLoggingOut || isDeletingAccount}
          onPress={openDeleteModal}
          style={({ pressed }) => [
            styles.deleteAccountButton,
            { opacity: pressed ? 0.7 : isLoggingOut || isDeletingAccount ? 0.5 : 1 },
          ]}>
          <Text style={[styles.deleteAccountLabel, { color: theme.danger }]}>Delete Account</Text>
        </Pressable>
      </ScrollView>

      <DeleteAccountModal
        visible={isDeleteModalVisible}
        isDeleting={isDeletingAccount}
        error={deleteError}
        onClose={closeDeleteModal}
        onConfirm={(reason) => void handleDeleteAccount(reason)}
      />
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
    gap: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteAccountButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  deleteAccountLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
