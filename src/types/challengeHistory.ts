import type { ExerciseType } from '@/constants/challenges';
import { formatExerciseLabel } from '@/constants/challenges';
import { formatRaceTime } from '@/constants/friendChallenges';
import { formatCoinAmount } from '@/constants/coins';
import {
  getFriendChallengeEarnedRewards,
  isFriendChallengeExerciseType,
} from '@/constants/friendChallengeRewards';
import { DAILY_MISSION_COIN_REWARD } from '@/constants/dailyMissionRewards';
import type { ChallengeStatus } from '@/types/friends';
import type { CustomWorkoutType } from '@/types/customWorkouts';

export type ChallengeHistoryKind = 'daily' | 'friend';
export type ChallengeHistoryFriendKind = 'exercise' | 'workout';

export interface ChallengeHistoryEntry {
  entryId: string;
  kind: ChallengeHistoryKind;
  exerciseType: ExerciseType | null;
  targetReps: number;
  completedReps: number;
  xpReward: number;
  status: ChallengeStatus;
  resultAt: string;
  opponentUsername: string | null;
  opponentDisplayName: string | null;
  opponentCompletedReps: number | null;
  opponentStatus: ChallengeStatus | null;
  raceSeconds: number | null;
  opponentRaceSeconds: number | null;
  winnerUserId: string | null;
  xpEarned: number | null;
  friendChallengeKind: ChallengeHistoryFriendKind | null;
  workoutTitle: string | null;
  workoutType: CustomWorkoutType | null;
  completedRounds: number | null;
  opponentCompletedRounds: number | null;
}

export function getHistoryOpponentName(entry: ChallengeHistoryEntry): string | null {
  if (!entry.opponentUsername) {
    return null;
  }
  return entry.opponentDisplayName ?? entry.opponentUsername;
}

export function getHistoryResultLabel(entry: ChallengeHistoryEntry, myUserId?: string): string {
  if (entry.kind === 'daily') {
    if (entry.status === 'completed') {
      return `Completed · +${entry.xpReward} XP · ${formatCoinAmount(DAILY_MISSION_COIN_REWARD)}`;
    }
    return 'Missed';
  }

  if (entry.status === 'expired') {
    return 'Time cap reached';
  }

  if (entry.status === 'declined') {
    return 'Declined';
  }

  if (entry.status === 'completed') {
    const earned = entry.xpEarned ?? entry.xpReward;
    const coins = getFriendChallengeEarnedRewards(entry.xpEarned, null, {
      exerciseType: isFriendChallengeExerciseType(entry.exerciseType)
        ? entry.exerciseType
        : undefined,
      targetReps: entry.targetReps,
    }).coins;

    if (entry.winnerUserId && myUserId) {
      const coinSuffix = coins > 0 ? ` · ${formatCoinAmount(coins)}` : '';

      if (entry.winnerUserId === myUserId) {
        return `Won the race · +${earned} XP${coinSuffix}`;
      }
      return `Lost the race · +${earned} XP${coinSuffix}`;
    }

    if (entry.raceSeconds !== null && entry.opponentRaceSeconds !== null) {
      if (entry.raceSeconds === entry.opponentRaceSeconds) {
        const coinSuffix = coins > 0 ? ` · ${formatCoinAmount(coins)}` : '';
        return `Tie race · +${earned} XP${coinSuffix}`;
      }
    }

    const coinSuffix = coins > 0 ? ` · ${formatCoinAmount(coins)}` : '';
    return `Completed · +${earned} XP${coinSuffix}`;
  }

  return entry.status;
}

export function getHistoryKindLabel(entry: ChallengeHistoryEntry): string {
  if (entry.kind === 'daily') {
    return 'Daily challenge';
  }

  if (entry.friendChallengeKind === 'workout') {
    return entry.workoutType === 'for_time' ? 'Friend For Time' : 'Friend workout';
  }

  return entry.raceSeconds !== null ? 'Friend speed race' : 'Friend challenge';
}

export function getHistoryTitle(entry: ChallengeHistoryEntry): string {
  if (entry.workoutTitle) {
    return entry.workoutTitle;
  }

  if (entry.exerciseType) {
    return `${entry.targetReps} ${formatExerciseLabel(entry.exerciseType, true)}`;
  }

  return 'Friend challenge';
}

export function getHistoryScoreLine(entry: ChallengeHistoryEntry): string {
  if (entry.kind === 'friend' && entry.opponentUsername) {
    const opponent = getHistoryOpponentName(entry) ?? entry.opponentUsername;
    const opponentReps = entry.opponentCompletedReps ?? 0;

    if (entry.friendChallengeKind === 'workout') {
      if (entry.workoutType === 'for_time' && entry.raceSeconds !== null) {
        const opponentTime =
          entry.opponentRaceSeconds !== null ? formatRaceTime(entry.opponentRaceSeconds) : '--:--';
        return `You ${formatRaceTime(entry.raceSeconds)} · ${opponent} ${opponentTime}`;
      }

      const myRounds = entry.completedRounds ?? 0;
      const opponentRounds = entry.opponentCompletedRounds ?? 0;
      return `You ${myRounds} rounds · ${opponent} ${opponentRounds} rounds`;
    }

    if (entry.raceSeconds !== null) {
      const opponentTime =
        entry.opponentRaceSeconds !== null ? formatRaceTime(entry.opponentRaceSeconds) : '--:--';
      return `You ${formatRaceTime(entry.raceSeconds)} · ${opponent} ${opponentTime} · ${entry.completedReps}/${entry.targetReps} reps`;
    }

    return `You ${entry.completedReps}/${entry.targetReps} · ${opponent} ${opponentReps}/${entry.targetReps}`;
  }

  if (entry.friendChallengeKind === 'workout') {
    if (entry.workoutType === 'for_time' && entry.raceSeconds !== null) {
      return `Finished in ${formatRaceTime(entry.raceSeconds)}`;
    }

    return `${entry.completedRounds ?? 0} rounds completed`;
  }

  return `${entry.completedReps} / ${entry.targetReps} reps`;
}

export function getHistoryStatusColorKey(
  entry: ChallengeHistoryEntry,
  myUserId?: string,
): 'success' | 'danger' | 'muted' | 'xp' {
  if (entry.kind === 'daily' && entry.status !== 'completed') {
    return 'muted';
  }

  if (entry.kind === 'friend' && entry.status === 'completed' && entry.winnerUserId && myUserId) {
    return entry.winnerUserId === myUserId ? 'success' : 'danger';
  }

  switch (entry.status) {
    case 'completed':
      return 'success';
    case 'expired':
    case 'declined':
      return 'danger';
    default:
      return 'muted';
  }
}
