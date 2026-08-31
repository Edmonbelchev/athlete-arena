import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { mapPublicCosmetics } from '@/features/friends/friendCosmeticsUtils';
import type { FriendPublicProfile, FriendRequest, FriendSummary, UserSearchResult } from '@/types/friends';

function mapFriend(row: {
  friendship_id: string;
  friend_id: string;
  username: string;
  display_name: string | null;
  level: number;
  current_streak: number;
  avatar_url?: string | null;
  avatar_icon?: string | null;
  avatar_background?: string | null;
  frame_border_color?: string | null;
  frame_border_width?: number | null;
}): FriendSummary {
  const cosmetics = mapPublicCosmetics(row);

  return {
    friendshipId: row.friendship_id,
    friendId: row.friend_id,
    username: row.username,
    displayName: row.display_name,
    level: row.level,
    currentStreak: row.current_streak,
    avatarUrl: row.avatar_url ?? null,
    avatar: cosmetics.avatar,
    frame: cosmetics.frame,
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

export async function getFriendProfile(userId: string): Promise<FriendPublicProfile | null> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_friend_profile', {
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  const row = (data ?? [])[0] as
    | {
        user_id: string;
        username: string;
        display_name: string | null;
        level: number;
        total_xp: number;
        current_streak: number;
        longest_streak: number;
        avatar_url: string | null;
        avatar_icon: string | null;
        avatar_background: string | null;
        frame_border_color: string | null;
        frame_border_width: number | null;
        equipped_title_name: string | null;
      }
    | undefined;

  if (!row) {
    return null;
  }

  const cosmetics = mapPublicCosmetics(row);

  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    level: row.level,
    totalXp: row.total_xp,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    avatarUrl: row.avatar_url,
    avatar: cosmetics.avatar,
    frame: cosmetics.frame,
    equippedTitleName: row.equipped_title_name ?? null,
  };
}
