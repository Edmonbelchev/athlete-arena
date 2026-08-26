import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PosePreviewLayoutState } from '@/components/CameraPreview.types';
import { ChallengeWorkoutMode } from '@/components/challenges/ChallengeWorkoutMode';
import { ChallengeWorkoutSetup } from '@/components/challenges/ChallengeWorkoutSetup';
import { AmrapCompleteOverlay } from '@/components/workouts/AmrapCompleteOverlay';
import { AmrapWorkoutHud } from '@/components/workouts/AmrapWorkoutHud';
import { ForTimeCompleteOverlay } from '@/components/workouts/ForTimeCompleteOverlay';
import { ForTimeWorkoutHud } from '@/components/workouts/ForTimeWorkoutHud';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  formatWorkoutTimeLimit,
  getCustomWorkoutTypeLabel,
} from '@/constants/customWorkouts';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useExercisePoseDetection } from '@/features/challenges/useExercisePoseDetection';
import { useFriendChallengeRaceTimer } from '@/features/friends/useFriendChallengeRaceTimer';
import { consumePendingCustomWorkoutLaunch } from '@/features/workouts/customWorkoutLaunchStore';
import {
  getForTimeStepContext,
  getForTimeStepCount,
} from '@/features/workouts/forTimeStructure';
import { useMissionComplete } from '@/features/challenges/MissionCompleteProvider';
import { useAmrapWorkout } from '@/features/workouts/useAmrapWorkout';
import { useForTimeWorkout } from '@/features/workouts/useForTimeWorkout';
import { useProfile } from '@/features/profile/useProfile';
import { useDrainNativeCameraOnLeave } from '@/hooks/use-drain-native-camera-on-leave';
import { useRepFeedback } from '@/hooks/use-rep-feedback';
import { useWorkoutSession } from '@/hooks/use-workout-session';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import { supportsNativePoseDetection } from '@/lib/runtime';
import { saveCustomWorkoutSession, saveForTimeWorkoutSession } from '@/services/customWorkoutService';
import { completeFriendWorkoutChallenge } from '@/services/friendChallengeService';
import type { AmrapWorkoutResult, CustomWorkoutLaunchConfig, ForTimeWorkoutResult } from '@/types/customWorkouts';
import { useTheme } from '@/hooks/use-theme';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';

async function syncFriendWorkoutChallengeCompletion(
  participantId: string,
  input: {
    startedAt: string;
    completedRounds: number;
    totalReps: number;
    elapsedSeconds?: number | null;
  },
): Promise<void> {
  await completeFriendWorkoutChallenge({
    participantId,
    startedAt: input.startedAt,
    completedRounds: input.completedRounds,
    totalReps: input.totalReps,
    elapsedSeconds: input.elapsedSeconds ?? null,
  });
}

function AmrapWorkoutSession({ config }: { config: CustomWorkoutLaunchConfig }) {
  const theme = useTheme();
  const router = useRouter();
  const { preferences } = useUserSettings();
  const { refresh: refreshProfile } = useProfile();
  const { refreshMissionsAndCelebrate } = useMissionComplete();
  const sessionKey = config.catalogWorkoutId ?? config.templateId ?? `${config.workoutType}:${config.title}`;
  const { workoutStarted, startWorkout: markWorkoutStarted } = useWorkoutSession(
    `custom-${config.workoutType}`,
    sessionKey,
  );
  const [savedResult, setSavedResult] = useState<AmrapWorkoutResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savedResultRef = useRef<AmrapWorkoutResult | null>(null);
  const posePreviewLayoutRef = useRef<PosePreviewLayoutState>({
    isLandscape: false,
    settled: false,
  });

  const amrap = useAmrapWorkout({
    config,
    onComplete: (result) => {
      savedResultRef.current = result;
      setSavedResult(result);
      void persistResult(result);
    },
  });

  const persistResult = useCallback(async (result: AmrapWorkoutResult) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await saveCustomWorkoutSession(result);
      if (config.friendChallengeParticipantId) {
        await syncFriendWorkoutChallengeCompletion(config.friendChallengeParticipantId, {
          startedAt: result.startedAt,
          completedRounds: result.completedRounds,
          totalReps: result.totalReps,
        });
      }
      await refreshMissionsAndCelebrate();
      void refreshProfile();
    } catch (err) {
      setSaveError(formatUserError(err, 'Failed to save workout result'));
    } finally {
      setIsSaving(false);
    }
  }, [config.friendChallengeParticipantId, refreshMissionsAndCelebrate, refreshProfile]);

  const handleLeave = useCallback(() => {
    if (config.friendChallengeParticipantId) {
      router.replace({
        pathname: '/challenge/friend/[participantId]',
        params: { participantId: config.friendChallengeParticipantId },
      });
      return;
    }

    leaveScreen(router, '/(tabs)/workouts');
  }, [config.friendChallengeParticipantId, router]);

  const handleTimerExpire = useCallback(() => {
    amrap.finishWorkout();
  }, [amrap]);

  const { secondsRemaining } = useFriendChallengeRaceTimer({
    startedAt: amrap.startedAt,
    completedAt: amrap.completed ? savedResultRef.current?.completedAt ?? new Date().toISOString() : null,
    maxSeconds: config.timeLimitSeconds,
    enabled: workoutStarted && Boolean(amrap.startedAt) && !amrap.completed,
    onExpire: handleTimerExpire,
  });

  const canTrack = workoutStarted && Boolean(amrap.startedAt) && !amrap.completed;
  const showWorkout = workoutStarted || amrap.completed;
  const cameraActive = useDrainNativeCameraOnLeave(showWorkout && !amrap.completed);

  const handleRepDetected = useCallback(() => {
    amrap.registerRep();
  }, [amrap.registerRep]);

  const {
    phase: posePhase,
    trackingStatus,
    coachSeverity,
    pullUpBarLineY,
    processLandmarks,
  } = useExercisePoseDetection({
    exerciseType: amrap.currentExercise?.exerciseType ?? 'push_ups',
    exerciseSessionKey: amrap.currentExerciseIndex,
    enabled: canTrack && cameraActive,
    posePreviewLayoutRef,
    onRepDetected: handleRepDetected,
  });

  const autoRepCounting = Platform.OS === 'web' || supportsNativePoseDetection();
  const showSimulateButton = !__DEV__ && canTrack && !autoRepCounting;

  useRepFeedback(amrap.currentExerciseReps, {
    enabled: canTrack,
    soundEnabled: preferences.repSoundEnabled,
  });

  function handleCameraReady() {
    amrap.startWorkout();
  }

  const setupSubtitle = useMemo(() => {
    const typeLabel = getCustomWorkoutTypeLabel(config.workoutType);
    return `${formatWorkoutTimeLimit(config.timeLimitSeconds)} ${typeLabel} · ${config.exercises.length} exercises`;
  }, [config]);

  if (showWorkout && amrap.completed && savedResult) {
    return (
      <ChallengeWorkoutMode
        exerciseType={amrap.currentExercise.exerciseType}
        currentReps={amrap.currentExerciseReps}
        targetReps={amrap.currentExercise.targetReps}
        trackingStatus={trackingStatus}
        coachSeverity={coachSeverity}
        repPhase={posePhase}
        cameraActive={false}
        pullUpBarLineY={null}
        completed
        onContinue={handleLeave}
        completeOverlay={<AmrapCompleteOverlay result={savedResult} />}
        footer={
          saveError ? (
            <Text style={[styles.error, { color: theme.danger }]}>{saveError}</Text>
          ) : isSaving ? (
            <Text style={[styles.meta, { color: theme.textSecondary }]}>Saving result…</Text>
          ) : undefined
        }
      />
    );
  }

  if (showWorkout) {
    return (
      <ChallengeWorkoutMode
        exerciseType={amrap.currentExercise.exerciseType}
        currentReps={amrap.currentExerciseReps}
        targetReps={amrap.currentExercise.targetReps}
        trackingStatus={trackingStatus}
        coachSeverity={coachSeverity}
        repPhase={posePhase}
        cameraActive={cameraActive}
        pullUpBarLineY={amrap.currentExercise.exerciseType === 'pull_ups' ? pullUpBarLineY : null}
        posePreviewLayoutRef={posePreviewLayoutRef}
        onCameraReady={handleCameraReady}
        onLandmarksDetected={processLandmarks}
        hudOverlay={
          <AmrapWorkoutHud
            workoutTypeLabel={getCustomWorkoutTypeLabel(config.workoutType)}
            currentExercise={amrap.currentExercise}
            currentExerciseReps={amrap.currentExerciseReps}
            completedRounds={amrap.completedRounds}
            secondsRemaining={secondsRemaining}
            timeLimitSeconds={config.timeLimitSeconds}
          />
        }
        footer={
          showSimulateButton ? (
            <PrimaryButton label="+ Simulate Rep" variant="secondary" onPress={amrap.registerRep} />
          ) : undefined
        }
        onDevSimulateRep={amrap.registerRep}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['bottom']}>
      <ChallengeWorkoutSetup
        exerciseLabel={config.title}
        exerciseType={amrap.currentExercise.exerciseType}
        targetReps={amrap.currentExercise.targetReps}
        subtitle={setupSubtitle}
        onStart={markWorkoutStarted}
        onCancel={handleLeave}
      />
    </SafeAreaView>
  );
}

function ForTimeWorkoutSession({ config }: { config: CustomWorkoutLaunchConfig }) {
  const theme = useTheme();
  const router = useRouter();
  const { preferences } = useUserSettings();
  const { refresh: refreshProfile } = useProfile();
  const { refreshMissionsAndCelebrate } = useMissionComplete();
  const sessionKey = config.catalogWorkoutId ?? config.templateId ?? `${config.workoutType}:${config.title}`;
  const { workoutStarted, startWorkout: markWorkoutStarted } = useWorkoutSession(
    `custom-${config.workoutType}`,
    sessionKey,
  );
  const [savedResult, setSavedResult] = useState<ForTimeWorkoutResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savedResultRef = useRef<ForTimeWorkoutResult | null>(null);
  const posePreviewLayoutRef = useRef<PosePreviewLayoutState>({
    isLandscape: false,
    settled: false,
  });

  const forTime = useForTimeWorkout({
    config,
    onComplete: (result) => {
      savedResultRef.current = result;
      setSavedResult(result);
      void persistResult(result);
    },
  });

  const persistResult = useCallback(async (result: ForTimeWorkoutResult) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await saveForTimeWorkoutSession(result);
      if (config.friendChallengeParticipantId) {
        await syncFriendWorkoutChallengeCompletion(config.friendChallengeParticipantId, {
          startedAt: result.startedAt,
          completedRounds: 0,
          totalReps: result.totalReps,
          elapsedSeconds: result.elapsedSeconds,
        });
      }
      await refreshMissionsAndCelebrate();
      void refreshProfile();
    } catch (err) {
      setSaveError(formatUserError(err, 'Failed to save workout result'));
    } finally {
      setIsSaving(false);
    }
  }, [config.friendChallengeParticipantId, refreshMissionsAndCelebrate, refreshProfile]);

  const handleLeave = useCallback(() => {
    if (config.friendChallengeParticipantId) {
      router.replace({
        pathname: '/challenge/friend/[participantId]',
        params: { participantId: config.friendChallengeParticipantId },
      });
      return;
    }

    leaveScreen(router, '/(tabs)/workouts');
  }, [config.friendChallengeParticipantId, router]);

  const { elapsedSeconds } = useFriendChallengeRaceTimer({
    startedAt: forTime.startedAt,
    completedAt: forTime.completedAt,
    maxSeconds: null,
    enabled: workoutStarted && Boolean(forTime.startedAt),
  });

  const canTrack = workoutStarted && Boolean(forTime.startedAt) && !forTime.completed;
  const showWorkout = workoutStarted || forTime.completed;
  const cameraActive = useDrainNativeCameraOnLeave(showWorkout && !forTime.completed);

  const handleRepDetected = useCallback(() => {
    forTime.registerRep();
  }, [forTime.registerRep]);

  const {
    phase: posePhase,
    trackingStatus,
    coachSeverity,
    pullUpBarLineY,
    processLandmarks,
  } = useExercisePoseDetection({
    exerciseType: forTime.currentExercise?.exerciseType ?? 'push_ups',
    exerciseSessionKey: forTime.currentExerciseIndex,
    enabled: canTrack && cameraActive,
    posePreviewLayoutRef,
    onRepDetected: handleRepDetected,
  });

  const autoRepCounting = Platform.OS === 'web' || supportsNativePoseDetection();
  const showSimulateButton = !__DEV__ && canTrack && !autoRepCounting;

  useRepFeedback(forTime.currentExerciseReps, {
    enabled: canTrack,
    soundEnabled: preferences.repSoundEnabled,
  });

  function handleCameraReady() {
    forTime.startWorkout();
  }

  const stepContext = useMemo(
    () =>
      getForTimeStepContext(forTime.currentExerciseIndex, config.exercises, config.structureConfig),
    [config.exercises, config.structureConfig, forTime.currentExerciseIndex],
  );

  const setupSubtitle = useMemo(() => {
    const typeLabel = getCustomWorkoutTypeLabel(config.workoutType);
    const stepCount = getForTimeStepCount(config.exercises, config.structureConfig);
    return `${typeLabel} · ${stepCount} steps · finish the circuit to stop the clock`;
  }, [config]);

  if (showWorkout && forTime.completed && savedResult) {
    return (
      <ChallengeWorkoutMode
        exerciseType={forTime.currentExercise.exerciseType}
        currentReps={forTime.currentExerciseReps}
        targetReps={forTime.currentExercise.targetReps}
        trackingStatus={trackingStatus}
        coachSeverity={coachSeverity}
        repPhase={posePhase}
        cameraActive={false}
        pullUpBarLineY={null}
        completed
        onContinue={handleLeave}
        completeOverlay={<ForTimeCompleteOverlay result={savedResult} />}
        footer={
          saveError ? (
            <Text style={[styles.error, { color: theme.danger }]}>{saveError}</Text>
          ) : isSaving ? (
            <Text style={[styles.meta, { color: theme.textSecondary }]}>Saving result…</Text>
          ) : undefined
        }
      />
    );
  }

  if (showWorkout) {
    return (
      <ChallengeWorkoutMode
        exerciseType={forTime.currentExercise.exerciseType}
        currentReps={forTime.currentExerciseReps}
        targetReps={forTime.currentExercise.targetReps}
        trackingStatus={trackingStatus}
        coachSeverity={coachSeverity}
        repPhase={posePhase}
        cameraActive={cameraActive}
        pullUpBarLineY={forTime.currentExercise.exerciseType === 'pull_ups' ? pullUpBarLineY : null}
        posePreviewLayoutRef={posePreviewLayoutRef}
        onCameraReady={handleCameraReady}
        onLandmarksDetected={processLandmarks}
        hudOverlay={
          <ForTimeWorkoutHud
            workoutTypeLabel={getCustomWorkoutTypeLabel(config.workoutType)}
            currentExercise={forTime.currentExercise}
            currentExerciseIndex={forTime.currentExerciseIndex}
            exerciseCount={forTime.steps.length}
            currentExerciseReps={forTime.currentExerciseReps}
            elapsedSeconds={elapsedSeconds}
            tierLabel={stepContext.tierLabel}
          />
        }
        footer={
          showSimulateButton ? (
            <PrimaryButton label="+ Simulate Rep" variant="secondary" onPress={forTime.registerRep} />
          ) : undefined
        }
        onDevSimulateRep={forTime.registerRep}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['bottom']}>
      <ChallengeWorkoutSetup
        exerciseLabel={config.title}
        exerciseType={forTime.currentExercise.exerciseType}
        targetReps={forTime.currentExercise.targetReps}
        subtitle={setupSubtitle}
        onStart={markWorkoutStarted}
        onCancel={handleLeave}
      />
    </SafeAreaView>
  );
}

export default function CustomWorkoutSessionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [config] = useState<CustomWorkoutLaunchConfig | null>(() => consumePendingCustomWorkoutLaunch());

  useEffect(() => {
    if (!config) {
      router.replace('/(tabs)/workouts');
    }
  }, [config, router]);

  if (!config) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (config.workoutType === 'amrap') {
    return <AmrapWorkoutSession config={config} />;
  }

  if (config.workoutType === 'for_time') {
    return <ForTimeWorkoutSession config={config} />;
  }

  return (
    <View style={[styles.loading, { backgroundColor: theme.background }]}>
      <Text style={[styles.error, { color: theme.danger }]}>This workout style is not supported yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
