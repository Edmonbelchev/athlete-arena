import type { ExerciseType } from '@/constants/challenges';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ChallengeHistoryEntry } from '@/types/challengeHistory';
import type { ChallengeStatus } from '@/types/friends';

type QuestLogRow = {
  entry_id: string;
  exercise_type: ExerciseType;
  target_reps: number;
  completed_reps: number;
  xp_reward: number;
  status: ChallengeStatus;
  challenge_date: string;
  result_at: string;
};

function mapQuestLogEntry(row: QuestLogRow): ChallengeHistoryEntry {
  return {
    entryId: row.entry_id,
    kind: 'daily',
    exerciseType: row.exercise_type,
    targetReps: row.target_reps,
    completedReps: row.completed_reps,
    xpReward: row.xp_reward,
    status: row.status,
    resultAt: row.result_at,
    opponentUsername: null,
    opponentDisplayName: null,
    opponentCompletedReps: null,
    opponentStatus: null,
    raceSeconds: null,
    opponentRaceSeconds: null,
    winnerUserId: null,
    xpEarned: null,
    friendChallengeKind: null,
    workoutTitle: null,
    workoutType: null,
    completedRounds: null,
    opponentCompletedRounds: null,
  };
}

export async function getQuestLog(
  completed: boolean,
  limit: number,
  offset: number,
): Promise<ChallengeHistoryEntry[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_quest_log', {
    p_completed: completed,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapQuestLogEntry(row as QuestLogRow));
}
