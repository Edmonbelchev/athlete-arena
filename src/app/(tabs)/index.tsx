import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ComingSoonBlock } from '@/components/home/ComingSoonBlock';
import { EarlyAccessNotice } from '@/components/home/EarlyAccessNotice';
import { FriendChallengesCarousel } from '@/components/home/FriendChallengesCarousel';
import { HomeProgressBlock } from '@/components/home/HomeProgressBlock';
import { HomeSection } from '@/components/home/HomeSection';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { DailySpinCard } from '@/components/spin/DailySpinCard';
import { ChallengeCard } from '@/components/ui/ChallengeCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAchievementUnlock } from '@/features/achievements/AchievementUnlockProvider';
import { useDailyChallenge } from '@/features/challenges/useDailyChallenge';
import { isActiveFriendChallenge } from '@/features/friends/friendChallengeGroups';
import { useFriendChallenges } from '@/features/friends/useFriendChallenges';
import { useChallengeNotificationRefresh } from '@/features/notifications/useChallengeNotificationRefresh';
import { useProfile } from '@/features/profile/useProfile';
import { useShop } from '@/features/shop/ShopProvider';
import { useDailySpin } from '@/features/spin/useDailySpin';
import { xpProgressInCurrentLevel } from '@/features/xp/levelUtils';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { getOrCreateDailyChallenge } from '@/services/challengeService';
import {
    acceptFriendChallenge,
    declineFriendChallenge,
} from '@/services/friendChallengeService';

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
    challenge,
    isLoading: isChallengeLoading,
    error: challengeError,
    refresh: refreshChallenge,
  } = useDailyChallenge();
  const {
    challenges: friendChallenges,
    isLoading: isFriendChallengesLoading,
    refresh: refreshFriendChallenges,
  } = useFriendChallenges();
  const [busyChallengeId, setBusyChallengeId] = useState<string | null>(null);
  const [isStartingDailyChallenge, setIsStartingDailyChallenge] = useState(false);
  const [friendActionError, setFriendActionError] = useState<string | null>(null);
  const { syncAndCelebrate } = useAchievementUnlock();
  const { refresh: refreshShop } = useShop();
  const { status: spinStatus, refresh: refreshSpin } = useDailySpin();

  const isLoading = isProfileLoading || isChallengeLoading || isFriendChallengesLoading;
  const error = profileError ?? challengeError ?? friendActionError;

  const displayName = profile?.display_name ?? profile?.username ?? 'Athlete';
  const totalXp = profile?.total_xp ?? 0;
  const currentStreak = profile?.current_streak ?? 0;
  const xpProgress = xpProgressInCurrentLevel(totalXp);
  const activeFriendChallenges = useMemo(
    () => friendChallenges.filter(isActiveFriendChallenge),
    [friendChallenges],
  );

  async function handleRefresh() {
    setFriendActionError(null);
    await Promise.all([
      refreshProfile(),
      refreshChallenge(),
      refreshFriendChallenges(),
      syncAndCelebrate().catch(() => []),
      refreshShop().catch(() => undefined),
      refreshSpin().catch(() => undefined),
    ]);
  }

  useChallengeNotificationRefresh(handleRefresh);

  async function handleStartDailyChallenge() {
    if (!challenge || isStartingDailyChallenge) {
      return;
    }

    setIsStartingDailyChallenge(true);
    setFriendActionError(null);

    try {
      const userChallenge =
        challenge.userChallengeId === null
          ? await getOrCreateDailyChallenge()
          : null;
      const challengeId = userChallenge?.id ?? challenge.userChallengeId;

      if (!challengeId) {
        throw new Error('Failed to start daily challenge');
      }

      router.push({
        pathname: '/challenge/[id]',
        params: { id: challengeId },
      });
    } catch (err) {
      setFriendActionError(formatUserError(err, 'Failed to start daily challenge'));
    } finally {
      setIsStartingDailyChallenge(false);
    }
  }

  async function handleAcceptFriendChallenge(participantId: string) {
    setBusyChallengeId(participantId);
    setFriendActionError(null);
    try {
      await acceptFriendChallenge(participantId);
      router.push({
        pathname: '/challenge/friend/[participantId]',
        params: { participantId },
      });
    } catch (err) {
      setFriendActionError(formatUserError(err, 'Failed to accept challenge'));
    } finally {
      setBusyChallengeId(null);
    }
  }

  async function handleDeclineFriendChallenge(participantId: string) {
    setBusyChallengeId(participantId);
    setFriendActionError(null);
    try {
      await declineFriendChallenge(participantId);
      await refreshFriendChallenges();
    } catch (err) {
      setFriendActionError(formatUserError(err, 'Failed to decline challenge'));
    } finally {
      setBusyChallengeId(null);
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

        <EarlyAccessNotice />

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
          />
        </HomeSection>

        <HomeSection
          title="Today's Challenge"
          subtitle="Same workout for everyone today - complete it for XP and coins">
          {challenge ? (
            <ChallengeCard
              exerciseType={challenge.exerciseType}
              targetReps={challenge.targetReps}
              xpReward={challenge.xpReward}
              status={challenge.status === 'not_started' ? 'pending' : challenge.status}
              completedReps={challenge.completedReps}
              loading={isStartingDailyChallenge}
              onStart={() => void handleStartDailyChallenge()}
            />
          ) : (
            <View
              style={StyleSheet.flatten([
                styles.placeholderCard,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ])}>
              <Text style={StyleSheet.flatten([styles.placeholderText, { color: theme.textSecondary }])}>
                No daily challenge available right now.
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

        <HomeSection
          title="Friend Races"
          subtitle="View active speed races by friend"
          badge={activeFriendChallenges.length > 0 ? activeFriendChallenges.length : undefined}
          actionLabel="View all"
          onAction={() => router.push('/(tabs)/challenges')}>
          <FriendChallengesCarousel
            challenges={activeFriendChallenges}
            busyChallengeId={busyChallengeId}
            onAccept={(participantId) => void handleAcceptFriendChallenge(participantId)}
            onDecline={(participantId) => void handleDeclineFriendChallenge(participantId)}
          />
        </HomeSection>

        <HomeSection title="More Ways to Play" subtitle="New features landing soon">
          <View style={styles.comingSoonList}>
            <ComingSoonBlock
              title="Shop"
              description="Spend coins on emotes, avatars, and profile frames."
              icon="gift"
              accentColor={theme.primary}
            />
            <ComingSoonBlock
              title="Weekly Quiz"
              description="Test your fitness knowledge and earn bonus XP every week."
              icon="quiz"
              accentColor={theme.accent}
            />
          </View>
        </HomeSection>
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
  comingSoonList: {
    gap: Spacing.two,
  },
});
