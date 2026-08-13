import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ComingSoonBlock } from '@/components/home/ComingSoonBlock';
import { DailyMissionsCarousel } from '@/components/home/DailyMissionsCarousel';
import { EarlyAccessNotice } from '@/components/home/EarlyAccessNotice';
import { HomeLinkBlock } from '@/components/home/HomeLinkBlock';
import { HomeProgressBlock } from '@/components/home/HomeProgressBlock';
import { HomeSection } from '@/components/home/HomeSection';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { DailySpinCard } from '@/components/spin/DailySpinCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAchievementUnlock } from '@/features/achievements/AchievementUnlockProvider';
import { useDailyChallenge } from '@/features/challenges/useDailyChallenge';
import { isActiveFriendChallenge } from '@/features/friends/friendChallengeGroups';
import { useFriendChallenges } from '@/features/friends/useFriendChallenges';
import { useUserGoals } from '@/features/goals/useUserGoals';
import { useChallengeNotificationRefresh } from '@/features/notifications/useChallengeNotificationRefresh';
import { useProfile } from '@/features/profile/useProfile';
import { useShop } from '@/features/shop/ShopProvider';
import { useDailySpin } from '@/features/spin/useDailySpin';
import { useWeeklyMissionStreak } from '@/features/streaks/useWeeklyMissionStreak';
import { xpProgressInCurrentLevel } from '@/features/xp/levelUtils';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { getOrCreateDailyChallenge, resolveMissionIndex } from '@/services/challengeService';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const theme = useTheme();
  const { profile, isLoading: isProfileLoading, error: profileError, refresh: refreshProfile } =
    useProfile();
  const {
    missions,
    isLoading: isChallengeLoading,
    error: challengeError,
    refresh: refreshChallenge,
  } = useDailyChallenge();
  const { challenges: friendChallenges, refresh: refreshFriendChallenges } = useFriendChallenges();
  const { goals: userGoals, refresh: refreshGoals } = useUserGoals();
  const [startingMissionIndex, setStartingMissionIndex] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { syncAndCelebrate } = useAchievementUnlock();
  const { refresh: refreshShop } = useShop();
  const { status: spinStatus, refresh: refreshSpin } = useDailySpin();
  const { weeklyStreak, refresh: refreshWeeklyStreak } = useWeeklyMissionStreak();

  const isLoading = isProfileLoading || isChallengeLoading;
  const error = profileError ?? challengeError ?? actionError;

  const displayName = profile?.display_name ?? profile?.username ?? 'Athlete';
  const totalXp = profile?.total_xp ?? 0;
  const currentStreak = profile?.current_streak ?? 0;
  const xpProgress = xpProgressInCurrentLevel(totalXp);

  const activeFriendChallengeCount = useMemo(
    () => friendChallenges.filter(isActiveFriendChallenge).length,
    [friendChallenges],
  );

  const activeGoalCount = useMemo(
    () => userGoals.filter((goal) => goal.status === 'active').length,
    [userGoals],
  );

  async function handleRefresh() {
    setActionError(null);
    await Promise.all([
      refreshProfile(),
      refreshChallenge(),
      refreshFriendChallenges(),
      refreshGoals(),
      refreshWeeklyStreak(),
      syncAndCelebrate().catch(() => []),
      refreshShop().catch(() => undefined),
      refreshSpin().catch(() => undefined),
    ]);
  }

  useChallengeNotificationRefresh(handleRefresh);

  async function handleStartDailyMission(mission: (typeof missions)[number], listIndex: number) {
    if (startingMissionIndex !== null) {
      return;
    }

    const missionIndex = resolveMissionIndex(mission.exerciseType, mission.missionIndex, listIndex);

    setStartingMissionIndex(missionIndex);
    setActionError(null);

    try {
      const userChallenge =
        mission.userChallengeId === null
          ? await getOrCreateDailyChallenge(missionIndex)
          : null;
      const challengeId = userChallenge?.id ?? mission.userChallengeId;

      if (!challengeId) {
        throw new Error('Failed to start daily mission');
      }

      router.push({
        pathname: '/challenge/[id]',
        params: { id: challengeId },
      });
    } catch (err) {
      setActionError(formatUserError(err, 'Failed to start daily mission'));
    } finally {
      setStartingMissionIndex(null);
    }
  }

  useFocusEffect(
    useCallback(() => {
      void handleRefresh();
    }, [refreshProfile, refreshChallenge]),
  );

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TabScreenHeader subtitle={getGreeting()} title={displayName} />

        {error ? (
          <View style={styles.errorBlock}>
            <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
            <PrimaryButton label="Try Again" variant="secondary" onPress={() => void handleRefresh()} />
          </View>
        ) : null}

        <HomeSection title="Your Progress" subtitle="Level up and keep your streak alive">
          <HomeProgressBlock
            level={xpProgress.level}
            currentXp={xpProgress.currentLevelXp}
            targetXp={xpProgress.xpToNextLevel}
            streak={currentStreak}
            weeklyStreak={weeklyStreak}
          />
        </HomeSection>

        <HomeSection
          title="Daily Missions"
          subtitle="Three exercises today - complete all three to keep your streak alive">
          {missions.length > 0 ? (
            <DailyMissionsCarousel
              missions={missions}
              startingMissionIndex={startingMissionIndex}
              onStartMission={(mission, index) => void handleStartDailyMission(mission, index)}
            />
          ) : (
            <View
              style={StyleSheet.flatten([
                styles.placeholderCard,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ])}>
              <Text style={StyleSheet.flatten([styles.placeholderText, { color: theme.textSecondary }])}>
                No daily missions available right now.
              </Text>
            </View>
          )}
        </HomeSection>

        <HomeSection title="Daily Spin" subtitle="One free spin every day">
          <DailySpinCard
            canSpin={Boolean(spinStatus?.canSpin)}
            multiplierActive={(spinStatus?.coinMultiplier ?? 1) > 1}
            multiplierExpiresAt={spinStatus?.coinMultiplierExpiresAt ?? null}
            nextSpinAt={spinStatus?.nextSpinAt ?? null}
            onPress={() => router.push('/spin')}
          />
        </HomeSection>

        <HomeSection title="Keep Going" subtitle="More ways to train and track">
          <View style={styles.linkBlocks}>
            <HomeLinkBlock
              title="Personal Goals"
              description="Set daily and weekly rep targets"
              icon="target"
              accentColor={theme.primary}
              badge={activeGoalCount}
              onPress={() => router.push('/profile/goals')}
            />
            <HomeLinkBlock
              title="Challenge Friends"
              description="Race a friend to the finish"
              icon="swords"
              accentColor={theme.streak}
              badge={activeFriendChallengeCount}
              onPress={() => router.push('/(tabs)/challenges')}
            />
          </View>
        </HomeSection>

        <HomeSection title="More Ways to Play" subtitle="New features landing soon">
          <View style={styles.comingSoonList}>
            <ComingSoonBlock
              key="shop"
              title="Shop"
              description="Spend coins on emotes, avatars, and profile frames."
              icon="gift"
              accentColor={theme.primary}
            />
            <ComingSoonBlock
              key="weekly-quiz"
              title="Weekly Quiz"
              description="Test your fitness knowledge and earn bonus XP every week."
              icon="quiz"
              accentColor={theme.accent}
            />
          </View>
        </HomeSection>

        <EarlyAccessNotice />
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
  errorBlock: {
    gap: Spacing.two,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  placeholderCard: {
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  linkBlocks: {
    gap: Spacing.two,
  },
  comingSoonList: {
    gap: Spacing.two,
  },
});
