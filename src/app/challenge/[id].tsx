import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraPreview } from '@/components/CameraPreview';
import { DailyMissionCompleteOverlay } from '@/components/challenges/DailyMissionCompleteOverlay';
import { PoseGuidanceBanner } from '@/components/PoseGuidanceBanner';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatExerciseLabel } from '@/constants/challenges';
import {
  DAILY_MISSION_COIN_REWARD,
  DAILY_MISSION_XP_REWARD,
} from '@/constants/dailyMissionRewards';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useChallenge } from '@/features/challenges/useChallenge';
import { useExercisePoseDetection } from '@/features/challenges/useExercisePoseDetection';
import { useRepCounter } from '@/features/challenges/useRepCounter';
import { useShop } from '@/features/shop/ShopProvider';
import { useDrainNativeCameraOnLeave } from '@/hooks/use-drain-native-camera-on-leave';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { supportsNativePoseDetection } from '@/lib/runtime';
import { completeChallenge } from '@/services/challengeService';

export default function ChallengeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { challenge, isLoading, error, applyChallenge } = useChallenge(id);
  const { equippedEmote } = useShop();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const cameraActive = useDrainNativeCameraOnLeave();
  const isSyncingRef = useRef(false);
  const challengeRef = useRef(challenge);

  challengeRef.current = challenge;

  const isCompleted = challenge?.status === 'completed';
  const targetReps = challenge?.target_reps ?? 0;

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
      } catch (err) {
        setSyncError(formatUserError(err, 'Failed to complete challenge'));
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [applyChallenge],
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
    pullUpBarLineY,
    processLandmarks,
  } = useExercisePoseDetection({
    exerciseType: challenge?.exercise_type ?? 'push_ups',
    enabled: Boolean(challenge) && !isCompleted && cameraActive,
    onRepDetected: () => {
      repCounter.simulateRep();
    },
  });

  const autoRepCounting =
    Platform.OS === 'web' || supportsNativePoseDetection();
  const showSimulateButton = !isCompleted && !autoRepCounting;
  const earnedXp = challenge && isCompleted ? DAILY_MISSION_XP_REWARD : 0;
  const earnedCoins = challenge && isCompleted ? DAILY_MISSION_COIN_REWARD : 0;

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

  return (
    <>
      <Stack.Screen options={{ title: 'Challenge', headerShown: true }} />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Text style={StyleSheet.flatten([styles.exercise, { color: theme.textSecondary }])}>
            {formatExerciseLabel(challenge.exercise_type, true)}
          </Text>
          <Text
            style={StyleSheet.flatten([
              styles.reps,
              { color: isCompleted ? theme.success : theme.text },
            ])}>
            {repCounter.currentReps} / {challenge.target_reps}
          </Text>

          <View style={styles.cameraFrame}>
            <CameraPreview
              active={cameraActive}
              pullUpBarLineY={challenge.exercise_type === 'pull_ups' ? pullUpBarLineY : null}
              exerciseType={challenge.exercise_type}
              repPhase={posePhase}
              repTrackingReady={trackingStatus === 'ready'}
              onCameraReady={() => {
                repCounter.start();
              }}
              onLandmarksDetected={processLandmarks}
            />
            {isCompleted ? (
              <DailyMissionCompleteOverlay
                targetReps={challenge.target_reps}
                exerciseLabel={formatExerciseLabel(challenge.exercise_type, true)}
                xp={earnedXp}
                coins={earnedCoins}
                emote={equippedEmote}
              />
            ) : null}
          </View>

          {!isCompleted ? <PoseGuidanceBanner exerciseType={challenge.exercise_type} /> : null}

          {!isCompleted && showSimulateButton ? (
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
            label={isCompleted ? 'Back to Missions' : 'Cancel'}
            variant={isCompleted ? 'primary' : 'secondary'}
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
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
