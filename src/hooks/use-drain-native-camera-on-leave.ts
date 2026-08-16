import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Keeps the native pose camera running only while the workout screen is focused
 * and active. Stops the camera on blur so MediaPipe can drain before unmount
 * (see delayedPoseDetectorRelease + CameraPreview session teardown).
 */
export function useDrainNativeCameraOnLeave(workoutActive: boolean): boolean {
  const [cameraActive, setCameraActive] = useState(workoutActive);
  const workoutActiveRef = useRef(workoutActive);

  workoutActiveRef.current = workoutActive;

  useFocusEffect(
    useCallback(() => {
      setCameraActive(workoutActiveRef.current);

      return () => {
        setCameraActive(false);
      };
    }, []),
  );

  useEffect(() => {
    setCameraActive(workoutActive);
  }, [workoutActive]);

  return cameraActive;
}
