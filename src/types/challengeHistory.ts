import type { ExerciseType } from '@/constants/challenges';
import { formatRaceTime } from '@/constants/friendChallenges';
import { formatCoinAmount } from '@/constants/coins';
import { getFriendChallengeEarnedRewards } from '@/constants/friendChallengeRewards';
import { DAILY_MISSION_COIN_REWARD } from '@/constants/dailyMissionRewards';
import type { ChallengeStatus } from '@/types/friends';

export type ChallengeHistoryKind = 'daily' | 'friend';

export interface ChallengeHistoryEntry {
  entryId: string;
  kind: ChallengeHistoryKind;
  exerciseType: ExerciseType;
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
    const coins = getFriendChallengeEarnedRewards(entry.xpEarned, null).coins;

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
  return entry.kind === 'daily' ? 'Daily challenge' : 'Friend speed race';
}

export function getHistoryScoreLine(entry: ChallengeHistoryEntry): string {
  if (entry.kind === 'friend' && entry.opponentUsername) {
    const opponent = getHistoryOpponentName(entry) ?? entry.opponentUsername;
    const opponentReps = entry.opponentCompletedReps ?? 0;

    if (entry.raceSeconds !== null) {
      const opponentTime =
        entry.opponentRaceSeconds !== null ? formatRaceTime(entry.opponentRaceSeconds) : '--:--';
      return `You ${formatRaceTime(entry.raceSeconds)} · ${opponent} ${opponentTime} · ${entry.completedReps}/${entry.targetReps} reps`;
    }

    return `You ${entry.completedReps}/${entry.targetReps} · ${opponent} ${opponentReps}/${entry.targetReps}`;
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
