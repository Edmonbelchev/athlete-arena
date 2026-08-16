import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/features/auth';
import {
  subscribeDailyChallengeRefresh,
  subscribeDailyMissionPatch,
  type DailyMissionPatch,
} from '@/lib/dailyChallengeSync';
import { formatUserError } from '@/lib/errors';
import { getDailyChallengeHome } from '@/services/challengeService';
import type { DailyChallengeHome } from '@/types';

interface RefreshOptions {
  /** Skip the full-screen loading state (focus return, post-completion sync). */
  silent?: boolean;
}

interface UseDailyChallengeResult {
  missions: DailyChallengeHome[];
  isLoading: boolean;
  error: string | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
}

function missionMatchesPatch(mission: DailyChallengeHome, patch: DailyMissionPatch): boolean {
  if (mission.userChallengeId === patch.userChallengeId) {
    return true;
  }

  if (!patch.exerciseType) {
    return false;
  }

  if (mission.exerciseType !== patch.exerciseType) {
    return false;
  }

  if (
    typeof patch.missionIndex === 'number' &&
    mission.missionIndex !== patch.missionIndex
  ) {
    return false;
  }

  return mission.userChallengeId === null || mission.userChallengeId === patch.userChallengeId;
}

function mergeMissionPatch(
  missions: DailyChallengeHome[],
  patch: DailyMissionPatch,
): DailyChallengeHome[] {
  return missions.map((mission) =>
    missionMatchesPatch(mission, patch)
      ? {
          ...mission,
          userChallengeId: patch.userChallengeId,
          status: patch.status,
          completedReps: patch.completedReps,
          completedAt: patch.completedAt ?? mission.completedAt,
        }
      : mission,
  );
}

export function useDailyChallenge(): UseDailyChallengeResult {
  const { session } = useAuth();
  const [missions, setMissions] = useState<DailyChallengeHome[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async (options?: RefreshOptions) => {
    if (!session) {
      setMissions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;

    if (!options?.silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const nextMissions = await getDailyChallengeHome();
      if (requestId !== requestIdRef.current) {
        return;
      }
      setMissions(nextMissions);
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setMissions([]);
      setError(formatUserError(err, 'Failed to load daily missions'));
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return subscribeDailyChallengeRefresh(() => {
      void refresh({ silent: true });
    });
  }, [refresh]);

  useEffect(() => {
    return subscribeDailyMissionPatch((patch) => {
      setMissions((current) => mergeMissionPatch(current, patch));
    });
  }, []);

  return {
    missions,
    isLoading,
    error,
    refresh,
  };
}
