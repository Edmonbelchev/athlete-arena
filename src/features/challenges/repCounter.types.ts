export interface RepCounterCallbacks {
  onRepDetected: (repCount: number) => void;
}

export interface RepCounter {
  currentReps: number;
  start: () => void;
  stop: () => void;
  /** Dev-only until pose detection is implemented. */
  simulateRep: () => void;
  reset: () => void;
}

export type RepCounterState = 'idle' | 'running' | 'stopped';
