import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraPreview } from '@/components/CameraPreview';
import { PoseGuidanceBanner } from '@/components/PoseGuidanceBanner';
import { EmoteDisplay } from '@/components/shop/EmoteDisplay';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatExerciseLabel } from '@/constants/challenges';
import {
  formatXpAndCoins,
  getFriendChallengeCoinReward,
} from '@/constants/coins';
import { formatRaceTime, formatRaceTimeLimit } from '@/constants/friendChallenges';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useExercisePoseDetection } from '@/features/challenges/useExercisePoseDetection';
import { useRepCounter } from '@/features/challenges/useRepCounter';
import { useAuth } from '@/features/auth';
import { useFriendChallenge } from '@/features/friends/useFriendChallenge';
import { useFriendChallengeRaceTimer } from '@/features/friends/useFriendChallengeRaceTimer';
import { useShop } from '@/features/shop/ShopProvider';
import {
  completeFriendChallenge,
  startFriendChallenge,
} from '@/services/friendChallengeService';
import {
  didIWinFriendChallenge,
  getOpponentDisplayName,
  getOpponentRaceSeconds,
  hasFriendChallengeStarted,
  isFriendChallengeResolved,
  isFriendChallengeWaitingOnOpponent,
  type FriendChallenge,
} from '@/types/friends';
import { formatUserError } from '@/lib/errors';
import { supportsNativePoseDetection } from '@/lib/runtime';
import { useTheme } from '@/hooks/use-theme';

export default function FriendChallengeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { participantId } = useLocalSearchParams<{ participantId: string }>();
  const { challenge, isLoading, error, refresh } = useFriendChallenge(participantId);
  const { equippedEmote } = useShop();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [hasStartedAttempt, setHasStartedAttempt] = useState(false);
  const isSyncingRef = useRef(false);
  const challengeRef = useRef(challenge);

  challengeRef.current = challenge;

  const isCompleted = challenge?.status === 'completed';
  const isPending = challenge?.status === 'pending';
  const isExpired = challenge?.status === 'expired' || isTimedOut;
  const isResolved = challenge ? isFriendChallengeResolved(challenge) : false;
  const waitingOnOpponent = challenge ? isFriendChallengeWaitingOnOpponent(challenge) : false;
  const targetReps = challenge?.targetReps ?? 0;
  const raceStarted = challenge ? hasFriendChallengeStarted(challenge) : false;
  const myUserId = session?.user.id ?? '';

  const handleTimerExpire = useCallback(() => {
    setIsTimedOut(true);
    void refresh({ silent: true });
  }, [refresh]);

  const { elapsedSeconds, secondsRemaining } = useFriendChallengeRaceTimer({
    startedAt: challenge?.startedAt ?? null,
    completedAt: challenge?.completedAt ?? null,
    maxSeconds: challenge?.timeLimitSeconds ?? null,
    enabled: raceStarted && !isPending,
    onExpire: handleTimerExpire,
  });

  const handleRepDetected = useCallback(
    async (repCount: number) => {
      const activeChallenge = challengeRef.current;
      if (
        !activeChallenge ||
        !participantId ||
        activeChallenge.status === 'completed' ||
        activeChallenge.status === 'pending' ||
        activeChallenge.status === 'expired' ||
        isTimedOut ||
        isSyncingRef.current
      ) {
        return;
      }

      isSyncingRef.current = true;
      setIsSyncing(true);
      setSyncError(null);

      try {
        await completeFriendChallenge(participantId, repCount);
        await refresh({ silent: true });
      } catch (err) {
        setSyncError(formatUserError(err, 'Failed to sync repetition'));
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [participantId, refresh, isTimedOut],
  );

  const canAttempt =
    Boolean(challenge) && !isCompleted && !isPending && !isExpired && !waitingOnOpponent;

  const repCounter = useRepCounter({
    targetReps,
    initialReps: challenge?.completedReps ?? 0,
    enabled: canAttempt && raceStarted,
    onRepDetected: (repCount) => {
      void handleRepDetected(repCount);
    },
  });

  const { phase: posePhase, trackingMessage, processLandmarks } = useExercisePoseDetection({
    exerciseType: challenge?.exerciseType ?? 'push_ups',
    enabled: canAttempt && raceStarted,
    onRepDetected: () => {
      repCounter.simulateRep();
    },
  });

  const progress = targetReps > 0 ? Math.min(repCounter.currentReps / targetReps, 1) : 0;
  const autoRepCounting = Platform.OS === 'web' || supportsNativePoseDetection();
  const showSimulateButton = canAttempt && raceStarted && !autoRepCounting;

  async function handleCameraReady() {
    if (!participantId || hasStartedAttempt) {
      repCounter.start();
      return;
    }

    setHasStartedAttempt(true);
    setSyncError(null);

    try {
      await startFriendChallenge(participantId);
      await refresh({ silent: true });
      repCounter.start();
    } catch (err) {
      setSyncError(formatUserError(err, 'Failed to start challenge timer'));
      setHasStartedAttempt(false);
    }
  }

  if (isLoading) {
    return (
      <View style={StyleSheet.flatten([styles.loading, { backgroundColor: theme.background }])}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (error || !challenge) {
    return (
      <SafeAreaView style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
        <View style={styles.container}>
          <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>
            {error ?? 'Challenge not found'}
          </Text>
          <PrimaryButton label="Go Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const opponentName = getOpponentDisplayName(challenge);
  const myTime = isCompleted || waitingOnOpponent ? elapsedSeconds : raceStarted ? elapsedSeconds : null;
  const opponentTime = getOpponentRaceSeconds(challenge);
  const winResult = didIWinFriendChallenge(challenge, myUserId);
  const earnedXp = challenge.xpEarned ?? 0;
  const earnedCoins = getFriendChallengeCoinReward(
    challenge.resolvedAt,
    challenge.winnerUserId,
    myUserId,
  );

  function formatEarnedRewards(xp: number): string {
    if (earnedCoins > 0) {
      return `${formatXpAndCoins(xp, earnedCoins)} earned`;
    }

    return `+${xp} XP earned`;
  }

  function renderRaceTimer(activeChallenge: FriendChallenge) {
    if (isPending || !raceStarted) {
      return null;
    }

    if (isExpired) {
      return (
        <View style={[styles.timerBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.danger }]}>
          <Text style={[styles.timerText, { color: theme.danger }]}>Time cap reached</Text>
        </View>
      );
    }

    return (
      <View style={[styles.timerBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.streak }]}>
        <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>YOUR TIME</Text>
        <Text style={[styles.timerText, { color: theme.streak }]}>{formatRaceTime(elapsedSeconds)}</Text>
        {activeChallenge.timeLimitSeconds ? (
          <Text style={[styles.timerMeta, { color: theme.textSecondary }]}>
            {formatRaceTimeLimit(activeChallenge.timeLimitSeconds)} · {formatRaceTime(secondsRemaining)} left
          </Text>
        ) : (
          <Text style={[styles.timerMeta, { color: theme.textSecondary }]}>Fastest to finish wins</Text>
        )}
      </View>
    );
  }

  function renderCompletionBanner() {
    if (waitingOnOpponent) {
      return (
        <View style={[styles.completedBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.primary }]}>
          <Text style={[styles.completedTitle, { color: theme.primary }]}>FINISHED IN {formatRaceTime(myTime)}</Text>
          <Text style={[styles.opponentProgress, { color: theme.textSecondary }]}>
            Waiting for {opponentName} to finish…
          </Text>
        </View>
      );
    }

    if (!isCompleted) {
      return null;
    }

    if (isResolved && winResult !== null) {
      return (
        <View
          style={[
            styles.completedBanner,
            { backgroundColor: theme.backgroundElement, borderColor: winResult ? theme.success : theme.danger },
          ]}>
          <Text style={[styles.completedTitle, { color: winResult ? theme.success : theme.danger }]}>
            {winResult ? 'YOU WON THE RACE' : 'YOU LOST THE RACE'}
          </Text>
          {winResult ? <EmoteDisplay emoji={equippedEmote} /> : null}
          <Text style={[styles.completedReward, { color: theme.xp }]}>{formatEarnedRewards(earnedXp)}</Text>
          <Text style={[styles.opponentProgress, { color: theme.textSecondary }]}>
            You {formatRaceTime(myTime)} · {opponentName} {formatRaceTime(opponentTime)}
          </Text>
        </View>
      );
    }

    if (isResolved && winResult === null) {
      return (
        <View style={[styles.completedBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.success }]}>
          <Text style={[styles.completedTitle, { color: theme.success }]}>TIE RACE</Text>
          <Text style={[styles.completedReward, { color: theme.xp }]}>{formatEarnedRewards(earnedXp)}</Text>
          <Text style={[styles.opponentProgress, { color: theme.textSecondary }]}>
            Both finished in {formatRaceTime(myTime)}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.completedBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.success }]}>
        <Text style={[styles.completedTitle, { color: theme.success }]}>CHALLENGE COMPLETE</Text>
        <EmoteDisplay emoji={equippedEmote} />
        <Text style={[styles.completedReward, { color: theme.xp }]}>+{earnedXp} XP earned</Text>
        <Text style={[styles.opponentProgress, { color: theme.textSecondary }]}>
          {opponentName}: {challenge.opponentCompletedReps}/{challenge.targetReps} reps
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Friend Challenge', headerShown: true }} />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        <View style={styles.container}>
          <Text style={StyleSheet.flatten([styles.exercise, { color: theme.textSecondary }])}>
            Speed race vs {opponentName} · {formatExerciseLabel(challenge.exerciseType, true)}
          </Text>
          {challenge.creatorEmoteEmoji && !challenge.isCreator ? (
            <View style={styles.creatorEmoteRow}>
              <Text style={StyleSheet.flatten([styles.creatorEmoteLabel, { color: theme.textSecondary }])}>
                Challenge emote
              </Text>
              <EmoteDisplay emoji={challenge.creatorEmoteEmoji} size="sm" />
            </View>
          ) : null}
          <Text style={StyleSheet.flatten([styles.reps, { color: theme.text }])}>
            {repCounter.currentReps} / {challenge.targetReps}
          </Text>

          {renderRaceTimer(challenge)}

          {isPending ? (
            <Text style={StyleSheet.flatten([styles.pending, { color: theme.textSecondary }])}>
              Accept this challenge from the Friends tab before starting.
            </Text>
          ) : isExpired ? (
            <Text style={StyleSheet.flatten([styles.pending, { color: theme.danger }])}>
              You hit the time cap before finishing. Head back and try again.
            </Text>
          ) : waitingOnOpponent || isCompleted ? (
            renderCompletionBanner()
          ) : (
            <>
              <CameraPreview
                active={canAttempt}
                onCameraReady={() => {
                  void handleCameraReady();
                }}
                onLandmarksDetected={processLandmarks}
              />

              {!raceStarted ? (
                <Text style={StyleSheet.flatten([styles.pending, { color: theme.textSecondary }])}>
                  Camera ready — your race timer starts now.
                </Text>
              ) : null}

              <PoseGuidanceBanner exerciseType={challenge.exerciseType} />

              {autoRepCounting ? (
                <>
                  <Text style={StyleSheet.flatten([styles.phaseLabel, { color: theme.textSecondary }])}>
                    Phase: {posePhase}
                    {trackingMessage ? '' : ' · counting'}
                  </Text>
                  {trackingMessage ? (
                    <Text style={StyleSheet.flatten([styles.trackingMessage, { color: theme.streak }])}>
                      {trackingMessage}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </>
          )}

          <View style={StyleSheet.flatten([styles.progressTrack, { backgroundColor: theme.backgroundSelected }])}>
            <View
              style={StyleSheet.flatten([
                styles.progressFill,
                { backgroundColor: theme.primary, width: `${progress * 100}%` },
              ])}
            />
          </View>

          {showSimulateButton ? (
            <PrimaryButton
              label="+ Simulate Rep"
              variant="secondary"
              disabled={repCounter.isComplete || isSyncing}
              loading={isSyncing}
              onPress={repCounter.simulateRep}
            />
          ) : null}

          {syncError ? (
            <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{syncError}</Text>
          ) : null}

          <PrimaryButton
            label={isCompleted || waitingOnOpponent ? 'Done' : 'Cancel'}
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
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
  container: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  exercise: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  reps: {
    fontSize: 48,
    fontWeight: '900',
    textAlign: 'center',
  },
  timerBanner: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  timerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timerText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  timerMeta: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  pending: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  phaseLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  trackingMessage: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  progressTrack: {
    height: 12,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.sm,
  },
  completedBanner: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  completedTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  completedReward: {
    fontSize: 18,
    fontWeight: '800',
  },
  opponentProgress: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  creatorEmoteRow: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  creatorEmoteLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
