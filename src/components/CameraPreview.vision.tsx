import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Delegate,
  MediapipeCamera,
  RunningMode,
  usePoseDetection,
  type Landmark,
  type ViewCoordinator,
} from 'react-native-mediapipe-posedetection';
import { useCameraPermission } from 'react-native-vision-camera';

import { RepCycleProgressBar } from '@/components/challenges/RepCycleProgressBar';
import { PoseSkeletonOverlay } from '@/components/settings/PoseSkeletonOverlay';
import { PullUpBarLineOverlay } from '@/components/settings/PullUpBarLineOverlay';
import type { CameraFacing, CameraPreviewProps } from '@/components/CameraPreview.types';
import { POSE_DISPLAY_SMOOTH_ALPHA } from '@/constants/poseDetection';
import {
  isDisplayFrameStale,
  POSE_DISPLAY_STALE_MS,
  shouldEmitDisplayFrame,
} from '@/features/challenges/pose/displayFrameThrottle';
import { mapLandmarksToViewNormalized } from '@/features/challenges/pose/mapLandmarksToView';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import { PoseLandmarkSmoother } from '@/features/challenges/pose/smoothPoseLandmarks';
import { POSE_DETECTOR_RELEASE_DELAY_MS } from '@/lib/mediapipe/delayedPoseDetectorRelease';
import { useCameraDebugOverlaysAccess } from '@/features/settings/cameraDebugAccess';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const POSE_MODEL = 'pose_landmarker_lite.task';

/** CPU is more stable on iOS; GPU can stall or crash under camera + inference load. */
const POSE_DELEGATE = Platform.OS === 'ios' ? Delegate.CPU : Delegate.GPU;

/** iOS preview is already mirrored; Android needs explicit front-camera mirroring. */
const POSE_MIRROR_MODE = Platform.select({
  ios: 'no-mirror' as const,
  android: 'mirror-front-only' as const,
  default: 'mirror-front-only' as const,
});

const POSE_DETECTION_OPTIONS = {
  numPoses: 1,
  minPoseDetectionConfidence: 0.45,
  minPosePresenceConfidence: 0.45,
  minTrackingConfidence: 0.45,
  delegate: POSE_DELEGATE,
  mirrorMode: POSE_MIRROR_MODE,
};

type ActiveVisionCameraProps = Omit<CameraPreviewProps, 'active'> & {
  facing: CameraFacing;
  cameraLive: boolean;
  onFlipCamera: () => void;
};

/**
 * Holds MediaPipe + Vision Camera hooks. Stop `cameraLive` before unmounting so
 * frame delivery ends while native inference drains.
 */
function VisionCameraPreviewActive({
  onCameraReady,
  onLandmarksDetected,
  pullUpBarLineY = null,
  exerciseType = 'push_ups',
  repPhase = 'UP',
  repTrackingReady = false,
  fullscreen = false,
  hideStatusOverlay = false,
  facing,
  cameraLive,
  onFlipCamera,
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
  const repLandmarkSmootherRef = useRef(new PoseLandmarkSmoother());
  const displayLandmarkSmootherRef = useRef(
    new PoseLandmarkSmoother({ alpha: POSE_DISPLAY_SMOOTH_ALPHA, smoothAll: true }),
  );
  const lastDisplayFrameAtRef = useRef(0);
  const lastBarLineYRef = useRef<number | null>(null);

  pullUpBarLineYRef.current = pullUpBarLineY;
  onLandmarksRef.current = onLandmarksDetected;
  onCameraReadyRef.current = onCameraReady;
  isActiveRef.current = cameraLive;

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

      try {
        const mappedLandmarks = mapLandmarksToViewNormalized(
          landmarks,
          frameInfo,
          viewCoordinator,
          width,
          height,
        );

        const viewLandmarks = repLandmarkSmootherRef.current.smooth(mappedLandmarks);
        onLandmarksRef.current?.(viewLandmarks);

        const now = performance.now();
        if (shouldEmitDisplayFrame(lastDisplayFrameAtRef.current, now)) {
          lastDisplayFrameAtRef.current = now;
          setLatestLandmarks(displayLandmarkSmootherRef.current.smooth(mappedLandmarks));
          setTrackingBody(true);

          const nextBarLineY = pullUpBarLineYRef.current;
          if (nextBarLineY !== lastBarLineYRef.current) {
            lastBarLineYRef.current = nextBarLineY;
            setViewBarLineY(nextBarLineY);
          }
        }
      } catch {
        // ViewCoordinator can throw during camera layout/orientation transitions.
      }
    },
    [],
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
      }
    }, POSE_DISPLAY_STALE_MS / 2);

    return () => clearInterval(interval);
  }, []);

  viewDimensionsRef.current = poseDetection.cameraViewDimensions;
  const { width: viewWidth, height: viewHeight } = poseDetection.cameraViewDimensions;

  useEffect(() => {
    if (!cameraReadyRef.current) {
      cameraReadyRef.current = true;
      onCameraReadyRef.current?.();
    }
  }, []);

  useEffect(() => {
    repLandmarkSmootherRef.current.reset();
    displayLandmarkSmootherRef.current.reset();
    setLatestLandmarks(null);
    setViewBarLineY(null);
    setTrackingBody(false);
    lastDisplayFrameAtRef.current = 0;
    lastBarLineYRef.current = null;
    cameraReadyRef.current = false;
  }, [facing]);

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
          activeCamera={facing}
        />
      ) : (
        <View style={StyleSheet.flatten([styles.camera, fullscreen ? styles.cameraFullscreen : null])} />
      )}

      <PoseSkeletonOverlay
        landmarks={latestLandmarks}
        visible={showPoseSkeleton && cameraLive}
        viewWidth={viewWidth}
        viewHeight={viewHeight}
      />

      <PullUpBarLineOverlay
        barLineY={viewBarLineY}
        visible={cameraLive && viewBarLineY !== null}
        viewWidth={viewWidth}
        viewHeight={viewHeight}
      />

      <View style={styles.topOverlay}>
        <Pressable
          accessibilityLabel="Flip camera"
          accessibilityRole="button"
          style={styles.flipButton}
          onPress={onFlipCamera}
          disabled={!cameraLive}>
          <Text style={styles.flipButtonText}>Flip</Text>
        </Pressable>
      </View>

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
  pullUpBarLineY = null,
  exerciseType = 'push_ups',
  repPhase = 'UP',
  repTrackingReady = false,
  fullscreen = false,
  hideStatusOverlay = false,
}: CameraPreviewProps) {
  const theme = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [facing, setFacing] = useState<CameraFacing>('front');
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
      key={facing}
      facing={facing}
      cameraLive={cameraLive}
      onFlipCamera={() => setFacing((current) => (current === 'front' ? 'back' : 'front'))}
      onCameraReady={onCameraReady}
      onLandmarksDetected={onLandmarksDetected}
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
