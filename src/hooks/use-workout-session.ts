import { useCallback, useEffect, useState } from 'react';

const workoutStartedByKey = new Map<string, boolean>();

function pruneOtherSessions(activeKey: string): void {
  for (const key of [...workoutStartedByKey.keys()]) {
    if (key !== activeKey) {
      workoutStartedByKey.delete(key);
    }
  }
}

/**
 * Persists "workout started" across iOS orientation remounts for the same challenge,
 * without leaving stale state on other routes (unlike URL params).
 */
export function useWorkoutSession(scope: string, entityId: string | undefined) {
  const sessionKey = entityId ? `${scope}:${entityId}` : '';
  const [workoutStarted, setWorkoutStarted] = useState(
    () => (sessionKey ? (workoutStartedByKey.get(sessionKey) ?? false) : false),
  );

  useEffect(() => {
    if (!sessionKey) {
      setWorkoutStarted(false);
      return;
    }

    pruneOtherSessions(sessionKey);
    setWorkoutStarted(workoutStartedByKey.get(sessionKey) ?? false);
  }, [sessionKey]);

  const startWorkout = useCallback(() => {
    if (!sessionKey) {
      return;
    }

    workoutStartedByKey.set(sessionKey, true);
    setWorkoutStarted(true);
  }, [sessionKey]);

  return { workoutStarted, startWorkout };
}
