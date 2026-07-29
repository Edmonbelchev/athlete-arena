import { useCallback, useEffect, useRef, useState } from 'react';

import type { RepCounter, RepCounterCallbacks, RepCounterState } from './repCounter.types';

interface UseRepCounterOptions extends RepCounterCallbacks {
  targetReps: number;
  initialReps?: number;
  enabled?: boolean;
}

export function useRepCounter({
  targetReps,
  initialReps = 0,
  enabled = true,
  onRepDetected,
}: UseRepCounterOptions): RepCounter & {
  state: RepCounterState;
  targetReps: number;
  isComplete: boolean;
} {
  const [currentReps, setCurrentReps] = useState(initialReps);
  const [state, setState] = useState<RepCounterState>(initialReps > 0 ? 'running' : 'idle');
  const currentRepsRef = useRef(initialReps);

  useEffect(() => {
    currentRepsRef.current = initialReps;
    setCurrentReps(initialReps);

    if (initialReps >= targetReps) {
      setState('stopped');
    } else if (initialReps > 0) {
      setState('running');
    } else {
      setState('idle');
    }
  }, [initialReps, targetReps]);

  const registerRep = useCallback(() => {
    if (!enabled || currentRepsRef.current >= targetReps) {
      return;
    }

    currentRepsRef.current += 1;
    setCurrentReps(currentRepsRef.current);
    setState('running');
    onRepDetected(currentRepsRef.current);

    if (currentRepsRef.current >= targetReps) {
      setState('stopped');
    }
  }, [enabled, onRepDetected, targetReps]);

  const start = useCallback(() => {
    if (!enabled) {
      return;
    }

    setState('running');
  }, [enabled]);

  const stop = useCallback(() => {
    setState('stopped');
  }, []);

  const reset = useCallback(() => {
    currentRepsRef.current = initialReps;
    setCurrentReps(initialReps);
    setState(initialReps > 0 ? 'running' : 'idle');
  }, [initialReps]);

  const simulateRep = useCallback(() => {
    registerRep();
  }, [registerRep]);

  return {
    currentReps,
    targetReps,
    state,
    isComplete: currentReps >= targetReps,
    start,
    stop,
    simulateRep,
    reset,
  };
}
