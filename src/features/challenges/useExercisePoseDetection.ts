import { useCallback, useEffect, useRef, useState } from 'react';

import type { ExerciseType } from '@/constants/challenges';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';

import { createRepEngine } from './pose/createRepEngine';
import type { PoseLandmark } from './pose/landmarks';

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
  const engineRef = useRef(createRepEngine(exerciseType));
  const [phase, setPhase] = useState<ExercisePhase>(
    exerciseType === 'push_ups' ? 'UP' : 'STANDING',
  );
  const onRepDetectedRef = useRef(onRepDetected);

  onRepDetectedRef.current = onRepDetected;

  useEffect(() => {
    engineRef.current = createRepEngine(exerciseType);
    setPhase(exerciseType === 'push_ups' ? 'UP' : 'STANDING');
  }, [exerciseType]);

  useEffect(() => {
    if (!enabled) {
      engineRef.current.reset();
      setPhase(exerciseType === 'push_ups' ? 'UP' : 'STANDING');
    }
  }, [enabled, exerciseType]);

  const processLandmarks = useCallback(
    (landmarks: PoseLandmark[]) => {
      if (!enabled || landmarks.length === 0) {
        return;
      }

      const repCompleted = engineRef.current.update(landmarks);
      setPhase(engineRef.current.phase);

      if (repCompleted) {
        onRepDetectedRef.current();
      }
    },
    [enabled],
  );

  return {
    phase,
    processLandmarks,
  };
}
