import { useEffect, useState } from 'react';

export function useFriendChallengeRaceTimer({
  startedAt,
  completedAt,
  maxSeconds,
  enabled,
  onExpire,
}: {
  startedAt: string | null;
  completedAt: string | null;
  maxSeconds: number | null;
  enabled: boolean;
  onExpire?: () => void;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const isStopped = Boolean(completedAt);

  useEffect(() => {
    if (!enabled || !startedAt) {
      setElapsedSeconds(0);
      setSecondsRemaining(maxSeconds);
      return;
    }

    const startMs = new Date(startedAt).getTime();
    const endMs = completedAt ? new Date(completedAt).getTime() : null;

    function tick() {
      const nowMs = endMs ?? Date.now();
      const elapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(elapsed);

      if (maxSeconds !== null) {
        const remaining = Math.max(0, maxSeconds - elapsed);
        setSecondsRemaining(remaining);

        if (!completedAt && remaining === 0) {
          onExpire?.();
        }
      } else {
        setSecondsRemaining(null);
      }
    }

    tick();

    if (completedAt) {
      return;
    }

    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [startedAt, completedAt, maxSeconds, enabled, onExpire]);

  return {
    elapsedSeconds,
    secondsRemaining,
    isExpired: maxSeconds !== null && !isStopped && (secondsRemaining ?? 1) === 0,
    isStopped,
  };
}
