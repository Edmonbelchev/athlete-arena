import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ExerciseType } from '@/constants/challenges';
import type { ChallengeStatus, FriendChallenge } from '@/types/friends';
import type { FriendChallengeRpcRow } from '@/types/database';

function mapFriendChallenge(row: FriendChallengeRpcRow): FriendChallenge {
  return {
    participantId: row.participant_id,
    challengeId: row.challenge_id,
    exerciseType: row.exercise_type,
    targetReps: row.target_reps,
    xpReward: row.xp_reward,
    message: row.message,
    timeLimitSeconds: row.time_limit_seconds,
    deadlineAt: row.deadline_at,
    status: row.status,
    completedReps: row.completed_reps,
    completedAt: row.completed_at,
    startedAt: row.started_at,
    xpEarned: row.xp_earned,
    createdAt: row.created_at,
    creatorId: row.creator_id,
    creatorUsername: row.creator_username,
    creatorDisplayName: row.creator_display_name,
    isCreator: row.is_creator,
    opponentId: row.opponent_id,
    opponentUsername: row.opponent_username,
    opponentDisplayName: row.opponent_display_name,
    opponentStatus: row.opponent_status,
    opponentCompletedReps: row.opponent_completed_reps,
    opponentCompletedAt: row.opponent_completed_at,
    opponentStartedAt: row.opponent_started_at,
    winnerUserId: row.winner_user_id,
    resolvedAt: row.resolved_at,
    creatorEmoteId: row.creator_emote_id ?? null,
    creatorEmoteEmoji: row.creator_emote_emoji ?? null,
  };
}

export async function getMyFriendChallenges(): Promise<FriendChallenge[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_my_friend_challenges');

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapFriendChallenge);
}

export async function getFriendChallengeByParticipantId(
  participantId: string,
): Promise<FriendChallenge | null> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_friend_challenge_detail', {
    p_participant_id: participantId,
  });

  if (error) {
    throw error;
  }

  const row = (data ?? [])[0];
  return row ? mapFriendChallenge(row) : null;
}

export async function createFriendChallenge(
  friendId: string,
  exerciseType: ExerciseType,
  targetReps: number,
  message?: string,
  timeLimitSeconds?: number | null,
  emoteId?: string | null,
): Promise<string> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('create_friend_challenge', {
    p_friend_id: friendId,
    p_exercise: exerciseType,
    p_target_reps: targetReps,
    p_message: message ?? null,
    p_time_limit_seconds: timeLimitSeconds ?? null,
    p_emote_id: emoteId ?? null,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Failed to create friend challenge');
  }

  return data as string;
}

export async function acceptFriendChallenge(participantId: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('accept_friend_challenge', {
    p_participant_id: participantId,
  });

  if (error) {
    throw error;
  }
}

export async function declineFriendChallenge(participantId: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('decline_friend_challenge', {
    p_participant_id: participantId,
  });

  if (error) {
    throw error;
  }
}

export async function startFriendChallenge(participantId: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('start_friend_challenge', {
    p_participant_id: participantId,
  });

  if (error) {
    throw error;
  }
}

export async function completeFriendChallenge(
  participantId: string,
  completedReps: number,
): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('complete_friend_challenge', {
    p_participant_id: participantId,
    p_completed_reps: completedReps,
  });

  if (error) {
    throw error;
  }
}
