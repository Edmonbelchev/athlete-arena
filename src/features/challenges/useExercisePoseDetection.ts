import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';

import type { PosePreviewLayoutState } from '@/components/CameraPreview.types';
import { getInitialExercisePhase, type ExerciseType } from '@/constants/challenges';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';
import { type WorkoutCoachSeverity } from '@/features/challenges/workoutGuidance';
import { useStableState } from '@/hooks/use-stable-state';

import { ExercisePoseTracker } from './pose/exercisePoseTracker';
import type { PoseLandmark } from './pose/landmarks';
import type { PoseTrackingStatus } from './pose/poseQuality';

interface UseExercisePoseDetectionOptions {
  exerciseType: ExerciseType;
  /**
   * When false, reps are not counted (rest between rounds, countdowns, before the clock starts),
   * but landmarks keep flowing through the rep engine so the start position is already known
   * (green border, first rep counts) the moment counting is enabled again.
   */
  enabled: boolean;
  onRepDetected: () => void;
  posePreviewLayoutRef?: MutableRefObject<PosePreviewLayoutState>;
}

export function useExercisePoseDetection({
  exerciseType,
  enabled,
  onRepDetected,
  posePreviewLayoutRef,
}: UseExercisePoseDetectionOptions) {
  const trackerRef = useRef<ExercisePoseTracker | null>(null);
  if (trackerRef.current === null) {
    trackerRef.current = new ExercisePoseTracker(exerciseType);
  }

  const [phase, setPhase] = useStableState<ExercisePhase>(getInitialExercisePhase(exerciseType));
  const [trackingStatus, setTrackingStatus] = useStableState<PoseTrackingStatus>('partial');
  const [coachSeverity, setCoachSeverity] = useStableState<WorkoutCoachSeverity>('tracking');
  const [pullUpBarLineY, setPullUpBarLineY] = useStableState<number | null>(null);
  const onRepDetectedRef = useRef(onRepDetected);
  const previewLayoutRef = useRef(posePreviewLayoutRef);
  const enabledRef = useRef(enabled);
  const exerciseTypeRef = useRef(exerciseType);

  onRepDetectedRef.current = onRepDetected;
  previewLayoutRef.current = posePreviewLayoutRef;
  enabledRef.current = enabled;
  exerciseTypeRef.current = exerciseType;

  // A new exercise needs a new engine. The same exercise (next EMOM round, next AMRAP / for-time
  // step) keeps its warm engine so a user already in the start position stays ready.
  useEffect(() => {
    if (trackerRef.current?.setExercise(exerciseType)) {
      setPhase(getInitialExercisePhase(exerciseType));
      setTrackingStatus('partial');
      setCoachSeverity('tracking');
      setPullUpBarLineY(null);
    }
  }, [exerciseType, setCoachSeverity, setPhase, setPullUpBarLineY, setTrackingStatus]);

  const processLandmarks = useCallback(
    (landmarks: PoseLandmark[]) => {
      const tracker = trackerRef.current;
      if (!tracker) {
        return;
      }

      // Frames can arrive between a render with a new exercise and its effect - switch here too.
      tracker.setExercise(exerciseTypeRef.current);

      const previewLayout = previewLayoutRef.current?.current;
      const frame = tracker.process(landmarks, {
        counting: enabledRef.current,
        previewSettled: previewLayout ? previewLayout.settled : undefined,
      });

      setPhase(frame.phase);
      setTrackingStatus(frame.trackingStatus);
      setCoachSeverity(frame.coachSeverity);
      setPullUpBarLineY(frame.pullUpBarLineY);

      if (frame.repCounted) {
        onRepDetectedRef.current();
      }
    },
    [setCoachSeverity, setPhase, setPullUpBarLineY, setTrackingStatus],
  );

  return {
    phase,
    trackingStatus,
    coachSeverity,
    pullUpBarLineY: exerciseType === 'pull_ups' ? pullUpBarLineY : null,
    processLandmarks,
  };
}
