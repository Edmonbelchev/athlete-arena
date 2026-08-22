import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PosePreviewLayoutState } from '@/components/CameraPreview.types';
import { ChallengeWorkoutMode } from '@/components/challenges/ChallengeWorkoutMode';
import { ChallengeWorkoutSetup } from '@/components/challenges/ChallengeWorkoutSetup';
import { AmrapCompleteOverlay } from '@/components/workouts/AmrapCompleteOverlay';
import { AmrapWorkoutHud } from '@/components/workouts/AmrapWorkoutHud';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  formatWorkoutTimeLimit,
  getCustomWorkoutTypeLabel,
} from '@/constants/customWorkouts';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useExercisePoseDetection } from '@/features/challenges/useExercisePoseDetection';
import { useFriendChallengeRaceTimer } from '@/features/friends/useFriendChallengeRaceTimer';
import { consumePendingCustomWorkoutLaunch } from '@/features/workouts/customWorkoutLaunchStore';
import { useMissionComplete } from '@/features/challenges/MissionCompleteProvider';
import { useAmrapWorkout } from '@/features/workouts/useAmrapWorkout';
import { useProfile } from '@/features/profile/useProfile';
import { useDrainNativeCameraOnLeave } from '@/hooks/use-drain-native-camera-on-leave';
import { useRepFeedback } from '@/hooks/use-rep-feedback';
import { useWorkoutSession } from '@/hooks/use-workout-session';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import { supportsNativePoseDetection } from '@/lib/runtime';
import { saveCustomWorkoutSession } from '@/services/customWorkoutService';
import type { AmrapWorkoutResult, CustomWorkoutLaunchConfig } from '@/types/customWorkouts';
import { useTheme } from '@/hooks/use-theme';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';

function AmrapWorkoutSession({ config }: { config: CustomWorkoutLaunchConfig }) {
  const theme = useTheme();
  const router = useRouter();
  const { preferences } = useUserSettings();
  const { refresh: refreshProfile } = useProfile();
  const { refreshMissionsAndCelebrate } = useMissionComplete();
  const sessionKey = config.templateId ?? `${config.workoutType}:${config.title}`;
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
      await refreshMissionsAndCelebrate();
      void refreshProfile();
    } catch (err) {
      setSaveError(formatUserError(err, 'Failed to save workout result'));
    } finally {
      setIsSaving(false);
    }
  }, [refreshMissionsAndCelebrate, refreshProfile]);

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
    trackingMessage,
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
  const showSimulateButton = canTrack && !autoRepCounting;

  useRepFeedback(amrap.currentExerciseReps, {
    enabled: canTrack,
    soundEnabled: preferences.repSoundEnabled,
  });

  const handleLeave = useCallback(() => {
    leaveScreen(router, '/(tabs)/workouts');
  }, [router]);

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
        trackingMessage={trackingMessage}
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
        trackingMessage={trackingMessage}
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
