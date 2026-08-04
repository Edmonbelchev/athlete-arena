import { useCallback, useEffect, useRef, useState } from 'react';

import { getInitialExercisePhase, type ExerciseType } from '@/constants/challenges';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';

import { createRepEngine } from './pose/createRepEngine';
import type { PoseLandmark } from './pose/landmarks';
import { PullUpRepEngine, type PullUpDebugSnapshot } from './pose/pullUpRepEngine';
import { PoseQualityGate, type PoseTrackingStatus } from './pose/poseQuality';

interface UseExercisePoseDetectionOptions {
  exerciseType: ExerciseType;
  enabled: boolean;
  onRepDetected: () => void;
}

export function useExercisePoseDetection({
  exerciseType,
  enabled,
  onRepDetected,
}: UseExercisePoseDetectionOptions) {
  const initialPhase = getInitialExercisePhase(exerciseType);
  const engineRef = useRef(createRepEngine(exerciseType));
  const qualityGateRef = useRef(new PoseQualityGate(exerciseType));
  const [phase, setPhase] = useState<ExercisePhase>(initialPhase);
  const [trackingStatus, setTrackingStatus] = useState<PoseTrackingStatus>('partial');
  const [trackingMessage, setTrackingMessage] = useState<string | null>(
    'Move into frame to start counting',
  );
  const [pullUpBarLineY, setPullUpBarLineY] = useState<number | null>(null);
  const [pullUpDebug, setPullUpDebug] = useState<PullUpDebugSnapshot | null>(null);
  const onRepDetectedRef = useRef(onRepDetected);

  onRepDetectedRef.current = onRepDetected;

  useEffect(() => {
    const nextInitialPhase = getInitialExercisePhase(exerciseType);
    engineRef.current = createRepEngine(exerciseType);
    qualityGateRef.current = new PoseQualityGate(exerciseType);
    setPhase(nextInitialPhase);
    setTrackingStatus('partial');
    setTrackingMessage('Move into frame to start counting');
    setPullUpBarLineY(null);
    setPullUpDebug(null);
  }, [exerciseType]);

  useEffect(() => {
    if (!enabled) {
      engineRef.current.reset();
      qualityGateRef.current.reset();
      setPhase(getInitialExercisePhase(exerciseType));
      setTrackingStatus('partial');
      setTrackingMessage(null);
      setPullUpBarLineY(null);
      setPullUpDebug(null);
    }
  }, [enabled, exerciseType]);

  const processLandmarks = useCallback(
    (landmarks: PoseLandmark[]) => {
      if (!enabled || landmarks.length === 0) {
        return;
      }

      const pullUpArmed =
        exerciseType === 'pull_ups' && (engineRef.current as PullUpRepEngine).armed;

      const quality = qualityGateRef.current.evaluate(landmarks, {
        pullUpArmed: exerciseType === 'pull_ups' ? pullUpArmed : undefined,
      });
      setTrackingStatus(quality.status);
      setTrackingMessage(quality.message);

      if (quality.shouldResetEngine) {
        engineRef.current.reset();
        setPhase(getInitialExercisePhase(exerciseType));
        if (exerciseType === 'pull_ups') {
          setPullUpBarLineY(null);
          setPullUpDebug(null);
        }
      }

      const keepUpdatingWhileArmed =
        exerciseType === 'pull_ups' &&
        pullUpArmed &&
        !quality.shouldResetEngine;

      if (!quality.canCountReps && !keepUpdatingWhileArmed) {
        return;
      }

      const repCompleted = engineRef.current.update(landmarks);
      setPhase(engineRef.current.phase);

      if (exerciseType === 'pull_ups') {
        const pullUpEngine = engineRef.current as PullUpRepEngine;
        setPullUpBarLineY(pullUpEngine.barLineY);
        setPullUpDebug(pullUpEngine.debugSnapshot);
        if (!pullUpEngine.armed) {
          setTrackingMessage(pullUpEngine.getHangHint(landmarks));
        } else if (quality.message) {
          setTrackingMessage(quality.message);
        } else {
          setTrackingMessage(null);
        }
      }

      if (repCompleted) {
        onRepDetectedRef.current();
      }
    },
    [enabled, exerciseType],
  );

  return {
    phase,
    trackingStatus,
    trackingMessage,
    pullUpBarLineY: exerciseType === 'pull_ups' ? pullUpBarLineY : null,
    pullUpDebug: exerciseType === 'pull_ups' ? pullUpDebug : null,
    processLandmarks,
  };
}
