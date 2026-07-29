import { useEffect, useState } from 'react';

interface UseFriendChallengeTimerOptions {
  deadlineAt: string | null;
  enabled?: boolean;
  onExpire?: () => void;
}

export function useFriendChallengeTimer({
  deadlineAt,
  enabled = true,
  onExpire,
}: UseFriendChallengeTimerOptions) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(() => {
    if (!deadlineAt) {
      return null;
    }
    return Math.max(0, Math.floor((new Date(deadlineAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!enabled || !deadlineAt) {
      setSecondsRemaining(null);
      return;
    }

    const deadline = deadlineAt;

    function tick() {
      const remaining = Math.max(
        0,
        Math.floor((new Date(deadline).getTime() - Date.now()) / 1000),
      );
      setSecondsRemaining(remaining);

      if (remaining === 0) {
        onExpire?.();
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadlineAt, enabled, onExpire]);

  return {
    secondsRemaining,
    isExpired: secondsRemaining === 0,
    hasTimer: deadlineAt !== null,
  };
}
