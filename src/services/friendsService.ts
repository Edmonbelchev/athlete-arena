import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { FriendRequest, FriendSummary, UserSearchResult } from '@/types/friends';

function mapFriend(row: {
  friendship_id: string;
  friend_id: string;
  username: string;
  display_name: string | null;
  level: number;
  current_streak: number;
}): FriendSummary {
  return {
    friendshipId: row.friendship_id,
    friendId: row.friend_id,
    username: row.username,
    displayName: row.display_name,
    level: row.level,
    currentStreak: row.current_streak,
  };
}

function mapFriendRequest(row: {
  friendship_id: string;
  requester_id: string;
  username: string;
  display_name: string | null;
  created_at: string;
}): FriendRequest {
  return {
    friendshipId: row.friendship_id,
    requesterId: row.requester_id,
    username: row.username,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

export async function searchUsersByUsername(query: string): Promise<UserSearchResult[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('search_users_by_username', {
    p_query: query.trim().toLowerCase(),
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
  }));
}

export async function sendFriendRequest(username: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('send_friend_request', {
    p_username: username.trim().toLowerCase(),
  });

  if (error) {
    throw error;
  }
}

export async function respondFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('respond_friend_request', {
    p_friendship_id: friendshipId,
    p_accept: accept,
  });

  if (error) {
    throw error;
  }
}

export async function getFriendsList(): Promise<FriendSummary[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_friends_list');

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapFriend);
}

export async function getIncomingFriendRequests(): Promise<FriendRequest[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_incoming_friend_requests');

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapFriendRequest);
}
