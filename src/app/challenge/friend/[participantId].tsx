import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraPreview } from '@/components/CameraPreview';
import {
  FriendChallengeCompleteOverlay,
  type FriendChallengeCompleteVariant,
} from '@/components/challenges/FriendChallengeCompleteOverlay';
import { PoseGuidanceBanner } from '@/components/PoseGuidanceBanner';
import { EmoteDisplay } from '@/components/shop/EmoteDisplay';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatExerciseLabel } from '@/constants/challenges';
import {
  getFriendChallengeCoinReward,
} from '@/constants/coins';
import { formatRaceTime, formatRaceTimeLimit, FRIEND_RACE_TIMER_START_HINT } from '@/constants/friendChallenges';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useExercisePoseDetection } from '@/features/challenges/useExercisePoseDetection';
import { useRepCounter } from '@/features/challenges/useRepCounter';
import { useAuth } from '@/features/auth';
import { useFriendChallenge } from '@/features/friends/useFriendChallenge';
import { useFriendChallengeRaceTimer } from '@/features/friends/useFriendChallengeRaceTimer';
import { useProfile } from '@/features/profile/useProfile';
import { useShop } from '@/features/shop/ShopProvider';
import {
  acceptFriendChallenge,
  completeFriendChallenge,
  declineFriendChallenge,
} from '@/services/friendChallengeService';
import {
  didIWinFriendChallenge,
  getCreatorDisplayName,
  getOpponentDisplayName,
  getOpponentRaceSeconds,
  hasFriendChallengeStarted,
  isFriendChallengeResolved,
  isFriendChallengeWaitingOnOpponent,
  type FriendChallenge,
} from '@/types/friends';
import { formatUserError } from '@/lib/errors';
import { supportsNativePoseDetection } from '@/lib/runtime';
import { useDrainNativeCameraOnLeave } from '@/hooks/use-drain-native-camera-on-leave';
import { useTheme } from '@/hooks/use-theme';

function getFriendChallengeOverlayVariant(
  waitingOnOpponent: boolean,
  isCompleted: boolean,
  isResolved: boolean,
  winResult: boolean | null,
): FriendChallengeCompleteVariant | null {
  if (waitingOnOpponent) {
    return 'finished';
  }

  if (!isCompleted || !isResolved) {
    return null;
  }

  if (winResult === true) {
    return 'winner';
  }

  if (winResult === false) {
    return 'lost';
  }

  return 'tie';
}

export default function FriendChallengeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { participantId } = useLocalSearchParams<{ participantId: string }>();
  const { challenge, isLoading, error, refresh } = useFriendChallenge(participantId);
  const { equippedEmote } = useShop();
  const { refresh: refreshProfile } = useProfile();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPendingAction, setIsPendingAction] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const cameraActive = useDrainNativeCameraOnLeave();
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

  const handleAcceptChallenge = useCallback(async () => {
    if (!participantId) {
      return;
    }

    setIsPendingAction(true);
    setSyncError(null);

    try {
      await acceptFriendChallenge(participantId);
      await refresh({ silent: true });
    } catch (err) {
      setSyncError(formatUserError(err, 'Failed to accept challenge'));
    } finally {
      setIsPendingAction(false);
    }
  }, [participantId, refresh]);

  const handleDeclineChallenge = useCallback(async () => {
    if (!participantId) {
      return;
    }

    setIsPendingAction(true);
    setSyncError(null);

    try {
      await declineFriendChallenge(participantId);
      router.back();
    } catch (err) {
      setSyncError(formatUserError(err, 'Failed to decline challenge'));
      setIsPendingAction(false);
    }
  }, [participantId, router]);

  const { elapsedSeconds, secondsRemaining } = useFriendChallengeRaceTimer({
    startedAt: challenge?.startedAt ?? null,
    completedAt: challenge?.completedAt ?? null,
    maxSeconds: challenge?.timeLimitSeconds ?? null,
    enabled: raceStarted && !isPending,
    onExpire: handleTimerExpire,
  });

  useEffect(() => {
    if (!waitingOnOpponent) {
      return;
    }

    const intervalId = setInterval(() => {
      void refresh({ silent: true });
    }, 4000);

    return () => clearInterval(intervalId);
  }, [waitingOnOpponent, refresh]);

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
        void refreshProfile();
      } catch (err) {
        setSyncError(formatUserError(err, 'Failed to sync repetition'));
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [participantId, refresh, refreshProfile, isTimedOut],
  );

  const canAttempt =
    Boolean(challenge) && !isCompleted && !isPending && !isExpired && !waitingOnOpponent;

  const repCounter = useRepCounter({
    targetReps,
    initialReps: challenge?.completedReps ?? 0,
    enabled: canAttempt,
    onRepDetected: (repCount) => {
      void handleRepDetected(repCount);
    },
  });

  const {
    phase: posePhase,
    trackingStatus,
    pullUpBarLineY,
    processLandmarks,
  } = useExercisePoseDetection({
    exerciseType: challenge?.exerciseType ?? 'push_ups',
    enabled: canAttempt && cameraActive,
    onRepDetected: () => {
      repCounter.simulateRep();
    },
  });

  const autoRepCounting = Platform.OS === 'web' || supportsNativePoseDetection();
  const showSimulateButton = canAttempt && !autoRepCounting;

  function handleCameraReady() {
    repCounter.start();
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
    challenge.exerciseType,
    challenge.targetReps,
  );
  const overlayVariant = getFriendChallengeOverlayVariant(
    waitingOnOpponent,
    isCompleted,
    isResolved,
    winResult,
  );
  const overlayKey = `${overlayVariant ?? 'none'}-${challenge.resolvedAt ?? challenge.completedAt ?? 'pending'}`;

  function renderRaceTimer(activeChallenge: FriendChallenge) {
    if (isPending) {
      return null;
    }

    if (!raceStarted && canAttempt) {
      return (
        <View
          style={[
            styles.timerHintBanner,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <Text style={[styles.timerHintText, { color: theme.textSecondary }]}>
            {FRIEND_RACE_TIMER_START_HINT}
          </Text>
        </View>
      );
    }

    if (!raceStarted) {
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

  return (
    <>
      <Stack.Screen options={{ title: 'Friend Challenge', headerShown: true }} />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
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
            challenge.isCreator ? (
              <Text style={StyleSheet.flatten([styles.pending, { color: theme.textSecondary }])}>
                Waiting for {opponentName} to accept your challenge.
              </Text>
            ) : (
              <View style={styles.pendingActions}>
                <Text style={StyleSheet.flatten([styles.pending, { color: theme.textSecondary }])}>
                  {getCreatorDisplayName(challenge)} challenged you to a speed race.
                </Text>
                <PrimaryButton
                  label="Accept"
                  onPress={() => {
                    void handleAcceptChallenge();
                  }}
                  loading={isPendingAction}
                />
                <PrimaryButton
                  label="Decline"
                  variant="secondary"
                  onPress={() => {
                    void handleDeclineChallenge();
                  }}
                  disabled={isPendingAction}
                />
              </View>
            )
          ) : isExpired ? (
            <Text style={StyleSheet.flatten([styles.pending, { color: theme.danger }])}>
              You hit the time cap before finishing. Head back and try again.
            </Text>
          ) : (
            <>
              <View
                style={StyleSheet.flatten([
                  styles.cameraFrame,
                  overlayVariant ? styles.cameraFrameComplete : null,
                ])}>
                <CameraPreview
                  active={cameraActive && canAttempt}
                  pullUpBarLineY={challenge.exerciseType === 'pull_ups' ? pullUpBarLineY : null}
                  exerciseType={challenge.exerciseType}
                  repPhase={posePhase}
                  repTrackingReady={trackingStatus === 'ready'}
                  onCameraReady={handleCameraReady}
                  onLandmarksDetected={processLandmarks}
                />
                {overlayVariant ? (
                  <FriendChallengeCompleteOverlay
                    key={overlayKey}
                    variant={overlayVariant}
                    raceTimeSeconds={myTime}
                    opponentName={opponentName}
                    opponentTimeSeconds={opponentTime}
                    xp={earnedXp}
                    coins={earnedCoins}
                    emote={equippedEmote}
                  />
                ) : null}
              </View>

              {!overlayVariant ? <PoseGuidanceBanner exerciseType={challenge.exerciseType} /> : null}
            </>
          )}

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
  scroll: {
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
  cameraFrame: {
    width: '100%',
    height: 320,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  cameraFrameComplete: {
    height: 400,
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
  timerHintBanner: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  timerHintText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
  pendingActions: {
    gap: Spacing.three,
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
