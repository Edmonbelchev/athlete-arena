import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  FriendChallengeCompleteOverlay,
  type FriendChallengeCompleteVariant,
} from '@/components/challenges/FriendChallengeCompleteOverlay';
import { ChallengeWorkoutMode } from '@/components/challenges/ChallengeWorkoutMode';
import { ChallengeWorkoutSetup } from '@/components/challenges/ChallengeWorkoutSetup';
import { EmoteDisplay } from '@/components/shop/EmoteDisplay';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatExerciseLabel } from '@/constants/challenges';
import { getFriendChallengeCoinReward } from '@/constants/coins';
import {
  FRIEND_RACE_TIMER_START_HINT,
} from '@/constants/friendChallenges';
import { MaxContentWidth, Spacing } from '@/constants/theme';
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
} from '@/types/friends';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import { supportsNativePoseDetection } from '@/lib/runtime';
import { useDrainNativeCameraOnLeave } from '@/hooks/use-drain-native-camera-on-leave';
import { useRouteParam } from '@/hooks/use-route-param';
import { useWorkoutSession } from '@/hooks/use-workout-session';
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
  const participantId = useRouteParam('participantId');
  const { challenge, isLoading, error, refresh } = useFriendChallenge(participantId);
  const { equippedEmote } = useShop();
  const { refresh: refreshProfile } = useProfile();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPendingAction, setIsPendingAction] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const { workoutStarted, startWorkout } = useWorkoutSession('friend', participantId);
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
  const canAttempt =
    Boolean(challenge) && !isCompleted && !isPending && !isExpired && !waitingOnOpponent;
  const overlayVariant = challenge
    ? getFriendChallengeOverlayVariant(waitingOnOpponent, isCompleted, isResolved, didIWinFriendChallenge(challenge, myUserId))
    : null;
  const showWorkout =
    Boolean(challenge) &&
    (canAttempt || Boolean(overlayVariant)) &&
    (workoutStarted || Boolean(overlayVariant));
  const cameraActive = useDrainNativeCameraOnLeave(showWorkout);

  const handleLeave = useCallback(() => {
    leaveScreen(router, '/(tabs)/friends');
  }, [router]);

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
      handleLeave();
    } catch (err) {
      setSyncError(formatUserError(err, 'Failed to decline challenge'));
      setIsPendingAction(false);
    }
  }, [handleLeave, participantId]);

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
    trackingMessage,
    pullUpBarLineY,
    processLandmarks,
  } = useExercisePoseDetection({
    exerciseType: challenge?.exerciseType ?? 'push_ups',
    enabled: canAttempt && cameraActive && showWorkout,
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
          <PrimaryButton label="Go Back" variant="secondary" onPress={handleLeave} />
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
  const overlayKey = `${overlayVariant ?? 'none'}-${challenge.resolvedAt ?? challenge.completedAt ?? 'pending'}`;
  const raceTimer =
    isPending || !canAttempt
      ? null
      : !raceStarted
        ? { kind: 'hint' as const, message: FRIEND_RACE_TIMER_START_HINT }
        : isExpired
          ? { kind: 'expired' as const }
          : {
              kind: 'running' as const,
              elapsedSeconds,
              secondsRemaining,
              timeLimitSeconds: challenge.timeLimitSeconds,
            };
  const workoutFooter =
    showSimulateButton || syncError ? (
      <>
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
      </>
    ) : undefined;

  if (showWorkout) {
    return (
      <ChallengeWorkoutMode
          exerciseType={challenge.exerciseType}
          currentReps={repCounter.currentReps}
          targetReps={challenge.targetReps}
          trackingStatus={trackingStatus}
          trackingMessage={trackingMessage}
          repPhase={posePhase}
          cameraActive={cameraActive && canAttempt && !overlayVariant}
          onContinue={handleLeave}
          pullUpBarLineY={challenge.exerciseType === 'pull_ups' ? pullUpBarLineY : null}
          onCameraReady={handleCameraReady}
          onLandmarksDetected={processLandmarks}
          completed={Boolean(overlayVariant)}
          raceTimer={raceTimer}
          completeOverlay={
            overlayVariant ? (
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
            ) : null
          }
          footer={workoutFooter}
        />
    );
  }

  if (canAttempt && !workoutStarted) {
    return (
      <SafeAreaView
          style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
          edges={['bottom']}>
          <ChallengeWorkoutSetup
            exerciseLabel={formatExerciseLabel(challenge.exerciseType, true)}
            exerciseType={challenge.exerciseType}
            targetReps={challenge.targetReps}
            subtitle={`Speed race vs ${opponentName}`}
            onStart={startWorkout}
            onCancel={handleLeave}
          />
      </SafeAreaView>
    );
  }

  return (
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
          ) : null}

          {syncError ? (
            <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{syncError}</Text>
          ) : null}

          <PrimaryButton label="Back" variant="secondary" onPress={handleLeave} />
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
