import { router, useFocusEffect } from 'expo-router';
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

import { HomeProgressBlock } from '@/components/home/HomeProgressBlock';
import { HomeSection } from '@/components/home/HomeSection';
import { ProfileAchievementSection } from '@/components/profile/ProfileAchievementSection';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileQuickActions } from '@/components/profile/ProfileQuickActions';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StatCard } from '@/components/ui/StatCard';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAchievements } from '@/features/achievements/useAchievements';
import { getAuthErrorMessage } from '@/features/auth/authErrors';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile/useProfile';
import { useProfileStats } from '@/features/profile/useProfileStats';
import { useShop } from '@/features/shop/ShopProvider';
import { xpProgressInCurrentLevel } from '@/features/xp/levelUtils';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const { session, signOut } = useAuth();
  const { profile, isLoading: isProfileLoading, error: profileError, refresh: refreshProfile } =
    useProfile();
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
  } = useAchievements({ syncOnLoad: false });
  const { summary, equippedAvatar, equippedFrame, refresh: refreshShop } = useShop();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isLoading = isProfileLoading || isStatsLoading;
  const error = profileError ?? statsError;

  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshProfile(), refreshStats(), refreshShop(), refreshAchievements()]);
  }, [refreshProfile, refreshStats, refreshShop, refreshAchievements]);

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
      { id: 'shop', label: 'Shop', icon: 'gift' as const, onPress: () => router.push('/profile/shop') },
      {
        id: 'achievements',
        label: 'Achievements',
        icon: 'medal' as const,
        onPress: () => router.push('/profile/achievements'),
      },
      {
        id: 'history',
        label: 'History',
        icon: 'history' as const,
        onPress: () => router.push('/profile/history'),
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
            onRefresh={() => void handleRefresh()}
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
          level={profile?.level ?? xpProgress.level}
          coinBalance={summary.coinBalance}
          avatarUrl={profile?.avatar_url}
          shopAvatar={equippedAvatar}
          frame={equippedFrame}
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
            <StatCard label="Total XP" value={totalXp.toLocaleString()} accentColor={theme.xp} />
            <StatCard label="Level" value={profile?.level ?? xpProgress.level} accentColor={theme.primary} />
            <StatCard
              label="Current Streak"
              value={`${profile?.current_streak ?? 0} days`}
              accentColor={theme.streak}
            />
            <StatCard label="Longest Streak" value={`${profile?.longest_streak ?? 0} days`} />
            <StatCard label="Challenges Done" value={stats.completedChallenges} />
            <StatCard label="Push-ups" value={stats.totalPushUps.toLocaleString()} />
            <StatCard label="Squats" value={stats.totalSquats.toLocaleString()} />
            <StatCard label="Pull-ups" value={stats.totalPullUps.toLocaleString()} />
            <StatCard label="Dips" value={stats.totalDips.toLocaleString()} />
          </View>
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
});
