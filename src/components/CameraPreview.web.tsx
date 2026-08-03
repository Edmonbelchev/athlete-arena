import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CameraFacing, CameraPreviewProps } from '@/components/CameraPreview.types';
import { PoseAngleOverlay } from '@/components/settings/PoseAngleOverlay';
import {
  clearPoseSkeleton,
  drawPoseSkeleton,
  drawPullUpBarLine,
  syncCanvasToVideo,
} from '@/features/challenges/pose/drawPoseSkeleton';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import { usePoseDebugOverlay } from '@/features/challenges/pose/usePoseDebugOverlay';
import { createWebPoseLandmarker, type WebPoseLandmarker } from '@/lib/mediapipeWeb';
import { POSE_QUALITY } from '@/constants/poseDetection';
import { Radius, Spacing } from '@/constants/theme';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';
import { useTheme } from '@/hooks/use-theme';

const ANGLE_HUD_MIN_INTERVAL_MS = 100;

function mapLandmarks(
  landmarks: { x: number; y: number; z?: number; visibility?: number }[],
): PoseLandmark[] {
  return landmarks.map((landmark) => ({
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility,
  }));
}

/**
 * Web camera preview with MediaPipe pose landmark detection and skeleton overlay.
 */
export function CameraPreview({
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<WebPoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onLandmarksRef = useRef(onLandmarksDetected);
  const onCameraReadyRef = useRef(onCameraReady);
  const themeRef = useRef(theme);
  const showSkeletonRef = useRef(showPoseSkeleton);
  const showPoseDebugOverlayRef = useRef(showPoseDebugOverlay);
  const pullUpBarLineYRef = useRef(pullUpBarLineY);
  const lastAngleHudAtRef = useRef(0);
  const [facing, setFacing] = useState<CameraFacing>('front');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'permission_denied'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trackingBody, setTrackingBody] = useState(false);
  const [latestLandmarks, setLatestLandmarks] = useState<PoseLandmark[] | null>(null);

  onLandmarksRef.current = onLandmarksDetected;
  onCameraReadyRef.current = onCameraReady;
  themeRef.current = theme;
  showSkeletonRef.current = showPoseSkeleton;
  showPoseDebugOverlayRef.current = showPoseDebugOverlay;
  pullUpBarLineYRef.current = pullUpBarLineY;

  useEffect(() => {
    if (!showPoseSkeleton || !showPoseDebugOverlay) {
      setLatestLandmarks(null);
    }
  }, [showPoseSkeleton, showPoseDebugOverlay]);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    let animationFrame = 0;
    let trackingTimeout: ReturnType<typeof setTimeout> | null = null;

    async function setup() {
      try {
        setStatus('loading');
        setTrackingBody(false);
        setLatestLandmarks(null);

        const landmarker = await createWebPoseLandmarker();

        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing === 'front' ? 'user' : 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          return;
        }

        video.srcObject = stream;
        await video.play();
        onCameraReadyRef.current?.();
        setStatus('ready');

        const detect = () => {
          if (cancelled || !landmarkerRef.current || !videoRef.current) {
            return;
          }

          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');

          if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const result = landmarkerRef.current.detectForVideo(
              videoRef.current,
              performance.now(),
            );
            const landmarks = result.landmarks[0];

            if (canvas && ctx) {
              syncCanvasToVideo(canvas, videoRef.current);

              if (landmarks && canvas.width > 0 && canvas.height > 0) {
                const mapped = mapLandmarks(landmarks);
                if (showSkeletonRef.current) {
                  drawPoseSkeleton(ctx, mapped, canvas.width, canvas.height, {
                    lineColor: themeRef.current.primary,
                    lineWidth: 3,
                    jointColor: '#FFFFFF',
                    jointRadius: 4,
                    minVisibility: POSE_QUALITY.skeletonMinVisibility,
                  });

                  const now = performance.now();
                  if (
                    showPoseDebugOverlayRef.current &&
                    now - lastAngleHudAtRef.current >= ANGLE_HUD_MIN_INTERVAL_MS
                  ) {
                    lastAngleHudAtRef.current = now;
                    setLatestLandmarks(mapped);
                  }
                } else {
                  clearPoseSkeleton(ctx, canvas.width, canvas.height);
                }

                const barLineY = pullUpBarLineYRef.current;
                if (barLineY !== null) {
                  drawPullUpBarLine(ctx, barLineY, canvas.width, canvas.height);
                }
                onLandmarksRef.current?.(mapped);
                setTrackingBody(true);
                if (trackingTimeout) {
                  clearTimeout(trackingTimeout);
                }
                trackingTimeout = setTimeout(() => setTrackingBody(false), 800);
              } else {
                clearPoseSkeleton(ctx, canvas.width, canvas.height);
              }
            } else if (landmarks) {
              onLandmarksRef.current?.(mapLandmarks(landmarks));
            }
          }

          animationFrame = requestAnimationFrame(detect);
        };

        detect();
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setStatus('permission_denied');
          setErrorMessage('Camera permission was denied.');
          return;
        }

        if (error instanceof DOMException && error.name === 'NotFoundError') {
          setStatus('error');
          setErrorMessage('No camera found on this device.');
          return;
        }

        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to start pose detection');
      }
    }

    void setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      if (trackingTimeout) {
        clearTimeout(trackingTimeout);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [active, facing]);

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

  if (status === 'permission_denied') {
    return (
      <View
        style={StyleSheet.flatten([
          styles.container,
          styles.centered,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Camera access needed</Text>
        <Text style={StyleSheet.flatten([styles.message, { color: theme.textSecondary }])}>
          {errorMessage ?? 'Allow camera access in your browser to enable automatic rep counting.'}
        </Text>
        <Text style={StyleSheet.flatten([styles.message, { color: theme.textSecondary }])}>
          Click the camera icon in your browser address bar, then reload this page.
        </Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View
        style={StyleSheet.flatten([
          styles.container,
          styles.centered,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <Text style={StyleSheet.flatten([styles.title, { color: theme.danger }])}>Camera unavailable</Text>
        <Text style={StyleSheet.flatten([styles.message, { color: theme.textSecondary }])}>
          {errorMessage}
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
      <div style={facing === 'front' ? mirrorStageStyle : stageStyle}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted style={videoStyle} />
        <canvas ref={canvasRef} style={canvasStyle} />
      </div>

      {status === 'loading' ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.overlayText}>Starting camera…</Text>
        </View>
      ) : null}

      <PoseAngleOverlay
        landmarks={latestLandmarks}
        visible={showPoseSkeleton && showPoseDebugOverlay}
        pullUpBarLineY={pullUpBarLineY}
        pullUpDebug={pullUpDebug}
      />

      <View style={styles.topOverlay}>
        <Pressable
          style={styles.flipButton}
          onPress={() => setFacing((current) => (current === 'front' ? 'back' : 'front'))}>
          <Text style={styles.flipButtonText}>Flip</Text>
        </Pressable>
      </View>

      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          {trackingBody ? 'Tracking - keep your body in frame' : 'Move into frame to start counting'}
        </Text>
      </View>
    </View>
  );
}

const stageStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 280,
  position: 'relative',
};

const mirrorStageStyle: React.CSSProperties = {
  ...stageStyle,
  transform: 'scaleX(-1)',
};

const videoStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 280,
  objectFit: 'cover',
  backgroundColor: '#000',
};

const canvasStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
};

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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    gap: Spacing.two,
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
