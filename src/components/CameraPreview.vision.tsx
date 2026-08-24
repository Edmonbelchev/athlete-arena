import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  Delegate,
  MediapipeCamera,
  RunningMode,
  usePoseDetection,
  type Landmark,
  type ViewCoordinator,
} from 'react-native-mediapipe-posedetection';
import { useCameraPermission } from 'react-native-vision-camera';

import type { CameraPreviewProps } from '@/components/CameraPreview.types';
import { RepCycleProgressBar } from '@/components/challenges/RepCycleProgressBar';
import { PoseSkeletonOverlay } from '@/components/settings/PoseSkeletonOverlay';
import { PullUpBarLineOverlay } from '@/components/settings/PullUpBarLineOverlay';
import { POSE_LANDSCAPE_POST_SETTLE_FRAMES, POSE_LANDMARK_SMOOTH_ALPHA, POSE_LANDMARK_SMOOTH_ALPHA_JUMPING_JACK, POSE_LANDMARK_SMOOTH_ALPHA_PULL_UP } from '@/constants/poseDetection';
import { Radius, Spacing } from '@/constants/theme';
import {
  isDisplayFrameStale,
  POSE_DISPLAY_STALE_MS,
  shouldEmitDisplayFrame,
} from '@/features/challenges/pose/displayFrameThrottle';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import { mapLandmarksToViewNormalized } from '@/features/challenges/pose/mapLandmarksToView';
import { arePoseLandmarksPlausible } from '@/features/challenges/pose/poseLandmarkSanity';
import { PoseViewSettleGate } from '@/features/challenges/pose/poseViewSettle';
import { PoseLandmarkSmoother } from '@/features/challenges/pose/smoothPoseLandmarks';
import { useCameraDebugOverlaysAccess } from '@/features/settings/cameraDebugAccess';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';
import { useTheme } from '@/hooks/use-theme';
import { POSE_DETECTOR_RELEASE_DELAY_MS } from '@/lib/mediapipe/delayedPoseDetectorRelease';

const POSE_MODEL = 'pose_landmarker_lite.task';

/** CPU is more stable on iOS; GPU can stall or crash under camera + inference load. */
const POSE_DELEGATE = Platform.OS === 'ios' ? Delegate.CPU : Delegate.GPU;

const POSE_DETECTION_OPTIONS = {
  numPoses: 1,
  minPoseDetectionConfidence: 0.45,
  minPosePresenceConfidence: 0.45,
  minTrackingConfidence: 0.45,
  delegate: POSE_DELEGATE,
  mirrorMode: 'mirror-front-only' as const,
};

function getPoseLandmarkSmoothAlpha(exerciseType: ActiveVisionCameraProps['exerciseType']): number {
  if (exerciseType === 'pull_ups') {
    return POSE_LANDMARK_SMOOTH_ALPHA_PULL_UP;
  }

  if (exerciseType === 'jumping_jacks') {
    return POSE_LANDMARK_SMOOTH_ALPHA_JUMPING_JACK;
  }

  return POSE_LANDMARK_SMOOTH_ALPHA;
}

type ActiveVisionCameraProps = Omit<CameraPreviewProps, 'active'> & {
  cameraLive: boolean;
};

/**
 * Holds MediaPipe + Vision Camera hooks. Stop `cameraLive` before unmounting so
 * frame delivery ends while native inference drains.
 */
function VisionCameraPreviewActive({
  onCameraReady,
  onLandmarksDetected,
  posePreviewLayoutRef,
  pullUpBarLineY = null,
  exerciseType = 'push_ups',
  repPhase = 'UP',
  repTrackingReady = false,
  fullscreen = false,
  hideStatusOverlay = false,
  cameraLive,
}: ActiveVisionCameraProps) {
  const theme = useTheme();
  const { preferences } = useUserSettings();
  const cameraDebugOverlaysEnabled = useCameraDebugOverlaysAccess();
  const showPoseSkeleton = cameraDebugOverlaysEnabled && preferences.showPoseSkeleton;
  const showRepProgressBar = cameraDebugOverlaysEnabled && preferences.showRepProgressBar;
  const onLandmarksRef = useRef(onLandmarksDetected);
  const onCameraReadyRef = useRef(onCameraReady);
  const viewDimensionsRef = useRef({ width: 1, height: 1 });
  const cameraReadyRef = useRef(false);
  const isActiveRef = useRef(true);
  const [trackingBody, setTrackingBody] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [latestLandmarks, setLatestLandmarks] = useState<PoseLandmark[] | null>(null);
  const [viewBarLineY, setViewBarLineY] = useState<number | null>(null);
  const pullUpBarLineYRef = useRef(pullUpBarLineY);
  const landmarkSmootherRef = useRef(new PoseLandmarkSmoother(getPoseLandmarkSmoothAlpha(exerciseType)));
  const viewSettleGateRef = useRef(new PoseViewSettleGate());
  const postSettleFramesRef = useRef(0);
  const lastDisplayFrameAtRef = useRef(0);
  const lastBarLineYRef = useRef<number | null>(null);

  pullUpBarLineYRef.current = pullUpBarLineY;
  onLandmarksRef.current = onLandmarksDetected;
  onCameraReadyRef.current = onCameraReady;
  isActiveRef.current = cameraLive;

  useEffect(() => {
    landmarkSmootherRef.current = new PoseLandmarkSmoother(getPoseLandmarkSmoothAlpha(exerciseType));
  }, [exerciseType]);

  useEffect(() => {
    if (!cameraLive) {
      setLatestLandmarks(null);
      setViewBarLineY(null);
      setTrackingBody(false);
      lastDisplayFrameAtRef.current = 0;
    }
  }, [cameraLive]);

  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
      onLandmarksRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const gate = viewSettleGateRef.current;
    gate.setOnSettled(() => {
      landmarkSmootherRef.current.reset();
      postSettleFramesRef.current = gate.isLandscape() ? POSE_LANDSCAPE_POST_SETTLE_FRAMES : 0;
      if (!cameraReadyRef.current) {
        cameraReadyRef.current = true;
        onCameraReadyRef.current?.();
      }
    });

    return () => {
      gate.dispose();
    };
  }, []);

  const syncPreviewLayoutState = useCallback(
    (settled: boolean) => {
      if (!posePreviewLayoutRef) {
        return;
      }

      posePreviewLayoutRef.current = {
        isLandscape: viewSettleGateRef.current.isLandscape(),
        settled,
      };
    },
    [posePreviewLayoutRef],
  );

  const handleResults = useCallback(
    (
      landmarks: Landmark[],
      frameInfo: { inputImageWidth: number; inputImageHeight: number },
      viewCoordinator: ViewCoordinator,
    ) => {
      if (!isActiveRef.current) {
        return;
      }

      const { width, height } = viewDimensionsRef.current;
      if (width <= 0 || height <= 0) {
        return;
      }

      const viewLandmarks = landmarkSmootherRef.current.smooth(
        mapLandmarksToViewNormalized(
          landmarks,
          frameInfo,
          viewCoordinator,
          width,
          height,
        ),
      );

      if (!viewSettleGateRef.current.isSettled()) {
        syncPreviewLayoutState(false);
        return;
      }

      if (postSettleFramesRef.current > 0) {
        postSettleFramesRef.current -= 1;
        syncPreviewLayoutState(false);
        return;
      }

      if (!arePoseLandmarksPlausible(viewLandmarks)) {
        syncPreviewLayoutState(true);
        onLandmarksRef.current?.([]);
        return;
      }

      syncPreviewLayoutState(true);
      onLandmarksRef.current?.(viewLandmarks);

      const now = performance.now();
      if (shouldEmitDisplayFrame(lastDisplayFrameAtRef.current, now)) {
        lastDisplayFrameAtRef.current = now;
        setLatestLandmarks(viewLandmarks);
        setTrackingBody(true);

        const nextBarLineY = pullUpBarLineYRef.current;
        if (nextBarLineY !== lastBarLineYRef.current) {
          lastBarLineYRef.current = nextBarLineY;
          setViewBarLineY(nextBarLineY);
        }
      }
    },
    [syncPreviewLayoutState],
  );

  const onPoseResults = useCallback(
    (
      result: { results: { landmarks: Landmark[][] }[]; inputImageWidth: number; inputImageHeight: number },
      viewCoordinator: ViewCoordinator,
    ) => {
      if (!isActiveRef.current) {
        return;
      }

      const firstPose = result.results[0]?.landmarks[0];
      if (firstPose?.length >= 33) {
        handleResults(firstPose, result, viewCoordinator);
      }
    },
    [handleResults],
  );

  const onPoseError = useCallback((error: { message: string }) => {
    if (!isActiveRef.current) {
      return;
    }

    setDetectionError(error.message);
  }, []);

  const poseCallbacks = useMemo(
    () => ({
      onResults: onPoseResults,
      onError: onPoseError,
    }),
    [onPoseError, onPoseResults],
  );

  const poseDetection = usePoseDetection(
    poseCallbacks,
    RunningMode.LIVE_STREAM,
    POSE_MODEL,
    POSE_DETECTION_OPTIONS,
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isActiveRef.current) {
        return;
      }

      if (isDisplayFrameStale(lastDisplayFrameAtRef.current)) {
        setLatestLandmarks(null);
        setTrackingBody(false);
        lastDisplayFrameAtRef.current = 0;
        onLandmarksRef.current?.([]);
      }
    }, POSE_DISPLAY_STALE_MS / 2);

    return () => clearInterval(interval);
  }, []);

  viewDimensionsRef.current = poseDetection.cameraViewDimensions;

  const cameraViewWidth = poseDetection.cameraViewDimensions.width;
  const cameraViewHeight = poseDetection.cameraViewDimensions.height;

  useEffect(() => {
    viewSettleGateRef.current.update(cameraViewWidth, cameraViewHeight);
    syncPreviewLayoutState(viewSettleGateRef.current.isSettled());
  }, [cameraViewHeight, cameraViewWidth, syncPreviewLayoutState]);

  useEffect(() => {
    viewSettleGateRef.current.reset();
    postSettleFramesRef.current = 0;
    landmarkSmootherRef.current.reset();
    setLatestLandmarks(null);
    setViewBarLineY(null);
    setTrackingBody(false);
    lastDisplayFrameAtRef.current = 0;
    lastBarLineYRef.current = null;
    cameraReadyRef.current = false;
    syncPreviewLayoutState(false);
  }, [syncPreviewLayoutState]);

  return (
    <View
      style={StyleSheet.flatten([
        styles.container,
        fullscreen ? styles.containerFullscreen : null,
        styles.cameraContainer,
        { borderColor: theme.border },
      ])}>
      {cameraLive ? (
        <MediapipeCamera
          style={StyleSheet.flatten([styles.camera, fullscreen ? styles.cameraFullscreen : null])}
          solution={poseDetection}
          activeCamera="front"
        />
      ) : (
        <View style={StyleSheet.flatten([styles.camera, fullscreen ? styles.cameraFullscreen : null])} />
      )}

      <PoseSkeletonOverlay landmarks={latestLandmarks} visible={showPoseSkeleton && cameraLive} />

      <PullUpBarLineOverlay barLineY={viewBarLineY} visible={cameraLive && viewBarLineY !== null} />

      <View style={styles.bottomOverlay}>
        <RepCycleProgressBar
          exerciseType={exerciseType}
          phase={repPhase}
          visible={showRepProgressBar && cameraLive}
          trackingReady={repTrackingReady}
        />
        {!hideStatusOverlay ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>
              {!cameraLive
                ? 'Closing camera…'
                : detectionError
                  ? 'Pose detection error - check dev build setup'
                  : trackingBody
                    ? 'Tracking - keep your body in frame'
                    : 'Move into frame to start counting'}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Development-build camera with on-device MediaPipe pose detection.
 */
export function VisionCameraPreview({
  active = true,
  onCameraReady,
  onLandmarksDetected,
  posePreviewLayoutRef,
  pullUpBarLineY = null,
  exerciseType = 'push_ups',
  repPhase = 'UP',
  repTrackingReady = false,
  fullscreen = false,
  hideStatusOverlay = false,
}: CameraPreviewProps) {
  const theme = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [sessionMounted, setSessionMounted] = useState(active);
  const [cameraLive, setCameraLive] = useState(active);

  useEffect(() => {
    if (active) {
      setSessionMounted(true);
      setCameraLive(true);
      return;
    }

    setCameraLive(false);
    const timer = setTimeout(() => {
      setSessionMounted(false);
    }, POSE_DETECTOR_RELEASE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (!active || hasPermission) {
      return;
    }
    void requestPermission();
  }, [active, hasPermission, requestPermission]);

  if (!sessionMounted) {
    return (
      <View
        style={StyleSheet.flatten([
          styles.container,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <Text style={StyleSheet.flatten([styles.message, { color: theme.textSecondary }])}>
          Camera paused - challenge complete.
        </Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View
        style={StyleSheet.flatten([
          styles.container,
          styles.centered,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Camera access needed</Text>
        <Text style={StyleSheet.flatten([styles.message, { color: theme.textSecondary }])}>
          Allow camera access to enable automatic rep counting on this device.
        </Text>
      </View>
    );
  }

  return (
    <VisionCameraPreviewActive
      cameraLive={cameraLive}
      onCameraReady={onCameraReady}
      onLandmarksDetected={onLandmarksDetected}
      posePreviewLayoutRef={posePreviewLayoutRef}
      pullUpBarLineY={pullUpBarLineY}
      exerciseType={exerciseType}
      repPhase={repPhase}
      repTrackingReady={repTrackingReady}
      fullscreen={fullscreen}
      hideStatusOverlay={hideStatusOverlay}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 280,
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  containerFullscreen: {
    minHeight: 0,
    borderRadius: 0,
    borderWidth: 0,
  },
  cameraContainer: {
    backgroundColor: '#000000',
    position: 'relative',
  },
  camera: {
    flex: 1,
    minHeight: 280,
  },
  cameraFullscreen: {
    minHeight: 0,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  topOverlay: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
  },
  flipButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  flipButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  overlay: {
    marginHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: Spacing.three,
    left: 0,
    right: 0,
    gap: Spacing.one,
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
