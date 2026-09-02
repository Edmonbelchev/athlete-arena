import type { ExerciseType } from '@/constants/challenges';
import type { ChallengeStatus, DailyChallengeHome } from '@/types';

export interface DailyMissionPatch {
  userChallengeId: string;
  exerciseType?: ExerciseType;
  missionIndex?: number;
  status: ChallengeStatus | 'not_started';
  completedReps: number;
  completedAt?: string | null;
}

type RefreshListener = (missions?: DailyChallengeHome[]) => void;
type PatchListener = (patch: DailyMissionPatch) => void;

const refreshListeners = new Set<RefreshListener>();
const patchListeners = new Set<PatchListener>();

export function subscribeDailyChallengeRefresh(listener: RefreshListener): () => void {
  refreshListeners.add(listener);
  return () => {
    refreshListeners.delete(listener);
  };
}

export function notifyDailyChallengeRefresh(missions?: DailyChallengeHome[]): void {
  for (const listener of refreshListeners) {
    listener(missions);
  }
}

export function subscribeDailyMissionPatch(listener: PatchListener): () => void {
  patchListeners.add(listener);
  return () => {
    patchListeners.delete(listener);
  };
}

export function applyDailyMissionPatch(patch: DailyMissionPatch): void {
  for (const listener of patchListeners) {
    listener(patch);
  }
}
