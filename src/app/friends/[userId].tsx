import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendAchievementSection } from '@/components/profile/FriendAchievementSection';
import { FriendProfileHero } from '@/components/profile/FriendProfileHero';
import { HomeProgressBlock } from '@/components/home/HomeProgressBlock';
import { HomeSection } from '@/components/home/HomeSection';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StatCard } from '@/components/ui/StatCard';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useFriendAchievements } from '@/features/friends/useFriendAchievements';
import { useFriendProfile } from '@/features/friends/useFriendProfile';
import { xpProgressInCurrentLevel } from '@/features/xp/levelUtils';
import { leaveScreen } from '@/lib/navigation';
import { useTheme } from '@/hooks/use-theme';

export default function FriendProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { userId, username } = useLocalSearchParams<{ userId: string; username?: string }>();
  const { profile, isLoading, error, refresh } = useFriendProfile(userId);
  const {
    achievements,
    isLoading: isAchievementsLoading,
    error: achievementsError,
    refresh: refreshAchievements,
  } = useFriendAchievements(userId);

  const headerOptions = {
    title: profile?.displayName ?? profile?.username ?? username ?? 'Friend',
    headerShown: true,
    headerBackVisible: false,
    headerLeft: () => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => leaveScreen(router, '/(tabs)/friends')}
        style={styles.headerBack}>
        <AppIcon name="chevronBack" size={22} color={theme.text} />
      </Pressable>
    ),
  } as const;

  async function handleRefresh() {
    await Promise.all([refresh(), refreshAchievements()]);
  }

  function handleChallenge() {
    if (!profile) {
      return;
    }

    router.push({
      pathname: '/friends/challenge/create',
      params: { friendId: profile.userId, username: profile.username },
    });
  }

  if (isLoading && !profile) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <View style={StyleSheet.flatten([styles.loading, { backgroundColor: theme.background }])}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <View style={StyleSheet.flatten([styles.loading, { backgroundColor: theme.background }])}>
          <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>
            {error ?? 'Friend profile not found.'}
          </Text>
          <PrimaryButton label="Try Again" variant="secondary" onPress={() => void handleRefresh()} />
        </View>
      </>
    );
  }

  const xpProgress = xpProgressInCurrentLevel(profile.totalXp);

  return (
    <>
      <Stack.Screen options={headerOptions} />
      <SafeAreaView
        edges={['bottom']}
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
          {error ? (
            <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
          ) : null}

          <FriendProfileHero profile={profile} onChallenge={handleChallenge} />

          <HomeSection title="Progress" subtitle="Level and streak at a glance">
            <HomeProgressBlock
              level={xpProgress.level}
              currentXp={xpProgress.currentLevelXp}
              targetXp={xpProgress.xpToNextLevel}
              streak={profile.currentStreak}
            />
          </HomeSection>

          <HomeSection title="Stats" subtitle="Lifetime performance">
            <View style={styles.statsGrid}>
              <StatCard
                label="Total XP"
                value={profile.totalXp.toLocaleString()}
                accentColor={theme.xp}
              />
              <StatCard label="Level" value={profile.level} accentColor={theme.primary} />
              <StatCard
                label="Current Streak"
                value={`${profile.currentStreak} days`}
                accentColor={theme.streak}
              />
              <StatCard label="Longest Streak" value={`${profile.longestStreak} days`} />
            </View>
          </HomeSection>

          <FriendAchievementSection
            achievements={achievements}
            isLoading={isAchievementsLoading}
            error={achievementsError}
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
    padding: Spacing.four,
    gap: Spacing.three,
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
  headerBack: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
