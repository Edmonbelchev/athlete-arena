import type { ReactNode } from 'react';
import type { MutableRefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraPreview } from '@/components/CameraPreview';
import type { PosePreviewLayoutState } from '@/components/CameraPreview.types';
import { ChallengeRepHud, type ChallengeRepHudRaceTimer } from '@/components/challenges/ChallengeRepHud';
import { WorkoutGuideAnimation } from '@/components/challenges/WorkoutGuideAnimation';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { DevSimulateRepButton } from '@/dev/DevSimulateRepButton';
import type { ExerciseType } from '@/constants/challenges';
import { Radius, Spacing } from '@/constants/theme';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';
import {
  getCoachBorderColor,
  type WorkoutCoachSeverity,
} from '@/features/challenges/workoutGuidance';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import type { PoseTrackingStatus } from '@/features/challenges/pose/poseQuality';
import { WorkoutExerciseTransitionOverlay } from '@/components/workouts/WorkoutExerciseTransitionOverlay';
import { useExerciseTransitionAnnouncement } from '@/hooks/use-exercise-transition-announcement';
import { useKeepAwakeWhileActive } from '@/hooks/use-keep-awake-while-active';
import { useWorkoutGuideAnimationVisible } from '@/hooks/use-workout-guide-animation-visible';
import { useWorkoutLayout } from '@/hooks/use-workout-layout';
import { useWorkoutOrientation } from '@/hooks/use-workout-orientation';
import { useTheme } from '@/hooks/use-theme';

interface ChallengeWorkoutModeProps {
  exerciseType: ExerciseType;
  currentReps: number;
  targetReps: number;
  trackingStatus: PoseTrackingStatus;
  coachSeverity?: WorkoutCoachSeverity;
  repPhase: ExercisePhase;
  cameraActive: boolean;
  pullUpBarLineY: number | null;
  posePreviewLayoutRef?: MutableRefObject<PosePreviewLayoutState>;
  onCameraReady: () => void;
  onLandmarksDetected: (landmarks: PoseLandmark[]) => void;
  completed?: boolean;
  completeOverlay?: ReactNode;
  onContinue?: () => void;
  raceTimer?: ChallengeRepHudRaceTimer | null;
  footer?: ReactNode;
  hudOverlay?: ReactNode;
  centerOverlay?: ReactNode;
  exerciseTransitionKey?: string | number;
  repSoundEnabled?: boolean;
  onDevSimulateRep?: () => void;
  devSimulateDisabled?: boolean;
  devSimulateLoading?: boolean;
}

export function ChallengeWorkoutMode({
  exerciseType,
  currentReps,
  targetReps,
  trackingStatus,
  coachSeverity = 'setup',
  repPhase,
  cameraActive,
  pullUpBarLineY,
  posePreviewLayoutRef,
  onCameraReady,
  onLandmarksDetected,
  completed = false,
  completeOverlay,
  onContinue,
  raceTimer = null,
  footer,
  hudOverlay,
  centerOverlay,
  exerciseTransitionKey,
  repSoundEnabled = true,
  onDevSimulateRep,
  devSimulateDisabled,
  devSimulateLoading,
}: ChallengeWorkoutModeProps) {
  const theme = useTheme();
  const showCompletionOnly = completed && Boolean(completeOverlay);
  const exerciseTransitionLabel = useExerciseTransitionAnnouncement(
    exerciseType,
    exerciseTransitionKey,
    {
      enabled: exerciseTransitionKey !== undefined && cameraActive && !completed,
      soundEnabled: repSoundEnabled,
    },
  );
  const trackingReady = trackingStatus === 'ready';
  const showGuideAnimation = useWorkoutGuideAnimationVisible(
    trackingStatus,
    cameraActive && !completed,
  );
  const trackingBorderColor = getCoachBorderColor(trackingStatus, coachSeverity, theme, {
    inactive: !cameraActive,
    completed,
  });

  const { isLandscape } = useWorkoutLayout();
  const insets = useSafeAreaInsets();

  useWorkoutOrientation(!showCompletionOnly);
  useKeepAwakeWhileActive(!showCompletionOnly);

  if (showCompletionOnly) {
    return (
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['top', 'bottom']}>
        <View style={styles.completionRoot}>
          <View style={styles.completionContent}>{completeOverlay}</View>
          {onContinue ? (
            <View style={styles.completionFooter}>
              <PrimaryButton label="Continue" onPress={onContinue} />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const cameraShellStyle = StyleSheet.flatten([
    styles.cameraShell,
    { borderColor: trackingBorderColor, borderWidth: TRACKING_BORDER_WIDTH },
  ]);

  const camera = (
    <CameraPreview
      active={cameraActive}
      fullscreen
      hideStatusOverlay
      posePreviewLayoutRef={posePreviewLayoutRef}
      pullUpBarLineY={pullUpBarLineY}
      exerciseType={exerciseType}
      repPhase={repPhase}
      repTrackingReady={trackingReady}
      onCameraReady={onCameraReady}
      onLandmarksDetected={onLandmarksDetected}
    />
  );

  const overlays = (
    <>
      {showGuideAnimation ? (
        <View
          style={StyleSheet.flatten([styles.guideOverlay, isLandscape ? styles.guideOverlayLandscape : null])}
          pointerEvents="none">
          <WorkoutGuideAnimation exerciseType={exerciseType} variant="overlay" />
        </View>
      ) : null}
      {hudOverlay ?? (
        <ChallengeRepHud
          currentReps={currentReps}
          targetReps={targetReps}
          exerciseType={exerciseType}
          completed={completed}
          raceTimer={raceTimer}
        />
      )}
      {centerOverlay}
      <WorkoutExerciseTransitionOverlay label={exerciseTransitionLabel} />
    </>
  );

  const hasControls = Boolean(footer || onDevSimulateRep);
  const controls = hasControls ? (
    <>
      {onDevSimulateRep ? (
        <DevSimulateRepButton
          onPress={onDevSimulateRep}
          disabled={devSimulateDisabled}
          loading={devSimulateLoading}
          size={isLandscape ? 'compact' : 'default'}
        />
      ) : null}
      {footer}
    </>
  ) : null;

  if (isLandscape) {
    // Full-bleed camera; overlays and controls float inside the safe area (clear of the notch).
    return (
      <View style={StyleSheet.flatten([styles.safeArea, { backgroundColor: '#000000' }])}>
        <View style={cameraShellStyle}>
          {camera}
          <View
            pointerEvents="box-none"
            style={StyleSheet.flatten([
              StyleSheet.absoluteFill,
              { paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: insets.bottom },
            ])}>
            <View pointerEvents="box-none" style={styles.overlayArea}>
              {overlays}
              {controls ? <View style={styles.floatingControls}>{controls}</View> : null}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={StyleSheet.flatten([styles.safeArea, { backgroundColor: '#000000' }])}
      edges={['top', 'bottom']}>
      <View style={styles.cameraColumn}>
        <View style={cameraShellStyle}>
          {camera}
          {overlays}
        </View>
      </View>

      {controls ? (
        <View style={StyleSheet.flatten([styles.footer, { backgroundColor: theme.background }])}>{controls}</View>
      ) : null}
    </SafeAreaView>
  );
}

const TRACKING_BORDER_WIDTH = 3;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  cameraColumn: {
    flex: 1,
  },
  cameraShell: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  guideOverlay: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.five,
  },
  /** Bottom-left in landscape - the floating controls own the bottom-right corner. */
  guideOverlayLandscape: {
    right: undefined,
    left: Spacing.three,
    bottom: Spacing.three,
  },
  overlayArea: {
    flex: 1,
    position: 'relative',
  },
  /** Landscape controls float over the camera so it keeps the full screen width. */
  floatingControls: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    width: 160,
    padding: Spacing.one,
    gap: Spacing.one,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    zIndex: 5,
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  completionRoot: {
    flex: 1,
  },
  completionContent: {
    flex: 1,
  },
  completionFooter: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
});
