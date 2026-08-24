export type ChallengeNotificationType =
  | 'challenge_received'
  | 'challenge_accepted'
  | 'challenge_declined';

export type FriendNotificationType = 'friend_request_received' | 'friend_request_accepted';

export type WorkoutNotificationType = 'workout_shared';

export type SystemNotificationType = 'system_message';

export type InboxNotificationType =
  | ChallengeNotificationType
  | FriendNotificationType
  | WorkoutNotificationType
  | SystemNotificationType;

export interface ChallengeNotification {
  id: string;
  type: InboxNotificationType;
  participantId: string | null;
  friendshipId: string | null;
  templateId: string | null;
  messageId: string | null;
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

export function isWorkoutNotificationType(type: InboxNotificationType): type is WorkoutNotificationType {
  return type === 'workout_shared';
}

export function isSystemNotificationType(type: InboxNotificationType): type is SystemNotificationType {
  return type === 'system_message';
}

export type NotificationInboxTab = 'activity' | 'system';

export function getNotificationInboxTab(type: InboxNotificationType): NotificationInboxTab {
  return isSystemNotificationType(type) ? 'system' : 'activity';
}

export function filterNotificationsByTab(
  notifications: ChallengeNotification[],
  tab: NotificationInboxTab,
): ChallengeNotification[] {
  return notifications.filter((notification) => getNotificationInboxTab(notification.type) === tab);
}

export function parseNotificationInboxTab(value: string | string[] | undefined): NotificationInboxTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'system' ? 'system' : 'activity';
}

export function systemMessageNotificationId(messageId: string): string {
  return `system_message-${messageId}`;
}

interface SystemMessageRow {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  published_at: string;
}

export function isSystemMessageRow(value: unknown): value is SystemMessageRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    typeof row.body === 'string' &&
    typeof row.published_at === 'string'
  );
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

interface WorkoutShareRow {
  id: string;
  template_id: string;
  owner_id: string;
  shared_with_id: string;
  created_at: string;
}

export function isWorkoutShareRow(value: unknown): value is WorkoutShareRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.template_id === 'string' &&
    typeof row.owner_id === 'string' &&
    typeof row.shared_with_id === 'string' &&
    typeof row.created_at === 'string'
  );
}

export function getWorkoutShareNotificationTypeFromChange(
  eventType: string,
  row: WorkoutShareRow,
  currentUserId: string,
): WorkoutNotificationType | null {
  if (eventType !== 'INSERT') {
    return null;
  }

  if (row.shared_with_id !== currentUserId) {
    return null;
  }

  return 'workout_shared';
}

export function workoutShareNotificationId(templateId: string): string {
  return `workout_shared-${templateId}`;
}
