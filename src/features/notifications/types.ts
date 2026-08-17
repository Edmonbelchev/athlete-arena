export type ChallengeNotificationType =
  | 'challenge_received'
  | 'challenge_accepted'
  | 'challenge_declined';

export type FriendNotificationType = 'friend_request_received' | 'friend_request_accepted';

export type InboxNotificationType = ChallengeNotificationType | FriendNotificationType;

export interface ChallengeNotification {
  id: string;
  type: InboxNotificationType;
  participantId: string | null;
  friendshipId: string | null;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
}

export function isChallengeNotificationType(
  type: InboxNotificationType,
): type is ChallengeNotificationType {
  return (
    type === 'challenge_received' ||
    type === 'challenge_accepted' ||
    type === 'challenge_declined'
  );
}

export function isFriendNotificationType(type: InboxNotificationType): type is FriendNotificationType {
  return type === 'friend_request_received' || type === 'friend_request_accepted';
}

interface ParticipantRow {
  id: string;
  challenge_id: string;
  user_id: string;
  status: string;
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
}

export function isParticipantRow(value: unknown): value is ParticipantRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.challenge_id === 'string' &&
    typeof row.user_id === 'string' &&
    typeof row.status === 'string'
  );
}

export function getChallengeNotificationTypeFromChange(
  eventType: string,
  row: ParticipantRow,
  oldRow: ParticipantRow | null,
  currentUserId: string,
): ChallengeNotificationType | null {
  if (eventType === 'INSERT') {
    if (row.user_id === currentUserId && row.status === 'pending') {
      return 'challenge_received';
    }
    return null;
  }

  if (eventType !== 'UPDATE') {
    return null;
  }

  if (!oldRow) {
    if (row.user_id !== currentUserId && row.status === 'in_progress') {
      return 'challenge_accepted';
    }

    if (row.status === 'declined') {
      return 'challenge_declined';
    }

    return null;
  }

  if (row.user_id !== currentUserId && oldRow.status === 'pending' && row.status === 'in_progress') {
    return 'challenge_accepted';
  }

  if (row.status === 'declined' && oldRow.status !== 'declined') {
    if (row.user_id !== currentUserId && oldRow.status === 'pending') {
      return 'challenge_declined';
    }
  }

  return null;
}

export function challengeNotificationId(
  type: ChallengeNotificationType,
  challengeId: string,
): string {
  return `${type}-${challengeId}`;
}

export function isFriendshipRow(value: unknown): value is FriendshipRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.requester_id === 'string' &&
    typeof row.addressee_id === 'string' &&
    typeof row.status === 'string'
  );
}

export function getFriendNotificationTypeFromChange(
  eventType: string,
  row: FriendshipRow,
  oldRow: FriendshipRow | null,
  currentUserId: string,
): FriendNotificationType | null {
  if (eventType === 'INSERT') {
    if (row.addressee_id === currentUserId && row.status === 'pending') {
      return 'friend_request_received';
    }

    return null;
  }

  if (eventType !== 'UPDATE') {
    return null;
  }

  if (row.requester_id !== currentUserId) {
    return null;
  }

  const previousStatus = oldRow?.status ?? 'pending';
  if (previousStatus === 'pending' && row.status === 'accepted') {
    return 'friend_request_accepted';
  }

  return null;
}

export function friendNotificationId(type: FriendNotificationType, friendshipId: string): string {
  return `${type}-${friendshipId}`;
}
