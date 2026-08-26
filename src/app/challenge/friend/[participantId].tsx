import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PosePreviewLayoutState } from '@/components/CameraPreview.types';
import { ChallengeWorkoutMode } from '@/components/challenges/ChallengeWorkoutMode';
import { ChallengeWorkoutSetup } from '@/components/challenges/ChallengeWorkoutSetup';
import {
    FriendChallengeCompleteOverlay,
    type FriendChallengeCompleteVariant,
} from '@/components/challenges/FriendChallengeCompleteOverlay';
import { WorkoutCircuitPreview } from '@/components/workouts/WorkoutCircuitPreview';
import { EmoteDisplay } from '@/components/shop/EmoteDisplay';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatExerciseLabel } from '@/constants/challenges';
import { getCustomWorkoutSessionPath, getCustomWorkoutTypeLabel } from '@/constants/customWorkouts';
import { getFriendChallengeCoinReward } from '@/constants/coins';
import {
    FRIEND_RACE_TIMER_START_HINT,
} from '@/constants/friendChallenges';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useExercisePoseDetection } from '@/features/challenges/useExercisePoseDetection';
import { useMissionComplete } from '@/features/challenges/MissionCompleteProvider';
import { useRepCounter } from '@/features/challenges/useRepCounter';
import { buildFriendWorkoutLaunchConfig, isFriendWorkoutChallenge } from '@/features/friends/friendChallengeWorkout';
import { setPendingCustomWorkoutLaunch } from '@/features/workouts/customWorkoutLaunchStore';
import { parseStructureConfig } from '@/features/workouts/forTimeStructure';
import { useFriendChallenge } from '@/features/friends/useFriendChallenge';
import { useFriendChallengeRaceTimer } from '@/features/friends/useFriendChallengeRaceTimer';
import { useProfile } from '@/features/profile/useProfile';
import { useShop } from '@/features/shop/ShopProvider';
import { useDrainNativeCameraOnLeave } from '@/hooks/use-drain-native-camera-on-leave';
import { useRouteParam } from '@/hooks/use-route-param';
import { useTheme } from '@/hooks/use-theme';
import { useWorkoutSession } from '@/hooks/use-workout-session';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import { supportsNativePoseDetection } from '@/lib/runtime';
import {
    acceptFriendChallenge,
    completeFriendChallenge,
    declineFriendChallenge,
} from '@/services/friendChallengeService';
import {
    didIWinFriendChallenge,
    formatFriendWorkoutScore,
    getCreatorDisplayName,
    getFriendChallengeTitle,
    getOpponentDisplayName,
    getOpponentRaceSeconds,
    hasFriendChallengeStarted,
    isFriendChallengeResolved,
    isFriendChallengeWaitingOnOpponent,
} from '@/types/friends';

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
  const { refreshMissionsAndCelebrate } = useMissionComplete();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPendingAction, setIsPendingAction] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const { workoutStarted, startWorkout } = useWorkoutSession('friend', participantId);
  const isSyncingRef = useRef(false);
  const challengeRef = useRef(challenge);
  const posePreviewLayoutRef = useRef<PosePreviewLayoutState>({
    isLandscape: false,
    settled: false,
  });

  challengeRef.current = challenge;

  const isCompleted = challenge?.status === 'completed';
  const isPending = challenge?.status === 'pending';
  const isDeclined = challenge?.status === 'declined';
  const opponentDeclined = challenge?.opponentStatus === 'declined';
  const isExpired = challenge?.status === 'expired' || isTimedOut;
  const isResolved = challenge ? isFriendChallengeResolved(challenge) : false;
  const waitingOnOpponent = challenge ? isFriendChallengeWaitingOnOpponent(challenge) : false;
  const targetReps = challenge?.targetReps ?? 0;
  const raceStarted = challenge ? hasFriendChallengeStarted(challenge) : false;
  const myUserId = session?.user.id ?? '';
  const winResult = challenge ? didIWinFriendChallenge(challenge, myUserId) : null;
  const canAttempt =
    Boolean(challenge) &&
    !isCompleted &&
    !isPending &&
    !isDeclined &&
    !opponentDeclined &&
    !isExpired &&
    !waitingOnOpponent;
  const opponentForfeited =
    Boolean(challenge) &&
    Boolean(challenge?.isCreator) &&
    isCompleted &&
    opponentDeclined &&
    winResult === true;
  const overlayVariant = challenge
    ? getFriendChallengeOverlayVariant(waitingOnOpponent, isCompleted, isResolved, winResult)
    : null;
  const isWorkoutChallenge = challenge ? isFriendWorkoutChallenge(challenge) : false;
  const exerciseType = challenge?.exerciseType ?? 'push_ups';
  const showExerciseWorkout =
    Boolean(challenge) &&
    !isWorkoutChallenge &&
    (canAttempt || Boolean(overlayVariant)) &&
    (workoutStarted || Boolean(overlayVariant));
  const cameraActive = useDrainNativeCameraOnLeave(showExerciseWorkout);

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

  const handleStartWorkoutChallenge = useCallback(() => {
    if (!challenge) {
      return;
    }

    const launchConfig = buildFriendWorkoutLaunchConfig(challenge);
    if (!launchConfig) {
      setSyncError('Workout challenge is missing workout details');
      return;
    }

    setSyncError(null);
    setPendingCustomWorkoutLaunch(launchConfig);
    router.push(getCustomWorkoutSessionPath(launchConfig.workoutType));
  }, [challenge, router]);

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
        activeChallenge.status === 'declined' ||
        activeChallenge.status === 'expired' ||
        activeChallenge.opponentStatus === 'declined' ||
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
        await refreshMissionsAndCelebrate();
        void refreshProfile();
      } catch (err) {
        setSyncError(formatUserError(err, 'Failed to sync repetition'));
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [participantId, refresh, refreshMissionsAndCelebrate, refreshProfile, isTimedOut],
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
    coachSeverity,
    pullUpBarLineY,
    processLandmarks,
  } = useExercisePoseDetection({
    exerciseType,
    enabled: canAttempt && !isWorkoutChallenge && cameraActive && showExerciseWorkout && !overlayVariant,
    posePreviewLayoutRef,
    onRepDetected: () => {
      repCounter.simulateRep();
    },
  });

  const autoRepCounting = Platform.OS === 'web' || supportsNativePoseDetection();
  const showSimulateButton = !__DEV__ && canAttempt && !autoRepCounting;

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
  const earnedXp = challenge.xpEarned ?? 0;
  const earnedCoins = getFriendChallengeCoinReward(challenge.coinsEarned);
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

  if (isWorkoutChallenge && overlayVariant) {
    const myTime = challenge.elapsedSeconds ?? (isCompleted || waitingOnOpponent ? elapsedSeconds : null);
    const opponentTime = challenge.opponentElapsedSeconds ?? getOpponentRaceSeconds(challenge);

    return (
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={StyleSheet.flatten([styles.exercise, { color: theme.textSecondary }])}>
            Workout challenge vs {opponentName}
          </Text>
          <Text style={StyleSheet.flatten([styles.workoutTitle, { color: theme.text }])}>
            {getFriendChallengeTitle(challenge)}
          </Text>
          <Text style={StyleSheet.flatten([styles.pending, { color: theme.textSecondary }])}>
            {formatFriendWorkoutScore(challenge)}
          </Text>
          <FriendChallengeCompleteOverlay
            key={overlayKey}
            variant={overlayVariant}
            raceTimeSeconds={myTime}
            opponentName={opponentName}
            opponentTimeSeconds={opponentTime}
            xp={earnedXp}
            coins={earnedCoins}
            emote={equippedEmote}
            opponentForfeited={opponentForfeited}
          />
          <PrimaryButton label="Back" variant="secondary" onPress={handleLeave} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (showExerciseWorkout) {
    return (
      <ChallengeWorkoutMode
          exerciseType={exerciseType}
          currentReps={repCounter.currentReps}
          targetReps={challenge.targetReps}
          trackingStatus={trackingStatus}
          coachSeverity={coachSeverity}
          repPhase={posePhase}
          cameraActive={cameraActive && canAttempt && !overlayVariant}
          onContinue={handleLeave}
          pullUpBarLineY={exerciseType === 'pull_ups' ? pullUpBarLineY : null}
          posePreviewLayoutRef={posePreviewLayoutRef}
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
                opponentForfeited={opponentForfeited}
              />
            ) : null
          }
          footer={workoutFooter}
          onDevSimulateRep={repCounter.simulateRep}
          devSimulateDisabled={repCounter.isComplete || isSyncing}
          devSimulateLoading={isSyncing}
        />
    );
  }

  if (isWorkoutChallenge && canAttempt) {
    return (
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={StyleSheet.flatten([styles.exercise, { color: theme.textSecondary }])}>
            Workout challenge vs {opponentName}
          </Text>
          <Text style={StyleSheet.flatten([styles.workoutTitle, { color: theme.text }])}>
            {getFriendChallengeTitle(challenge)}
          </Text>
          {challenge.workoutType ? (
            <Text style={StyleSheet.flatten([styles.pending, { color: theme.textSecondary }])}>
              {getCustomWorkoutTypeLabel(challenge.workoutType)} · finish the workout to submit your score
            </Text>
          ) : null}
          {challenge.creatorEmoteEmoji && !challenge.isCreator ? (
            <View style={styles.creatorEmoteRow}>
              <Text style={StyleSheet.flatten([styles.creatorEmoteLabel, { color: theme.textSecondary }])}>
                Challenge emote
              </Text>
              <EmoteDisplay emoji={challenge.creatorEmoteEmoji} size="sm" />
            </View>
          ) : null}
          <WorkoutCircuitPreview
            workoutType={challenge.workoutType ?? 'amrap'}
            exercises={challenge.workoutExercises}
            structureConfig={parseStructureConfig(challenge.structureConfig)}
          />
          {syncError ? (
            <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{syncError}</Text>
          ) : null}
          <PrimaryButton label="Start Workout" onPress={handleStartWorkoutChallenge} />
          <PrimaryButton label="Back" variant="secondary" onPress={handleLeave} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (canAttempt && !workoutStarted) {
    return (
      <SafeAreaView
          style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
          edges={['bottom']}>
          <ChallengeWorkoutSetup
            exerciseLabel={formatExerciseLabel(exerciseType, true)}
            exerciseType={exerciseType}
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
            {isWorkoutChallenge
              ? `Workout challenge vs ${opponentName}`
              : `Speed race vs ${opponentName} · ${formatExerciseLabel(exerciseType, true)}`}
          </Text>
          {isWorkoutChallenge ? (
            <Text style={StyleSheet.flatten([styles.workoutTitle, { color: theme.text }])}>
              {getFriendChallengeTitle(challenge)}
            </Text>
          ) : null}
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
                  {getCreatorDisplayName(challenge)} challenged you to{' '}
                  {isWorkoutChallenge ? 'a workout' : 'a speed race'}.
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
          ) : isDeclined ? (
            <Text style={StyleSheet.flatten([styles.pending, { color: theme.textSecondary }])}>
              {challenge.isCreator
                ? `${opponentName} declined this challenge.`
                : 'You declined this challenge.'}
            </Text>
          ) : opponentDeclined ? (
            <Text style={StyleSheet.flatten([styles.pending, { color: theme.textSecondary }])}>
              {opponentName} declined this challenge.
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
  workoutTitle: {
    fontSize: 24,
    fontWeight: '900',
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
