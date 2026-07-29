import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ExerciseType } from '@/constants/challenges';
import type { ChallengeHistoryEntry, ChallengeHistoryKind } from '@/types/challengeHistory';
import type { ChallengeStatus } from '@/types/friends';

function mapHistoryEntry(row: {
  entry_id: string;
  kind: string;
  exercise_type: ExerciseType;
  target_reps: number;
  completed_reps: number;
  xp_reward: number;
  status: ChallengeStatus;
  result_at: string;
  opponent_username: string | null;
  opponent_display_name: string | null;
  opponent_completed_reps: number | null;
  opponent_status: ChallengeStatus | null;
  race_seconds?: number | null;
  opponent_race_seconds?: number | null;
  winner_user_id?: string | null;
  xp_earned?: number | null;
}): ChallengeHistoryEntry {
  return {
    entryId: row.entry_id,
    kind: row.kind as ChallengeHistoryKind,
    exerciseType: row.exercise_type,
    targetReps: row.target_reps,
    completedReps: row.completed_reps,
    xpReward: row.xp_reward,
    status: row.status,
    resultAt: row.result_at,
    opponentUsername: row.opponent_username,
    opponentDisplayName: row.opponent_display_name,
    opponentCompletedReps: row.opponent_completed_reps,
    opponentStatus: row.opponent_status,
    raceSeconds: row.race_seconds ?? null,
    opponentRaceSeconds: row.opponent_race_seconds ?? null,
    winnerUserId: row.winner_user_id ?? null,
    xpEarned: row.xp_earned ?? null,
  };
}

export async function getChallengeHistory(limit = 50): Promise<ChallengeHistoryEntry[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_challenge_history', {
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapHistoryEntry);
}
