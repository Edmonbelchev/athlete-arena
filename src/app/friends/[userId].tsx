import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StatCard } from '@/components/ui/StatCard';
import { XPProgressBar } from '@/components/ui/XPProgressBar';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useFriendProfile } from '@/features/friends/useFriendProfile';
import { xpProgressInCurrentLevel } from '@/features/xp/levelUtils';
import { leaveScreen } from '@/lib/navigation';
import { useTheme } from '@/hooks/use-theme';

export default function FriendProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { userId, username } = useLocalSearchParams<{ userId: string; username?: string }>();
  const { profile, isLoading, error, refresh } = useFriendProfile(userId);

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
          <PrimaryButton label="Try Again" variant="secondary" onPress={() => void refresh()} />
        </View>
      </>
    );
  }

  const displayName = profile.displayName ?? profile.username;
  const xpProgress = xpProgressInCurrentLevel(profile.totalXp);

  return (
    <>
      <Stack.Screen options={headerOptions} />
      <SafeAreaView
        edges={['bottom']}
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
        <ScrollView contentContainerStyle={styles.content}>
          <ProfileAvatar
            uri={profile.avatarUrl}
            name={displayName}
            size={112}
            shopAvatar={profile.avatar}
            frame={profile.frame}
          />

          <Text style={StyleSheet.flatten([styles.username, { color: theme.text }])}>@{profile.username}</Text>
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
              value={`${profile.currentStreak} days`}
              accentColor={theme.streak}
            />
            <StatCard label="Longest Streak" value={`${profile.longestStreak} days`} />
            <StatCard label="Total XP" value={profile.totalXp.toLocaleString()} accentColor={theme.xp} />
            <StatCard label="Level" value={profile.level} accentColor={theme.primary} />
          </View>

          <PrimaryButton
            label="Challenge Friend"
            onPress={() =>
              router.push({
                pathname: '/friends/challenge/create',
                params: { friendId: profile.userId, username: profile.username },
              })
            }
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
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'center',
    paddingBottom: Spacing.six,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    alignSelf: 'stretch',
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
