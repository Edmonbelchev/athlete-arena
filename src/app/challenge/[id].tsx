import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraPreview } from '@/components/CameraPreview';
import { PoseGuidanceBanner } from '@/components/PoseGuidanceBanner';
import { EmoteDisplay } from '@/components/shop/EmoteDisplay';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatExerciseLabel } from '@/constants/challenges';
import { DAILY_CHALLENGE_COIN_REWARD, formatXpAndCoins } from '@/constants/coins';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useChallenge } from '@/features/challenges/useChallenge';
import { useExercisePoseDetection } from '@/features/challenges/useExercisePoseDetection';
import { useRepCounter } from '@/features/challenges/useRepCounter';
import { useShop } from '@/features/shop/ShopProvider';
import { completeChallenge } from '@/services/challengeService';
import { formatUserError } from '@/lib/errors';
import { supportsNativePoseDetection } from '@/lib/runtime';
import { useTheme } from '@/hooks/use-theme';

export default function ChallengeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { challenge, isLoading, error, applyChallenge } = useChallenge(id);
  const { equippedEmote } = useShop();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
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

      isSyncingRef.current = true;
      setIsSyncing(true);
      setSyncError(null);

      try {
        const updated = await completeChallenge(activeChallenge.id, repCount);
        applyChallenge(updated);
      } catch (err) {
        setSyncError(formatUserError(err, 'Failed to sync repetition'));
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
    trackingMessage,
    pullUpBarLineY,
    pullUpDebug,
    processLandmarks,
  } = useExercisePoseDetection({
    exerciseType: challenge?.exercise_type ?? 'push_ups',
    enabled: Boolean(challenge) && !isCompleted,
    onRepDetected: () => {
      repCounter.simulateRep();
    },
  });

  const progress = targetReps > 0 ? Math.min(repCounter.currentReps / targetReps, 1) : 0;
  const autoRepCounting =
    Platform.OS === 'web' || supportsNativePoseDetection();
  const showSimulateButton = !isCompleted && !autoRepCounting;

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
          <Text style={StyleSheet.flatten([styles.reps, { color: theme.text }])}>
            {repCounter.currentReps} / {challenge.target_reps}
          </Text>

          <View style={styles.cameraFrame}>
            <CameraPreview
              active={!isCompleted}
              pullUpBarLineY={challenge.exercise_type === 'pull_ups' ? pullUpBarLineY : null}
              pullUpDebug={challenge.exercise_type === 'pull_ups' ? pullUpDebug : null}
              onCameraReady={() => {
                repCounter.start();
              }}
              onLandmarksDetected={processLandmarks}
            />
          </View>

          {!isCompleted ? <PoseGuidanceBanner exerciseType={challenge.exercise_type} /> : null}

          {!isCompleted && autoRepCounting ? (
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

          <View style={StyleSheet.flatten([styles.progressTrack, { backgroundColor: theme.backgroundSelected }])}>
            <View
              style={StyleSheet.flatten([
                styles.progressFill,
                { backgroundColor: theme.primary, width: `${progress * 100}%` },
              ])}
            />
          </View>

          {isCompleted ? (
            <View
              style={StyleSheet.flatten([
                styles.completedBanner,
                { backgroundColor: theme.backgroundElement, borderColor: theme.success },
              ])}>
              <Text style={StyleSheet.flatten([styles.completedTitle, { color: theme.success }])}>
                CHALLENGE COMPLETE
              </Text>
              <EmoteDisplay emoji={equippedEmote} />
              <Text style={StyleSheet.flatten([styles.completedReward, { color: theme.xp }])}>
                {formatXpAndCoins(challenge.xp_reward, DAILY_CHALLENGE_COIN_REWARD)} earned
              </Text>
            </View>
          ) : showSimulateButton ? (
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
            label={isCompleted ? 'Done' : 'Cancel'}
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
  },
  completedReward: {
    fontSize: 18,
    fontWeight: '800',
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
