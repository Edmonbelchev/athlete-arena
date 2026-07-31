import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  friendNotificationId,
  type ChallengeNotification,
  type FriendNotificationType,
} from '@/features/notifications/types';
import { getIncomingFriendRequests } from '@/services/friendsService';
import type { FriendRequest } from '@/types/friends';

interface NotificationCopy {
  title: string;
  message: string;
  friendshipId: string;
}

interface AcceptedOutgoingFriendship {
  friendshipId: string;
  addresseeId: string;
  updatedAt: string;
}

const ACCEPTED_SYNC_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

async function loadProfileDisplay(userId: string): Promise<{ username: string; displayName: string | null } | null> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    username: data.username,
    displayName: data.display_name,
  };
}

function getDisplayName(profile: { username: string; displayName: string | null }): string {
  return profile.displayName ?? profile.username;
}

function buildCopyFromRequest(
  type: 'friend_request_received',
  request: FriendRequest,
): NotificationCopy {
  const requesterName = request.displayName ?? request.username;

  return {
    friendshipId: request.friendshipId,
    title: 'Friend request',
    message: `${requesterName} sent you a friend request`,
  };
}

function buildCopyFromAcceptedProfile(
  friendshipId: string,
  profile: { username: string; displayName: string | null },
): NotificationCopy {
  const friendName = getDisplayName(profile);

  return {
    friendshipId,
    title: 'Friend request accepted',
    message: `${friendName} accepted your friend request`,
  };
}

async function getRecentlyAcceptedOutgoingFriendships(
  currentUserId: string,
): Promise<AcceptedOutgoingFriendship[]> {
  assertSupabaseConfigured();

  const since = new Date(Date.now() - ACCEPTED_SYNC_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from('friendships')
    .select('id, addressee_id, updated_at')
    .eq('requester_id', currentUserId)
    .eq('status', 'accepted')
    .gte('updated_at', since);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    friendshipId: row.id,
    addresseeId: row.addressee_id,
    updatedAt: row.updated_at,
  }));
}

export async function buildFriendNotificationCopy(
  type: FriendNotificationType,
  options: {
    friendshipId: string;
    requesterId?: string;
    addresseeId?: string;
    request?: FriendRequest;
  },
): Promise<NotificationCopy | null> {
  if (type === 'friend_request_received') {
    if (options.request) {
      return buildCopyFromRequest(type, options.request);
    }

    if (!options.requesterId) {
      return null;
    }

    const profile = await loadProfileDisplay(options.requesterId);
    if (!profile) {
      return null;
    }

    return {
      friendshipId: options.friendshipId,
      title: 'Friend request',
      message: `${getDisplayName(profile)} sent you a friend request`,
    };
  }

  const addresseeId = options.addresseeId;
  if (!addresseeId) {
    return null;
  }

  const profile = await loadProfileDisplay(addresseeId);
  if (!profile) {
    return null;
  }

  return buildCopyFromAcceptedProfile(options.friendshipId, profile);
}

function getActiveFriendNotificationIds(
  incomingRequests: FriendRequest[],
  acceptedOutgoing: AcceptedOutgoingFriendship[],
): Set<string> {
  const activeIds = new Set<string>();

  for (const request of incomingRequests) {
    activeIds.add(friendNotificationId('friend_request_received', request.friendshipId));
  }

  for (const friendship of acceptedOutgoing) {
    activeIds.add(friendNotificationId('friend_request_accepted', friendship.friendshipId));
  }

  return activeIds;
}

export async function syncFriendNotifications(
  existing: ChallengeNotification[],
  currentUserId: string,
): Promise<ChallengeNotification[]> {
  try {
    const friendExisting = existing.filter((notification) =>
      notification.type === 'friend_request_received' || notification.type === 'friend_request_accepted',
    );
    const otherExisting = existing.filter(
      (notification) =>
        notification.type !== 'friend_request_received' && notification.type !== 'friend_request_accepted',
    );

    const [incomingRequests, acceptedOutgoing] = await Promise.all([
      getIncomingFriendRequests(),
      getRecentlyAcceptedOutgoingFriendships(currentUserId),
    ]);

    const activeIds = getActiveFriendNotificationIds(incomingRequests, acceptedOutgoing);
    const keptExisting = friendExisting.filter(
      (notification) => activeIds.has(notification.id) || notification.read,
    );
    const knownIds = new Set(keptExisting.map((notification) => notification.id));
    const mergedFriend = [...keptExisting];

    for (const request of incomingRequests) {
      const type = 'friend_request_received' as const;
      const stableId = friendNotificationId(type, request.friendshipId);
      if (knownIds.has(stableId)) {
        continue;
      }

      const copy = buildCopyFromRequest(type, request);
      mergedFriend.push({
        id: stableId,
        type,
        participantId: null,
        friendshipId: request.friendshipId,
        title: copy.title,
        message: copy.message,
        createdAt: new Date(request.createdAt).getTime(),
        read: false,
      });
      knownIds.add(stableId);
    }

    for (const friendship of acceptedOutgoing) {
      const type = 'friend_request_accepted' as const;
      const stableId = friendNotificationId(type, friendship.friendshipId);
      if (knownIds.has(stableId)) {
        continue;
      }

      const copy = await buildFriendNotificationCopy(type, {
        friendshipId: friendship.friendshipId,
        addresseeId: friendship.addresseeId,
      });

      if (!copy) {
        continue;
      }

      mergedFriend.push({
        id: stableId,
        type,
        participantId: null,
        friendshipId: friendship.friendshipId,
        title: copy.title,
        message: copy.message,
        createdAt: new Date(friendship.updatedAt).getTime(),
        read: false,
      });
      knownIds.add(stableId);
    }

    return [...otherExisting, ...mergedFriend]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  } catch {
    return existing;
  }
}
