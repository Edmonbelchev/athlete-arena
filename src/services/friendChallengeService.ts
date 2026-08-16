import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ExerciseType } from '@/constants/challenges';
import type { ChallengeStatus, FriendChallenge, FriendWithActiveChallengesSummary } from '@/types/friends';
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

export async function getActiveFriendChallengeCount(): Promise<number> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_active_friend_challenge_count');

  if (error) {
    const challenges = await getMyFriendChallenges();
    return challenges.filter(
      (challenge) =>
        challenge.status !== 'declined' &&
        challenge.status !== 'expired' &&
        challenge.resolvedAt === null,
    ).length;
  }

  return typeof data === 'number' ? data : 0;
}

interface FriendWithActiveChallengesRow {
  friend_id: string;
  friend_username: string;
  friend_display_name: string | null;
  active_count: number;
  latest_created_at: string;
}

export async function getFriendsWithActiveFriendChallenges(): Promise<FriendWithActiveChallengesSummary[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_friends_with_active_friend_challenges');

  if (error) {
    const challenges = await getMyFriendChallenges();
    const grouped = new Map<string, FriendWithActiveChallengesSummary>();

    for (const challenge of challenges) {
      if (
        challenge.status === 'declined' ||
        challenge.status === 'expired' ||
        challenge.resolvedAt !== null
      ) {
        continue;
      }

      const existing = grouped.get(challenge.opponentId);
      if (existing) {
        existing.activeCount += 1;
        if (challenge.createdAt > existing.latestCreatedAt) {
          existing.latestCreatedAt = challenge.createdAt;
        }
        continue;
      }

      grouped.set(challenge.opponentId, {
        friendId: challenge.opponentId,
        username: challenge.opponentUsername,
        displayName: challenge.opponentDisplayName,
        activeCount: 1,
        latestCreatedAt: challenge.createdAt,
      });
    }

    return [...grouped.values()].sort(
      (left, right) =>
        new Date(right.latestCreatedAt).getTime() - new Date(left.latestCreatedAt).getTime(),
    );
  }

  return (data ?? []).map((row) => {
    const record = row as FriendWithActiveChallengesRow;
    return {
      friendId: record.friend_id,
      username: record.friend_username,
      displayName: record.friend_display_name,
      activeCount: record.active_count,
      latestCreatedAt: record.latest_created_at,
    };
  });
}

export async function getFriendChallengesWithUser(friendId: string): Promise<FriendChallenge[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_friend_challenges_with_user', {
    p_friend_id: friendId,
  });

  if (error) {
    const challenges = await getMyFriendChallenges();
    return challenges.filter((challenge) => challenge.opponentId === friendId);
  }

  return (data ?? []).map(mapFriendChallenge);
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

  const challengeId = data as string;
  const { data: challenges, error: listError } = await supabase.rpc('get_my_friend_challenges');

  if (listError) {
    throw listError;
  }

  const created = (challenges ?? []).find(
    (row) => row.challenge_id === challengeId && row.is_creator,
  );

  if (!created?.participant_id) {
    throw new Error('Failed to open created challenge');
  }

  return created.participant_id;
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
