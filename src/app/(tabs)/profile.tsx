import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { StatCard } from '@/components/ui/StatCard';
import { XPProgressBar } from '@/components/ui/XPProgressBar';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getAuthErrorMessage } from '@/features/auth/authErrors';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile/useProfile';
import { useProfileStats } from '@/features/profile/useProfileStats';
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
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isLoading = isProfileLoading || isStatsLoading;
  const error = profileError ?? statsError;

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      void refreshStats();
    }, [refreshProfile, refreshStats]),
  );

  const username = profile?.username ?? session?.user.email?.split('@')[0] ?? 'user';
  const displayName = profile?.display_name ?? username;
  const totalXp = profile?.total_xp ?? 0;
  const xpProgress = xpProgressInCurrentLevel(totalXp);

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

  if (isLoading) {
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
        <TabScreenHeader title="Profile" />

        <ProfileAvatar uri={profile?.avatar_url} name={displayName} size={96} />

        <Text style={StyleSheet.flatten([styles.username, { color: theme.text }])}>@{username}</Text>
        <Text style={StyleSheet.flatten([styles.displayName, { color: theme.textSecondary }])}>
          {displayName}
        </Text>

        {error ? (
          <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
        ) : null}

        <XPProgressBar
          level={xpProgress.level}
          currentXp={xpProgress.currentLevelXp}
          targetXp={xpProgress.xpToNextLevel}
        />

        <View style={styles.statsGrid}>
          <StatCard
            label="Current Streak"
            value={`${profile?.current_streak ?? 0} days`}
            accentColor={theme.streak}
          />
          <StatCard label="Longest Streak" value={`${profile?.longest_streak ?? 0} days`} />
          <StatCard label="Challenges Done" value={stats.completedChallenges} />
          <StatCard label="Total XP" value={totalXp.toLocaleString()} accentColor={theme.xp} />
          <StatCard label="Push-ups" value={stats.totalPushUps.toLocaleString()} />
          <StatCard label="Squats" value={stats.totalSquats.toLocaleString()} />
        </View>

        <PrimaryButton
          label="Challenge History"
          variant="secondary"
          onPress={() => router.push('/profile/history')}
        />

        <PrimaryButton
          label="Edit Profile"
          variant="secondary"
          onPress={() => router.push('/profile/edit')}
        />

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
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'center',
  },
  username: {
    fontSize: 20,
    fontWeight: '800',
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    alignSelf: 'stretch',
  },
});
