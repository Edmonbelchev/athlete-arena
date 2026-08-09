import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CameraPreview } from '@/components/CameraPreview';
import { PoseGuidanceBanner } from '@/components/PoseGuidanceBanner';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import { useExercisePoseDetection } from '@/features/challenges/useExercisePoseDetection';
import { useRepCounter } from '@/features/challenges/useRepCounter';
import { ONBOARDING_CAMERA } from '@/features/onboarding/onboardingContent';
import { useTheme } from '@/hooks/use-theme';
import { supportsNativePoseDetection } from '@/lib/runtime';

interface OnboardingCameraTryProps {
  onContinue: () => void;
}

export function OnboardingCameraTry({ onContinue }: OnboardingCameraTryProps) {
  const theme = useTheme();
  const targetReps = ONBOARDING_CAMERA.targetReps;
  const exerciseType = ONBOARDING_CAMERA.exerciseType;

  const repCounter = useRepCounter({
    targetReps,
    enabled: true,
    onRepDetected: () => {
      repCounter.simulateRep();
    },
  });

  const { processLandmarks, phase, trackingStatus, pullUpBarLineY } =
    useExercisePoseDetection({
    exerciseType,
    enabled: true,
    onRepDetected: () => {
      repCounter.simulateRep();
    },
  });

  const autoRepCounting = Platform.OS === 'web' || supportsNativePoseDetection();
  const showSimulateButton = !autoRepCounting;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>{ONBOARDING_CAMERA.title}</Text>
      <Text style={StyleSheet.flatten([styles.description, { color: theme.textSecondary }])}>
        {ONBOARDING_CAMERA.description}
      </Text>

      <View
        style={StyleSheet.flatten([
          styles.cameraWrap,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <CameraPreview
          active
          onCameraReady={() => repCounter.start()}
          onLandmarksDetected={processLandmarks}
          pullUpBarLineY={pullUpBarLineY}
          exerciseType={exerciseType}
          repPhase={phase}
          repTrackingReady={trackingStatus === 'ready'}
        />
      </View>

      <PoseGuidanceBanner exerciseType={exerciseType} />

      <View
        style={StyleSheet.flatten([
          styles.repCard,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <Text style={StyleSheet.flatten([styles.repLabel, { color: theme.textSecondary }])}>Practice reps</Text>
        <Text style={StyleSheet.flatten([styles.repCount, { color: theme.text }])}>
          {repCounter.currentReps} / {targetReps}
        </Text>
      </View>
      <PrimaryButton
        label={repCounter.isComplete ? 'Nice work - Continue' : 'Continue without finishing'}
        onPress={onContinue}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  cameraWrap: {
    height: 280,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  repCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  repLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  repCount: {
    fontSize: 22,
    fontWeight: '900',
  },
});
