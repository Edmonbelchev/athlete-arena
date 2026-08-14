import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DailyMissionCompleteOverlay } from '@/components/challenges/DailyMissionCompleteOverlay';
import { ChallengeWorkoutMode } from '@/components/challenges/ChallengeWorkoutMode';
import { ChallengeWorkoutSetup } from '@/components/challenges/ChallengeWorkoutSetup';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatExerciseLabel } from '@/constants/challenges';
import {
  DAILY_MISSION_COIN_REWARD,
  DAILY_MISSION_XP_REWARD,
} from '@/constants/dailyMissionRewards';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useChallenge } from '@/features/challenges/useChallenge';
import { useExercisePoseDetection } from '@/features/challenges/useExercisePoseDetection';
import { useRepCounter } from '@/features/challenges/useRepCounter';
import { useProfile } from '@/features/profile/useProfile';
import { useShop } from '@/features/shop/ShopProvider';
import { useDrainNativeCameraOnLeave } from '@/hooks/use-drain-native-camera-on-leave';
import { useRouteParam } from '@/hooks/use-route-param';
import { useWorkoutSession } from '@/hooks/use-workout-session';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import { supportsNativePoseDetection } from '@/lib/runtime';
import { completeChallenge } from '@/services/challengeService';

export default function ChallengeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const id = useRouteParam('id');
  const { challenge, isLoading, error, applyChallenge } = useChallenge(id);
  const { equippedEmote } = useShop();
  const { applyXpDelta, refresh: refreshProfile } = useProfile();
  const { workoutStarted, startWorkout } = useWorkoutSession('daily', id);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const challengeRef = useRef(challenge);
  const isCompleted = challenge?.status === 'completed';
  const targetReps = challenge?.target_reps ?? 0;
  const inWorkout = Boolean(challenge) && (workoutStarted || isCompleted);

  challengeRef.current = challenge;

  const cameraActive = useDrainNativeCameraOnLeave(inWorkout);

  const handleRepDetected = useCallback(
    async (repCount: number) => {
      const activeChallenge = challengeRef.current;
      if (!activeChallenge || activeChallenge.status === 'completed' || isSyncingRef.current) {
        return;
      }

      if (repCount < activeChallenge.target_reps) {
        return;
      }

      isSyncingRef.current = true;
      setIsSyncing(true);
      setSyncError(null);

      try {
        const updated = await completeChallenge(activeChallenge.id, repCount);
        applyChallenge(updated);
        applyXpDelta(DAILY_MISSION_XP_REWARD);
        void refreshProfile();
      } catch (err) {
        setSyncError(formatUserError(err, 'Failed to complete challenge'));
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [applyChallenge, applyXpDelta, refreshProfile],
  );

  const repCounter = useRepCounter({
    targetReps,
    initialReps: challenge?.completed_reps ?? 0,
    enabled: Boolean(challenge) && !isCompleted,
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
    exerciseType: challenge?.exercise_type ?? 'push_ups',
    enabled: Boolean(challenge) && !isCompleted && cameraActive && inWorkout,
    onRepDetected: () => {
      repCounter.simulateRep();
    },
  });

  const autoRepCounting = Platform.OS === 'web' || supportsNativePoseDetection();
  const showSimulateButton = !isCompleted && !autoRepCounting;
  const earnedXp = challenge && isCompleted ? DAILY_MISSION_XP_REWARD : 0;
  const earnedCoins = challenge && isCompleted ? DAILY_MISSION_COIN_REWARD : 0;

  const handleLeave = useCallback(() => {
    leaveScreen(router, '/(tabs)');
  }, [router]);

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

  if (inWorkout) {
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

    return (
      <ChallengeWorkoutMode
        exerciseType={challenge.exercise_type}
        currentReps={repCounter.currentReps}
        targetReps={challenge.target_reps}
        trackingStatus={trackingStatus}
        trackingMessage={trackingMessage}
        repPhase={posePhase}
        cameraActive={!isCompleted && cameraActive}
        onContinue={handleLeave}
        pullUpBarLineY={challenge.exercise_type === 'pull_ups' ? pullUpBarLineY : null}
        onCameraReady={() => {
          repCounter.start();
        }}
        onLandmarksDetected={processLandmarks}
        completed={isCompleted}
        completeOverlay={
          isCompleted ? (
            <DailyMissionCompleteOverlay
              targetReps={challenge.target_reps}
              exerciseLabel={formatExerciseLabel(challenge.exercise_type, true)}
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

  return (
    <SafeAreaView
      style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
      edges={['bottom']}>
      <ChallengeWorkoutSetup
        exerciseLabel={formatExerciseLabel(challenge.exercise_type, true)}
        exerciseType={challenge.exercise_type}
        targetReps={challenge.target_reps}
        onStart={startWorkout}
        onCancel={handleLeave}
      />
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
  container: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
