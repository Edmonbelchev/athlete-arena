import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Delegate,
  MediapipeCamera,
  RunningMode,
  usePoseDetection,
  type Landmark,
  type ViewCoordinator,
} from 'react-native-mediapipe-posedetection';
import { useCameraPermission } from 'react-native-vision-camera';

import { PoseAngleOverlay } from '@/components/settings/PoseAngleOverlay';
import { PoseSkeletonOverlay } from '@/components/settings/PoseSkeletonOverlay';
import { PullUpBarLineOverlay } from '@/components/settings/PullUpBarLineOverlay';
import type { CameraFacing, CameraPreviewProps } from '@/components/CameraPreview.types';
import { mapLandmarksToViewNormalized } from '@/features/challenges/pose/mapLandmarksToView';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import { PoseLandmarkSmoother } from '@/features/challenges/pose/smoothPoseLandmarks';
import { usePoseDebugOverlay } from '@/features/challenges/pose/usePoseDebugOverlay';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const POSE_MODEL = 'pose_landmarker_lite.task';

/**
 * Development-build camera with on-device MediaPipe pose detection.
 */
export function VisionCameraPreview({
  active = true,
  onCameraReady,
  onLandmarksDetected,
  pullUpBarLineY = null,
  pullUpDebug = null,
}: CameraPreviewProps) {
  const theme = useTheme();
  const { preferences } = useUserSettings();
  const showPoseSkeleton = preferences.showPoseSkeleton;
  const showPoseDebugOverlay = usePoseDebugOverlay();
  const { hasPermission, requestPermission } = useCameraPermission();
  const onLandmarksRef = useRef(onLandmarksDetected);
  const onCameraReadyRef = useRef(onCameraReady);
  const viewDimensionsRef = useRef({ width: 1, height: 1 });
  const cameraReadyRef = useRef(false);
  const [facing, setFacing] = useState<CameraFacing>('front');
  const [trackingBody, setTrackingBody] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [latestLandmarks, setLatestLandmarks] = useState<PoseLandmark[] | null>(null);
  const [detectionLandmarks, setDetectionLandmarks] = useState<PoseLandmark[] | null>(null);
  const [viewBarLineY, setViewBarLineY] = useState<number | null>(null);
  const pullUpBarLineYRef = useRef(pullUpBarLineY);
  const showPoseDebugOverlayRef = useRef(showPoseDebugOverlay);
  const landmarkSmootherRef = useRef(new PoseLandmarkSmoother());

  pullUpBarLineYRef.current = pullUpBarLineY;
  showPoseDebugOverlayRef.current = showPoseDebugOverlay;

  onLandmarksRef.current = onLandmarksDetected;
  onCameraReadyRef.current = onCameraReady;

  useEffect(() => {
    if (!active || hasPermission) {
      return;
    }
    void requestPermission();
  }, [active, hasPermission, requestPermission]);

  const handleResults = useCallback(
    (
      landmarks: Landmark[],
      frameInfo: { inputImageWidth: number; inputImageHeight: number },
      viewCoordinator: ViewCoordinator,
    ) => {
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

      onLandmarksRef.current?.(viewLandmarks);
      if (showPoseDebugOverlayRef.current) {
        setDetectionLandmarks(viewLandmarks);
      }
      setLatestLandmarks(viewLandmarks);
      setViewBarLineY(pullUpBarLineYRef.current);
      setTrackingBody(true);
    },
    [],
  );

  const poseDetection = usePoseDetection(
    {
      onResults: (result, viewCoordinator) => {
        const firstPose = result.results[0]?.landmarks[0];
        if (firstPose?.length >= 33) {
          handleResults(firstPose, result, viewCoordinator);
        }
      },
      onError: (error) => {
        setDetectionError(error.message);
      },
    },
    RunningMode.LIVE_STREAM,
    POSE_MODEL,
    {
      numPoses: 1,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
      delegate: Delegate.GPU,
      mirrorMode: 'mirror-front-only',
    },
  );

  viewDimensionsRef.current = poseDetection.cameraViewDimensions;

  useEffect(() => {
    if (!active) {
      cameraReadyRef.current = false;
      return;
    }

    if (hasPermission && !cameraReadyRef.current) {
      cameraReadyRef.current = true;
      onCameraReadyRef.current?.();
    }
  }, [active, hasPermission]);

  useEffect(() => {
    if (!showPoseDebugOverlay) {
      setDetectionLandmarks(null);
    }
  }, [showPoseDebugOverlay]);

  useEffect(() => {
    landmarkSmootherRef.current.reset();
    setLatestLandmarks(null);
    setDetectionLandmarks(null);
    setViewBarLineY(null);
    setTrackingBody(false);
  }, [facing]);

  function handleFlipCamera() {
    setFacing((current) => (current === 'front' ? 'back' : 'front'));
  }

  if (!active) {
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
    <View
      style={StyleSheet.flatten([
        styles.container,
        styles.cameraContainer,
        { borderColor: theme.border },
      ])}>
      <MediapipeCamera style={styles.camera} solution={poseDetection} activeCamera={facing} />

      <PoseSkeletonOverlay
        landmarks={latestLandmarks}
        visible={showPoseSkeleton}
      />

      <PoseAngleOverlay
        landmarks={detectionLandmarks}
        visible={showPoseSkeleton && showPoseDebugOverlay}
        pullUpBarLineY={pullUpBarLineY}
        pullUpDebug={pullUpDebug}
      />

      <PullUpBarLineOverlay barLineY={viewBarLineY} visible={viewBarLineY !== null} />

      <View style={styles.topOverlay}>
        <Pressable
          accessibilityLabel="Flip camera"
          accessibilityRole="button"
          style={styles.flipButton}
          onPress={handleFlipCamera}>
          <Text style={styles.flipButtonText}>Flip</Text>
        </Pressable>
      </View>

      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          {detectionError
            ? 'Pose detection error - check dev build setup'
            : trackingBody
              ? 'Tracking - keep your body in frame'
              : 'Move into frame to start counting'}
        </Text>
      </View>
    </View>
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
  cameraContainer: {
    backgroundColor: '#000000',
    position: 'relative',
  },
  camera: {
    flex: 1,
    minHeight: 280,
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
    position: 'absolute',
    bottom: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
