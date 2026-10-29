import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
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
    getCreatorDisplayName,
    getFriendChallengeTitle,
    getOpponentDisplayName,
    getOpponentRaceSeconds,
    hasFriendChallengeStarted,
    isFriendChallengeResolved,
    isFriendChallengeWaitingOnOpponent,
    type FriendChallenge,
} from '@/types/friends';
import type { HeadToHeadPlayer } from '@/components/challenges/HeadToHead';
import { formatRaceTime, formatRaceTimeLimit } from '@/constants/friendChallenges';
import type { AppIconName } from '@/constants/icons';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { AppIcon } from '@/components/ui/AppIcon';

type ThemeColors = ReturnType<typeof useTheme>;

/** Kind pill, title and the two racers - shared by every state of this screen. */
function ChallengeHeader({
  kindLabel,
  title,
  opponentName,
  theme,
}: {
  kindLabel: string;
  title: string;
  opponentName: string;
  theme: ThemeColors;
}) {
  return (
    <View style={styles.resultHeader}>
      <View style={StyleSheet.flatten([styles.kindPill, { backgroundColor: theme.backgroundElement, borderColor: theme.border }])}>
        <Text style={StyleSheet.flatten([styles.kindPillText, { color: theme.textSecondary }])}>{kindLabel}</Text>
      </View>
      <Text style={StyleSheet.flatten([styles.workoutTitle, { color: theme.text }])}>{title}</Text>
      <View style={styles.racersRow}>
        <View style={styles.racer}>
          <ProfileAvatar name="You" size={28} />
          <Text style={StyleSheet.flatten([styles.racerName, { color: theme.text }])}>You</Text>
        </View>
        <Text style={StyleSheet.flatten([styles.racersVs, { color: theme.textSecondary }])}>VS</Text>
        <View style={styles.racer}>
          <ProfileAvatar name={opponentName} size={28} />
          <Text style={StyleSheet.flatten([styles.racerName, { color: theme.text }])} numberOfLines={1}>
            {opponentName}
          </Text>
        </View>
      </View>
    </View>
  );
}

function InfoChips({ items, theme }: { items: string[]; theme: ThemeColors }) {
  return (
    <View style={styles.chipRow}>
      {items.map((item) => (
        <View
          key={item}
          style={StyleSheet.flatten([styles.infoChip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }])}>
          <Text style={StyleSheet.flatten([styles.infoChipText, { color: theme.text }])}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/** Icon + message card for invite / waiting / expired / declined states, with optional actions. */
function StatusCard({
  icon,
  color,
  title,
  message,
  theme,
  children,
}: {
  icon: AppIconName;
  color: string;
  title: string;
  message?: string | null;
  theme: ThemeColors;
  children?: ReactNode;
}) {
  return (
    <View style={StyleSheet.flatten([styles.statusCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }])}>
      <View style={StyleSheet.flatten([styles.statusIcon, { backgroundColor: `${color}1F` }])}>
        <AppIcon name={icon} size={26} color={color} weight="bold" />
      </View>
      <Text style={StyleSheet.flatten([styles.statusTitle, { color: theme.text }])}>{title}</Text>
      {message ? (
        <Text style={StyleSheet.flatten([styles.statusMessage, { color: theme.textSecondary }])}>{message}</Text>
      ) : null}
      {children ? <View style={styles.statusActions}>{children}</View> : null}
    </View>
  );
}

function getChallengeInfoChips(challenge: FriendChallenge): string[] {
  if (challenge.challengeKind === 'workout') {
    const chips = [challenge.workoutType ? getCustomWorkoutTypeLabel(challenge.workoutType) : 'Workout'];
    chips.push(challenge.workoutType === 'for_time' ? 'Fastest time wins' : 'Highest score wins');
    return chips;
  }

  return [
    formatExerciseLabel(challenge.exerciseType ?? 'push_ups'),
    `${challenge.targetReps} reps`,
    formatRaceTimeLimit(challenge.timeLimitSeconds),
  ];
}

/** Big result for the finish screen plus each side's score card. */
function getFriendResultScores(
  challenge: FriendChallenge,
  variant: FriendChallengeCompleteVariant,
  opponentName: string,
  myTime: number | null,
  opponentTime: number | null,
): { headline: string | null; me: HeadToHeadPlayer; opponent: HeadToHeadPlayer } {
  const side = (mine: boolean): HeadToHeadPlayer => {
    const status = mine ? challenge.status : challenge.opponentStatus;
    const finished = status === 'completed';
    const time = mine ? myTime : opponentTime;
    const base = {
      name: mine ? 'You' : opponentName,
      status,
      isWinner: mine ? variant === 'winner' : variant === 'lost',
    };

    if (challenge.challengeKind === 'workout') {
      const reps = mine
        ? (challenge.workoutTotalReps ?? challenge.completedReps)
        : (challenge.opponentWorkoutTotalReps ?? challenge.opponentCompletedReps);
      const repsDetail = finished ? `${reps} reps` : null;

      if (challenge.workoutType === 'for_time') {
        return { ...base, score: finished ? formatRaceTime(time) : '—', caption: 'finish time', detail: repsDetail };
      }

      const rounds = mine ? challenge.completedRounds : challenge.opponentCompletedRounds;
      return {
        ...base,
        score: finished ? String(rounds ?? 0) : '—',
        caption: challenge.workoutType === 'emom' ? 'minutes' : 'rounds',
        detail: repsDetail,
      };
    }

    const reps = mine ? challenge.completedReps : challenge.opponentCompletedReps;
    return {
      ...base,
      score: finished && time !== null ? formatRaceTime(time) : '—',
      caption: 'race time',
      detail: `${reps} / ${challenge.targetReps} reps`,
    };
  };

  const me = side(true);
  const isRoundsWorkout = challenge.challengeKind === 'workout' && challenge.workoutType !== 'for_time';

  return {
    headline: isRoundsWorkout ? `${me.score} ${me.caption}` : null,
    me,
    opponent: side(false),
  };
}

function getFriendResultOverlayProps(
  challenge: FriendChallenge,
  variant: FriendChallengeCompleteVariant,
  opponentName: string,
  myTime: number | null,
  opponentTime: number | null,
): { headline: string | null; headToHead: { me: HeadToHeadPlayer; opponent: HeadToHeadPlayer } } {
  const { headline, me, opponent } = getFriendResultScores(challenge, variant, opponentName, myTime, opponentTime);
  return { headline, headToHead: { me, opponent } };
}

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
          <ChallengeHeader
            kindLabel={`${challenge.workoutType ? getCustomWorkoutTypeLabel(challenge.workoutType) : 'Workout'} challenge`}
            title={getFriendChallengeTitle(challenge)}
            opponentName={opponentName}
            theme={theme}
          />
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
            {...getFriendResultOverlayProps(challenge, overlayVariant, opponentName, myTime, opponentTime)}
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
                {...getFriendResultOverlayProps(challenge, overlayVariant, opponentName, myTime, opponentTime)}
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
          <ChallengeHeader
            kindLabel="Workout challenge"
            title={getFriendChallengeTitle(challenge)}
            opponentName={opponentName}
            theme={theme}
          />
          <InfoChips items={getChallengeInfoChips(challenge)} theme={theme} />
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
          <Text style={StyleSheet.flatten([styles.hint, { color: theme.textSecondary }])}>
            Finish the workout to submit your score - you get one attempt.
          </Text>
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
          <ChallengeHeader
            kindLabel={isWorkoutChallenge ? 'Workout challenge' : 'Speed race'}
            title={getFriendChallengeTitle(challenge)}
            opponentName={opponentName}
            theme={theme}
          />
          <InfoChips items={getChallengeInfoChips(challenge)} theme={theme} />
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
              <StatusCard
                icon="history"
                color={theme.primary}
                title="Invite sent"
                message={`Waiting for ${opponentName} to accept your challenge.`}
                theme={theme}
              />
            ) : (
              <StatusCard
                icon="swords"
                color={theme.streak}
                title={`${getCreatorDisplayName(challenge)} challenged you`}
                message={
                  isWorkoutChallenge
                    ? 'Accept to unlock the workout and post your score.'
                    : 'Accept, then race to the target reps as fast as you can.'
                }
                theme={theme}>
                <PrimaryButton
                  label="Accept challenge"
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
              </StatusCard>
            )
          ) : isExpired ? (
            <StatusCard
              icon="history"
              color={theme.danger}
              title="Time's up"
              message="You hit the time cap before finishing this challenge."
              theme={theme}
            />
          ) : isDeclined ? (
            <StatusCard
              icon="close"
              color={theme.danger}
              title="Challenge declined"
              message={challenge.isCreator ? `${opponentName} declined this challenge.` : 'You declined this challenge.'}
              theme={theme}
            />
          ) : opponentDeclined ? (
            <StatusCard
              icon="close"
              color={theme.danger}
              title="Challenge declined"
              message={`${opponentName} declined this challenge.`}
              theme={theme}
            />
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
  resultHeader: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  racersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  racer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    maxWidth: 150,
  },
  racerName: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  racersVs: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  infoChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  infoChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  statusActions: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  kindPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
  },
  kindPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  versusLine: {
    fontSize: 14,
    fontWeight: '700',
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
